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
import { levelsUpTo, type LevelScope } from '../../domain/content';
import { parseJsonl } from './jsonl';
import type { DatasetSource } from './source';

export interface LoadedPack {
  readonly pack: ContentPack;
  readonly issues: readonly ValidationIssue[];
  /** Whether a shard was deliberately skipped — see {@link LoadOptions.upTo}. */
  readonly partial: boolean;
}

/** A catalog lists the packs an installation ships with. */
export interface PackCatalog {
  readonly packs: readonly { readonly id: string; readonly manifest: string }[];
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
   * The shards in scope, plus everything unsharded. `levelsUpTo` is the same
   * ceiling rule the course filter uses, so a level is in the session and in the
   * download together — two answers to "is this in scope" would be one too many.
   */
  const inScope =
    options.upTo === undefined
      ? undefined
      : new Set(levelsUpTo(options.upTo, manifest.levels ?? []));
  const wanted = manifest.files.filter(
    (file) => file.level === undefined || inScope === undefined || inScope.has(file.level),
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
  return { pack, issues, partial };
}

export async function loadPacks(
  source: DatasetSource,
  manifestPaths: readonly string[],
): Promise<{ packs: readonly ContentPack[]; issues: readonly ValidationIssue[] }> {
  const results = await Promise.all(manifestPaths.map((path) => loadPack(source, path)));
  const packs = results.map((result) => result.pack);
  return {
    packs,
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
