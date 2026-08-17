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

export const TARGET_LANGUAGES: readonly LanguageOption[] = [
  { tag: 'es', nativeName: 'Español', englishName: 'Spanish' },
];

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

/** Best matching pronunciation locale for a set of available ones. */
export function resolvePronunciationLocale(
  available: readonly LanguageTag[],
  preferred: LanguageTag,
): LanguageTag | undefined {
  if (available.includes(preferred)) return preferred;
  const base = baseLanguage(preferred);
  return available.find((locale) => baseLanguage(locale) === base) ?? available[0];
}
