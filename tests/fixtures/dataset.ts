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
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export const repoRoot = resolve(process.cwd());

/** Directory the `core-es` pack is written into, inside any packs root. */
export const PACK_DIR = 'core-es';

/**
 * The pack's manifest, wherever its version put it.
 *
 * A pack's files live under its version now — `core-es/0.16.0/pack.json` — so
 * that an update is a new URL and `CacheFirst` is safe for a 6 MB file
 * (`docs/tasks/language-matrix.md` §5). Nine test files had the flat path typed
 * into them; they ask here instead, which is also what the app does: `loadPack`
 * reads the manifest and resolves every file beside it.
 *
 * The version is discovered rather than passed, because a test knows which pack
 * it means and never which release it is looking at — and the build keeps one
 * version per pack in the artifact, so there is nothing to disambiguate.
 */
export function packManifestPath(packsRoot: string, packId = PACK_DIR): string {
  const packDir = join(packsRoot, packId);
  const versions = readdirSync(packDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(packDir, entry.name, 'pack.json')))
    .map((entry) => entry.name)
    .sort();
  const version = versions.at(-1);
  if (!version) {
    throw new Error(`no versioned manifest under ${packDir} — did the build run?`);
  }
  return join(packDir, version, 'pack.json');
}

/**
 * The manifest of one translation unit, wherever its own version put it.
 *
 * The sibling of {@link packManifestPath}, one level deeper: a unit is keyed by
 * the pack it explains *and* the language it explains it in, so the path is
 * `translations/core-es/en/0.16.0/translations.json`. As there, the version is
 * discovered rather than passed — a test knows which meanings it means and never
 * which release it is looking at.
 */
export function translationUnitPath(
  packsRoot: string,
  language: string,
  packId = PACK_DIR,
): string {
  const languageDir = join(packsRoot, 'translations', packId, language);
  if (!existsSync(languageDir)) {
    throw new Error(`no translation unit at ${languageDir} — did the build run?`);
  }
  const versions = readdirSync(languageDir, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() && existsSync(join(languageDir, entry.name, 'translations.json')),
    )
    .map((entry) => entry.name)
    .sort();
  const version = versions.at(-1);
  if (!version) throw new Error(`no versioned manifest under ${languageDir}`);
  return join('translations', packId, language, version, 'translations.json');
}

/** The one JSONL a translation unit is made of, resolved beside its manifest. */
function translationUnitFile(packsRoot: string, language: string): string {
  const manifestPath = join(packsRoot, translationUnitPath(packsRoot, language));
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    files?: readonly { readonly path: string }[];
  };
  const file = manifest.files?.[0]?.path;
  if (!file) throw new Error(`${manifestPath} lists no files`);
  return join(manifestPath.replace(/translations\.json$/, ''), file);
}

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
export function packFiles(packsRoot: string, kind: string): string[] {
  /*
   * Meanings live outside the pack now.
   *
   * A translation set is its own addressed, independently versioned unit
   * (`docs/tasks/language-matrix.md` §3), so `translations-en` is no longer one
   * of the pack manifest's `files` and asking the pack for it finds nothing.
   * Answered here rather than in each of the nine suites that ask, for the reason
   * this helper exists at all: a test asks for a kind and something else knows
   * where that lives.
   */
  const language = /^translations-(.+)$/.exec(kind)?.[1];
  if (language) return [translationUnitFile(packsRoot, language)];

  const manifestPath = packManifestPath(packsRoot);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    files?: readonly { readonly path: string; readonly level?: string }[];
  };
  const files = manifest.files ?? [];
  /*
   * `-sentences.jsonl` **or** `-sentences-a1.jsonl`: the big kinds are sharded by
   * level now, so a kind is one file or several
   * (`docs/tasks/language-matrix.md` §5). Matched on the manifest's own `level`
   * rather than by guessing at the suffix, so a kind whose name happens to end in
   * a level cannot be mistaken for a shard.
   */
  const matches = files.filter(
    (file) =>
      file.path.endsWith(`-${kind}.jsonl`) ||
      (file.level !== undefined && file.path.endsWith(`-${kind}-${file.level}.jsonl`)),
  );
  if (matches.length === 0) {
    throw new Error(
      `no pack file holds "${kind}" — ${manifestPath} lists ${files.map((f) => f.path).join(', ')}`,
    );
  }
  // Beside the manifest, exactly as `loadPack` resolves it.
  const root = manifestPath.replace(/pack\.json$/, '');
  return matches.map((match) => join(root, match.path));
}

/**
 * One file of a kind — the first shard where the kind is sharded.
 *
 * For a caller that wants a *path* to read or edit rather than the kind's whole
 * contents. Anything wanting the records should use {@link shippedRecords} or
 * `ScratchPack.records`, which read every shard.
 */
export function packFile(packsRoot: string, kind: string): string {
  return packFiles(packsRoot, kind)[0]!;
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

/**
 * Every record of a kind in the shipped `public/packs` pack, across its shards.
 *
 * In manifest order, which is ladder order for a sharded kind — so `sentences`
 * reads a1 then a2 then b1, and a test asserting on the first record still sees
 * the same one it did before the split.
 */
export function shippedRecords<T>(kind: string): T[] {
  return packFiles(join(repoRoot, 'public/packs'), kind).flatMap((path) => readJsonl<T>(path));
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
    records: <T>(kind: string) => packFiles(packs, kind).flatMap((path) => readJsonl<T>(path)),
    build: (extra) => runScript('scripts/build-dataset.ts', { env: { ...env, ...extra } }),
    tryBuild: (extra) => tryRunScript('scripts/build-dataset.ts', { env: { ...env, ...extra } }),
    run: (script: string) => runScript(script, { args: [packs], env }),
    capabilities,
    readCapabilities: () => readFileSync(capabilities, 'utf8'),
    writeCapabilities: (text: string) => writeFileSync(capabilities, text, 'utf8'),
    dispose: () => rmSync(workspace, { recursive: true, force: true }),
  };
}
