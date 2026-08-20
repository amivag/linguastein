/**
 * Target language, reference language and pronunciation locale are three
 * independent concepts (spec §11, Rules 5 & 6).
 *
 * - target language      — what is being learned (`es`)
 * - reference language   — the language explanations/translations are shown in (`en`)
 * - pronunciation locale — which accent is spoken (`es-MX`)
 *
 * We deliberately avoid the term "native language": a learner's preferred
 * reference language is not necessarily their native one.
 */

/** BCP 47 language tag, e.g. `es`, `en`, `es-MX`, `pt-BR`. */
export type LanguageTag = string;

export interface LanguageOption {
  readonly tag: LanguageTag;
  /** Name in the language itself. */
  readonly nativeName: string;
  readonly englishName: string;
}

/**
 * Languages the app can name.
 *
 * Not a list of what is available to learn — that is derived from the packs
 * actually loaded (`courseOptions`). This is only how a language tag is spelled
 * for a human, so an added pack shows "Français" rather than "fr" without
 * anything else being touched. Spanish is first because it is what ships.
 */
export const TARGET_LANGUAGES: readonly LanguageOption[] = [
  { tag: 'es', nativeName: 'Español', englishName: 'Spanish' },
  { tag: 'fr', nativeName: 'Français', englishName: 'French' },
  { tag: 'de', nativeName: 'Deutsch', englishName: 'German' },
  { tag: 'it', nativeName: 'Italiano', englishName: 'Italian' },
  { tag: 'pt', nativeName: 'Português', englishName: 'Portuguese' },
  { tag: 'nl', nativeName: 'Nederlands', englishName: 'Dutch' },
  { tag: 'el', nativeName: 'Ελληνικά', englishName: 'Greek' },
];

/**
 * How to spell a language tag for a learner, falling back to the tag itself.
 *
 * The fallback is the point: an unknown language must still be selectable and
 * still name itself in the UI, or adding a pack would mean editing this file
 * before the pack could be used at all.
 */
export function languageOption(tag: LanguageTag): LanguageOption {
  const base = baseLanguage(tag);
  const known =
    TARGET_LANGUAGES.find((option) => option.tag === tag) ??
    TARGET_LANGUAGES.find((option) => option.tag === base);
  return known ?? { tag, nativeName: tag, englishName: tag };
}

/** English is only the first supported reference language, never a structural requirement. */
export const REFERENCE_LANGUAGES: readonly LanguageOption[] = [
  { tag: 'en', nativeName: 'English', englishName: 'English' },
];

export const DEFAULT_TARGET_LANGUAGE: LanguageTag = 'es';
export const DEFAULT_REFERENCE_LANGUAGE: LanguageTag = 'en';
export const ULTIMATE_FALLBACK_LANGUAGE: LanguageTag = 'en';

export interface PronunciationLocaleOption {
  readonly locale: LanguageTag;
  readonly label: string;
}

export const PRONUNCIATION_LOCALES: readonly PronunciationLocaleOption[] = [
  { locale: 'es-ES', label: 'Spain' },
  { locale: 'es-MX', label: 'Mexico' },
  { locale: 'es-AR', label: 'Argentina' },
  { locale: 'es-CO', label: 'Colombia' },
];

export const DEFAULT_PRONUNCIATION_LOCALE: LanguageTag = 'es-ES';

/**
 * Regions content can be filtered to (`ItemFilter.usableIn`). Wider than the
 * pronunciation locales because a learner aims at a region, not a voice: it
 * includes the `es-419` macro-region, which every Latin American locale
 * satisfies. Shared so the Browse controls and the session URL cannot disagree
 * about which values are valid.
 */
export const FILTERABLE_REGIONS: readonly PronunciationLocaleOption[] = [
  { locale: 'es-419', label: 'Latin America' },
  ...PRONUNCIATION_LOCALES,
];

/** `es-419-x-foo` → `es-419` → `es`. */
export function baseLanguage(tag: LanguageTag): LanguageTag {
  const [primary] = tag.split('-');
  return primary ?? tag;
}

/**
 * Resolution order for reference-language content (spec §11.1):
 * selected locale → base language → English → target-language-only mode.
 *
 * The final "target-language-only" step is the absence of any match, i.e. the
 * caller renders without a translation rather than falling over.
 */
export function referenceLanguageChain(selected: LanguageTag): readonly LanguageTag[] {
  const chain = [selected, baseLanguage(selected), ULTIMATE_FALLBACK_LANGUAGE];
  return chain.filter((tag, index) => tag.length > 0 && chain.indexOf(tag) === index);
}

/** Picks the best available value from a map keyed by language tag, or `undefined`. */
export function resolveByLanguage<T>(
  byLanguage: ReadonlyMap<LanguageTag, T>,
  selected: LanguageTag,
): T | undefined {
  for (const tag of referenceLanguageChain(selected)) {
    const value = byLanguage.get(tag);
    if (value !== undefined) return value;
  }
  return undefined;
}

/**
 * Latin American locales, for resolving the `es-419` macro-region. A word
 * marked `es-419` is the usual choice across these; one marked `es-ES` is not.
 */
const LATIN_AMERICAN = new Set([
  'es-419',
  'es-MX',
  'es-AR',
  'es-CO',
  'es-CL',
  'es-PE',
  'es-VE',
  'es-EC',
  'es-GT',
  'es-CU',
  'es-BO',
  'es-DO',
  'es-HN',
  'es-PY',
  'es-SV',
  'es-NI',
  'es-CR',
  'es-PA',
  'es-UY',
  'es-PR',
]);

/**
 * Whether content marked for `region` is what someone learning `locale` should
 * be taught. `patata` is marked `es-ES`; a learner aiming at Mexico should not
 * meet it unmarked, and `papa` (`es-419`) is the word they want.
 */
export function regionCovers(region: LanguageTag, locale: LanguageTag): boolean {
  if (region === locale) return true;
  // A bare language tag means "anywhere this language is spoken".
  if (region === baseLanguage(region)) return baseLanguage(locale) === region;
  if (region === 'es-419') return LATIN_AMERICAN.has(locale);
  return false;
}

/**
 * Content with no regions works everywhere; content with regions has to cover
 * the learner's locale. Absence is the common case and must stay permissive.
 */
export function isUsableIn(
  regions: readonly LanguageTag[] | undefined,
  locale: LanguageTag,
): boolean {
  if (!regions || regions.length === 0) return true;
  return regions.some((region) => regionCovers(region, locale));
}

/** Best matching pronunciation locale for a set of available ones. */
export function resolvePronunciationLocale(
  available: readonly LanguageTag[],
  preferred: LanguageTag,
): LanguageTag | undefined {
  if (available.includes(preferred)) return preferred;
  const base = baseLanguage(preferred);
  return available.find((locale) => baseLanguage(locale) === base) ?? available[0];
}

const REGION_NAMES: Record<string, string> = {
  'es-ES': 'Spain',
  'es-419': 'Latin America',
  'es-MX': 'Mexico',
  'es-AR': 'Argentina',
  'es-CO': 'Colombia',
  'es-CL': 'Chile',
  'es-PE': 'Peru',
};

/** Human-readable region name, falling back to the tag itself. */
export function regionLabel(region: LanguageTag): string {
  return REGION_NAMES[region] ?? region;
}
