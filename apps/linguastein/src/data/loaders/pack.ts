/**
 * Pack loading: manifest → files → validated records → `ContentPack`.
 *
 * This module is the only place that knows datasets are files. Swapping JSONL
 * over HTTP for a bundled binary format, an API or a user import affects
 * nothing above `ContentRepository`.
 */

import type {
  AudioClip,
  ContentPack,
  LearningItem,
  Level,
  Lexeme,
  PackManifest,
  Passage,
  Sense,
  Skill,
  InflectedForm,
  Translation,
} from '../../domain/content';
import {
  formatIssue,
  hasErrors,
  packManifestSchema,
  validateAcrossPacks,
  validatePackIntegrity,
  validateRecords,
  type RecordKind,
  type ValidationIssue,
} from '../validation';
import { LEVEL_SCOPE_ALL, levelsUpTo, type LevelScope } from '../../domain/content';
import { parseJsonl } from './jsonl';
import type { DatasetSource } from './source';

export interface LoadedPack {
  /**
   * The manifest path this came from, so the rest of it can be fetched later.
   *
   * A pack loaded up to a ceiling is topped up when the learner raises one, and
   * the topping-up happens well away from here — carrying the path back means
   * the app does not have to pair a manifest with the address it was read from
   * by remembering the order it asked in.
   */
  readonly path: string;
  readonly pack: ContentPack;
  readonly issues: readonly ValidationIssue[];
  /** Whether a shard was deliberately skipped — see {@link LoadOptions.upTo}. */
  readonly partial: boolean;
  /** The shard levels this load put in memory, so a later one can skip them. */
  readonly levels: readonly Level[];
}

/** One pack's meanings in one language, as the catalog lists them. */
export interface CatalogTranslations {
  readonly pack: string;
  readonly language: string;
  readonly version?: string;
  readonly manifest: string;
}

/**
 * A catalog lists what an installation ships: the packs, and the translation
 * units that explain them.
 *
 * Two lists rather than one, because they are addressed and versioned
 * separately — that is the whole of `docs/tasks/language-matrix.md` §3. The
 * catalog is the only unversioned file in the tree, which is what lets a
 * translation unit be *added* to a shipped pack: the pack's own manifest never
 * mentions it, so the pack does not move.
 *
 * `translations` is optional so a catalog written before this existed, or by
 * hand for a pack that ships none, still loads.
 */
export interface PackCatalog {
  readonly packs: readonly { readonly id: string; readonly manifest: string }[];
  readonly translations?: readonly CatalogTranslations[];
}

export async function loadCatalog(
  source: DatasetSource,
  path = 'catalog.json',
): Promise<PackCatalog> {
  const text = await source.read(path);
  const parsed: unknown = JSON.parse(text);
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !Array.isArray((parsed as PackCatalog).packs)
  ) {
    throw new Error(`${path} is not a valid pack catalog`);
  }
  return parsed as PackCatalog;
}

export interface LoadOptions {
  /**
   * The level ceiling to load up to, or `all` for the whole pack.
   *
   * A course is a ceiling and the big files are sharded by level, so an A1
   * learner needs about half the bytes (`docs/tasks/language-matrix.md` §5). A
   * file with no declared level is always loaded: the lexemes, the skills, the
   * passages and the translations are small, and the last of them carries no
   * level of its own.
   *
   * Absent means the whole pack, which is what every caller that is not the app's
   * boot path wants — a validation run, a test, a script.
   */
  readonly upTo?: LevelScope;
  /**
   * Exactly these shards and nothing else, for topping up a pack already in
   * memory.
   *
   * The complement of {@link upTo} rather than a second spelling of it: the
   * unsharded files arrived with the first load, so re-reading them would index
   * every translation twice. Which levels are missing is the caller's
   * bookkeeping, and {@link shardLevelsFor} is how it works them out — the same
   * function this uses, so the download and the course cannot disagree.
   */
  readonly only?: readonly Level[];
}

/**
 * The shard levels a pack has to have on hand for a course at this ceiling.
 *
 * Exported because the app asks the same question this answers, one step later:
 * what is missing for the level a learner has just tapped. Two answers to "is
 * this level in scope" is one too many, which is the trap
 * `docs/tasks/shard-loading.md` §5 names.
 *
 * A ceiling the pack does not name widens to the whole pack rather than to
 * nothing. `levelsUpTo` returns nothing there deliberately — everywhere else
 * `resolveCourse` has already corrected a stale level against the courses that
 * exist — but the boot path reads its ceiling straight off the address bar,
 * before there is a loaded course to correct it against. An over-fetch is
 * recoverable; a pack that fetched no content because a link said `/es/a3` is
 * not.
 */
