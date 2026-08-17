/**
 * Pack loading: manifest → files → validated records → `ContentPack`.
 *
 * This module is the only place that knows datasets are files. Swapping JSONL
 * over HTTP for a bundled binary format, an API or a user import affects
 * nothing above `ContentRepository`.
 */

import type {
  ContentPack,
  LearningItem,
  Lexeme,
  PackManifest,
  Passage,
  Sense,
  Skill,
  Translation,
  VerbForm,
} from '../../domain/content';
import {
  formatIssue,
  hasErrors,
  packManifestSchema,
  validatePackIntegrity,
  validateRecords,
  type RecordKind,
  type ValidationIssue,
} from '../validation';
import { parseJsonl } from './jsonl';
import type { DatasetSource } from './source';

export interface LoadedPack {
  readonly pack: ContentPack;
  readonly issues: readonly ValidationIssue[];
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

export async function loadPack(source: DatasetSource, manifestPath: string): Promise<LoadedPack> {
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
    'verb-forms': [],
    skills: [],
    translations: [],
    passages: [],
  };

  for (const file of manifest.files) {
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
    verbForms: collected['verb-forms'] as VerbForm[],
    skills: collected.skills as Skill[],
    translations: collected.translations as Translation[],
    passages: collected.passages as Passage[],
  };

  issues.push(...validatePackIntegrity(pack));
  return { pack, issues };
}

export async function loadPacks(
  source: DatasetSource,
  manifestPaths: readonly string[],
): Promise<{ packs: readonly ContentPack[]; issues: readonly ValidationIssue[] }> {
  const results = await Promise.all(manifestPaths.map((path) => loadPack(source, path)));
  return {
    packs: results.map((result) => result.pack),
    issues: results.flatMap((result) => result.issues),
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
