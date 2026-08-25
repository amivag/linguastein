/**
 * Shared plumbing for the tests that exercise the real dataset scripts.
 *
 * Those suites all need the same two things: the records of a built pack, and a
 * scratch copy of `content/es` they can edit and rebuild without touching the
 * checked-in pack. Both were copy-pasted per file, which left five slightly
 * different JSONL readers and five spellings of the same build command — so a
 * fix to one (skipping `#` comments, say) did not reach the others.
 *
 * Running the scripts as a subprocess is deliberate: it exercises the shipped
 * entry point, including the argument and environment handling a direct import
 * would skip.
 */

import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export const repoRoot = resolve(process.cwd());

/** Directory the `core-es` pack is written into, inside any packs root. */
export const PACK_DIR = 'core-es';

export interface RunResult {
  readonly ok: boolean;
  /** Stdout when the script succeeded, stderr when it failed. */
  readonly output: string;
}

/** Runs a repo script under tsx, capturing output instead of inheriting stdio. */
export function tryRunScript(
  script: string,
  options: { args?: readonly string[]; env?: Record<string, string> } = {},
): RunResult {
  try {
    const stdout = execFileSync(
      process.execPath,
      ['--import', 'tsx', join(repoRoot, script), ...(options.args ?? [])],
      { cwd: repoRoot, env: { ...process.env, ...options.env }, stdio: 'pipe' },
    );
    return { ok: true, output: String(stdout) };
  } catch (error) {
    const { stderr, stdout } = error as { stderr?: Buffer; stdout?: Buffer };
    return { ok: false, output: String(stderr ?? '') || String(stdout ?? '') };
  }
}

/** As {@link tryRunScript}, but a failure is a test-setup bug, so it throws. */
export function runScript(
  script: string,
  options: { args?: readonly string[]; env?: Record<string, string> } = {},
): string {
  const { ok, output } = tryRunScript(script, options);
  if (!ok) throw new Error(`${script} failed:\n${output}`);
  return output;
}

/** Data rows of a JSONL file — `#` comments and blank lines are not records. */
export function readJsonl<T>(path: string): T[] {
  return readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0 && !line.trimStart().startsWith('#'))
    .map((line) => JSON.parse(line) as T);
}

/**
 * Where one pack file is, looked up by what it holds rather than by its name.
 *
 * A pack file's name carries the level range of its content — the build derives
 * `es-a1-a2-core-…` from the levels actually present — so the day B1 content
 * landed, every one of those names changed. Thirteen suites had the old
 * spelling typed into them and thirteen broke at once, not one of them a test
 * about file naming.
 *
 * So a test asks for `sentences` and the manifest says where that is, which is
 * what the app's own loader does. `kind` is the part after the prefix:
 * `verbs`, `vocabulary`, `translations-en`, `audio-es-ES`.
 */
export function packFile(packsRoot: string, kind: string): string {
  const manifestPath = join(packsRoot, PACK_DIR, 'pack.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    files?: readonly { readonly path: string }[];
  };
  const files = manifest.files ?? [];
  const match = files.find((file) => file.path.endsWith(`-${kind}.jsonl`));
  if (!match) {
    throw new Error(
      `no pack file holds "${kind}" — ${manifestPath} lists ${files.map((f) => f.path).join(', ')}`,
    );
  }
  return join(packsRoot, PACK_DIR, match.path);
}

/** Whether the pack emitted a file of this kind at all. */
export function hasPackFile(packsRoot: string, kind: string): boolean {
  try {
    packFile(packsRoot, kind);
    return true;
  } catch {
    return false;
  }
}

/** A JSONL file of the shipped `public/packs` pack, by kind — see {@link packFile}. */
export function shippedRecords<T>(kind: string): T[] {
  return readJsonl<T>(packFile(join(repoRoot, 'public/packs'), kind));
}

export interface ScratchPack {
  /** Scratch copy of `content/es`, safe to edit. */
  readonly content: string;
  /** Packs root the build writes into. */
  readonly packs: string;
  /** Absolute path to a file inside the scratch content directory. */
  path(file: string): string;
  /** Reads a source file from the scratch content directory. */
  read(file: string): string;
  /** Overwrites a file in the scratch content directory. */
  write(file: string, text: string): void;
  /** Appends one row to a TSV in the scratch content directory. */
  append(file: string, row: string): void;
  /** Records of a built pack file, by kind — see {@link packFile}. */
  records<T>(kind: string): T[];
  /** Runs the dataset build; throws if it fails. Returns stdout. */
  build(env?: Record<string, string>): string;
  /**
   * Runs the dataset build, reporting failure instead of throwing.
   *
   * `env` reaches the script, which is how a gate that is deliberately relaxed
   * for a scratch copy can still be tested — the recycling ratchet only reports
   * here unless `LINGUASTEIN_RECYCLING=enforce` says otherwise.
   */
  tryBuild(env?: Record<string, string>): RunResult;
  /** Runs another dataset script against the same scratch directories. */
  run(script: string): string;
  /**
   * Absolute path to the scratch copy of the shared capability registry.
   *
   * It sits *beside* the content directory rather than inside it, because that
   * is where the build looks: the registry belongs to no single language.
   */
  readonly capabilities: string;
  readCapabilities(): string;
  writeCapabilities(text: string): void;
  dispose(): void;
}

/**
 * Copies `content/es` into a temporary workspace and points the dataset scripts
 * at it via `LINGUASTEIN_CONTENT_DIR` / `LINGUASTEIN_PACKS_DIR`.
 *
 * The caller decides when to build: some suites build once in `beforeAll` and
 * read the result, others edit a source first to assert the build rejects it.
 */
export function createScratchPack(prefix: string): ScratchPack {
  const workspace = mkdtempSync(join(tmpdir(), `${prefix}-`));
  const content = join(workspace, 'content');
  const packs = join(workspace, 'packs');
  cpSync(join(repoRoot, 'content/es'), content, { recursive: true });
  // The shared registry is not part of `content/es` and the build resolves it
  // from the content directory's parent, so a scratch copy needs it in the same
  // relative place. Without it every authored `function` row fails its gate,
  // which would break every suite here rather than the one testing the gate.
  const capabilities = join(workspace, 'capabilities.tsv');
  cpSync(join(repoRoot, 'content/capabilities.tsv'), capabilities);

  const env = { LINGUASTEIN_CONTENT_DIR: content, LINGUASTEIN_PACKS_DIR: packs };
  const path = (file: string) => join(content, file);
  const read = (file: string) => readFileSync(path(file), 'utf8');

  return {
    content,
    packs,
    path,
    read,
    write: (file, text) => writeFileSync(path(file), text, 'utf8'),
    append: (file, row) => writeFileSync(path(file), `${read(file).trimEnd()}\n${row}\n`, 'utf8'),
    records: <T>(kind: string) => readJsonl<T>(packFile(packs, kind)),
    build: (extra) => runScript('scripts/build-dataset.ts', { env: { ...env, ...extra } }),
    tryBuild: (extra) => tryRunScript('scripts/build-dataset.ts', { env: { ...env, ...extra } }),
    run: (script: string) => runScript(script, { args: [packs], env }),
    capabilities,
    readCapabilities: () => readFileSync(capabilities, 'utf8'),
    writeCapabilities: (text: string) => writeFileSync(capabilities, text, 'utf8'),
    dispose: () => rmSync(workspace, { recursive: true, force: true }),
  };
}