export function shardLevelsFor(manifest: PackManifest, upTo: LevelScope): readonly Level[] {
  const sharded = [...new Set(manifest.files.flatMap((file) => (file.level ? [file.level] : [])))];
  const ladder = manifest.levels ?? [];
  if (upTo === LEVEL_SCOPE_ALL || !ladder.includes(upTo)) return sharded;
  return levelsUpTo(upTo, ladder, sharded);
}

export async function loadPack(
  source: DatasetSource,
  manifestPath: string,
  options: LoadOptions = {},
): Promise<LoadedPack> {
  const manifestText = await source.read(manifestPath);
  const manifestResult = packManifestSchema.safeParse(JSON.parse(manifestText));
  if (!manifestResult.success) {
    const issues = manifestResult.error.issues.map((issue): ValidationIssue => {
      const path = issue.path.join('.');
      return {
        severity: 'error',
        source: manifestPath,
        message: issue.message,
        ...(path ? { path } : {}),
      };
    });
    throw new PackLoadError(`invalid manifest ${manifestPath}`, issues);
  }

  // zod validates the shape; the domain types are the contract downstream.
  const manifest = manifestResult.data as unknown as PackManifest;
  const root = manifestPath.replace(/[^/]+$/, '');
  const issues: ValidationIssue[] = [];

  const collected: Record<RecordKind, unknown[]> = {
    items: [],
    lexemes: [],
    senses: [],
    forms: [],
    skills: [],
    translations: [],
    passages: [],
    audio: [],
  };

  /*
   * The shards in scope, plus everything unsharded — or, when the caller is
   * topping a pack up, the named shards alone. `levelsUpTo` behind
   * `shardLevelsFor` is the same ceiling rule the course filter uses, so a level
   * is in the session and in the download together.
   */
  const shards = new Set(options.only ?? shardLevelsFor(manifest, options.upTo ?? LEVEL_SCOPE_ALL));
  const wanted = manifest.files.filter((file) =>
    file.level === undefined ? options.only === undefined : shards.has(file.level),
  );
  const partial = wanted.length < manifest.files.length;

  for (const file of wanted) {
    const path = `${root}${file.path}`;
    const text = await source.read(path);
    const parsed = parseJsonl(text, file.path);
    issues.push(...parsed.issues);

    const validated = validateRecords(file.kind, parsed.records, file.path);
    issues.push(...validated.issues);
    collected[file.kind].push(...validated.records);
  }

  const pack: ContentPack = {
    manifest,
    items: collected.items as LearningItem[],
    lexemes: collected.lexemes as Lexeme[],
    senses: collected.senses as Sense[],
    forms: collected.forms as InflectedForm[],
    skills: collected.skills as Skill[],
    translations: collected.translations as Translation[],
    passages: collected.passages as Passage[],
    audio: collected.audio as AudioClip[],
  };

  issues.push(...validatePackIntegrity(pack, { partial }));
  return {
    path: manifestPath,
    pack,
    issues,
    partial,
    levels: [...new Set(wanted.flatMap((file) => (file.level ? [file.level] : [])))],
  };
}

export async function loadPacks(
  source: DatasetSource,
  manifestPaths: readonly string[],
  options: LoadOptions = {},
): Promise<{ loaded: readonly LoadedPack[]; issues: readonly ValidationIssue[] }> {
  const results = await Promise.all(manifestPaths.map((path) => loadPack(source, path, options)));
  const packs = results.map((result) => result.pack);
  return {
    loaded: results,
    // The cross-pack checks belong here rather than in `loadPack`, which sees one
    // pack and cannot know what else is installed. This is where an add-on's
    // local-id collision with the core pack becomes visible.
    issues: [...results.flatMap((result) => result.issues), ...validateAcrossPacks(packs)],
  };
}

export class PackLoadError extends Error {
  constructor(
    message: string,
    readonly issues: readonly ValidationIssue[],
  ) {
    super(`${message}\n${issues.map(formatIssue).join('\n')}`);
    this.name = 'PackLoadError';
  }
}

export { hasErrors };
