/**
 * Loading one pack's meanings in one reference language.
 *
 * The sibling of `pack.ts`, and deliberately a separate module rather than a
 * branch inside it. A translation unit is fetched on its own schedule, versioned
 * on its own, and is the only dataset a *learner's preference* decides the
 * download of — `docs/tasks/language-matrix.md` §3 for why the matrix has to be
 * additive rather than multiplicative.
 *
 * It reads through the same {@link DatasetSource} and resolves its files beside
 * its own manifest exactly the way `loadPack` does, so nothing above here knows
 * that meanings arrive in a second request.
 */

import type {
  LanguageTag,
  PackId,
  Translation,
  TranslationUnitManifest,
} from '../../domain/content';
import {
  translationUnitManifestSchema,
  validateRecords,
  type ValidationIssue,
} from '../validation';
import { parseJsonl } from './jsonl';
import { PackLoadError } from './pack';
import type { DatasetSource } from './source';

export interface LoadedTranslations {
  /** The manifest path this came from, for cache keys and for reporting. */
  readonly path: string;
  readonly manifest: TranslationUnitManifest;
  readonly translations: readonly Translation[];
  readonly issues: readonly ValidationIssue[];
}

export async function loadTranslationUnit(
  source: DatasetSource,
  manifestPath: string,
): Promise<LoadedTranslations> {
  const manifestText = await source.read(manifestPath);
  const parsedManifest = translationUnitManifestSchema.safeParse(JSON.parse(manifestText));
  if (!parsedManifest.success) {
    const issues = parsedManifest.error.issues.map((issue): ValidationIssue => {
      const path = issue.path.join('.');
      return {
        severity: 'error',
        source: manifestPath,
        message: issue.message,
        ...(path ? { path } : {}),
      };
    });
    throw new PackLoadError(`invalid translation manifest ${manifestPath}`, issues);
  }

  // zod validates the shape; the domain type is the contract downstream.
  const manifest = parsedManifest.data as unknown as TranslationUnitManifest;
  const root = manifestPath.replace(/[^/]+$/, '');
  const issues: ValidationIssue[] = [];
  const collected: unknown[] = [];

  for (const file of manifest.files) {
    const text = await source.read(`${root}${file.path}`);
    const parsed = parseJsonl(text, file.path);
    issues.push(...parsed.issues);

    const validated = validateRecords('translations', parsed.records, file.path);
    issues.push(...validated.issues);
    collected.push(...validated.records);
  }

  // zod validated each record; the domain type is the contract downstream, the
  // same handover `loadPack` makes.
  const translations = collected as Translation[];

  /*
   * A record whose language is not the one the unit declares.
   *
   * Checked here rather than trusted because the unit is *addressed* by its
   * language — `translations/core-es/en/1.0.0/` — while each record repeats it in
   * a `lang` field, and the repository indexes by the field. A German gloss
   * filed under `en/` would be fetched by a learner who asked for English and
   * then indexed as German: present in the download, absent from the screen, and
   * invisible in every count. Reported per file rather than per record, since one
   * mis-built file produces thousands of these.
   */
  const foreign = translations.filter(
    (translation) => translation.lang !== manifest.referenceLanguage,
  );
  if (foreign.length > 0) {
    issues.push({
      severity: 'error',
      source: manifestPath,
      message:
        `${foreign.length} translation(s) are not in ${manifest.referenceLanguage}, which is ` +
        `the language this unit is addressed by — first is "${foreign[0]?.lang}"`,
    });
  }

  return { path: manifestPath, manifest, translations, issues };
}

/**
 * Which unit explains a pack in a language, from the catalog's listing.
 *
 * A lookup rather than a path built by hand, so the layout stays a fact about
 * the build's output and the catalog rather than a string spelled into the app.
 */
export function translationUnitFor(
  catalog: {
    readonly translations?: readonly { pack: string; language: string; manifest: string }[];
  },
  pack: PackId,
  language: LanguageTag,
): string | undefined {
  return catalog.translations?.find((entry) => entry.pack === pack && entry.language === language)
    ?.manifest;
}

/** Every reference language the catalog can supply, for any loaded pack. */
export function catalogReferenceLanguages(
  catalog: { readonly translations?: readonly { pack: string; language: string }[] },
  packs: readonly PackId[],
): readonly LanguageTag[] {
  const installed = new Set<string>(packs);
  const languages = new Set<LanguageTag>();
  for (const entry of catalog.translations ?? []) {
    if (installed.has(entry.pack)) languages.add(entry.language);
  }
  return [...languages];
}
