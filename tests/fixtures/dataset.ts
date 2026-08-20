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

/** A JSONL file of the shipped `public/packs` pack. */
export function shippedRecords<T>(file: string): T[] {
  return readJsonl<T>(join(repoRoot, 'public/packs', PACK_DIR, file));
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
  /** Records of a built pack file. */
  records<T>(file: string): T[];
  /** Runs the dataset build; throws if it fails. Returns stdout. */
  build(): string;
  /** Runs the dataset build, reporting failure instead of throwing. */
  tryBuild(): RunResult;
  /** Runs another dataset script against the same scratch directories. */
  run(script: string): string;
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
    records: <T>(file: string) => readJsonl<T>(join(packs, PACK_DIR, file)),
    build: () => runScript('scripts/build-dataset.ts', { env }),
    tryBuild: () => tryRunScript('scripts/build-dataset.ts', { env }),
    run: (script: string) => runScript(script, { args: [packs], env }),
    dispose: () => rmSync(workspace, { recursive: true, force: true }),
  };
}
