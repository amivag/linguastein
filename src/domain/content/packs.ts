/**
 * What a content pack actually contains, counted rather than claimed.
 *
 * A pack is an add-on: it ships and versions independently of the app, declares
 * its own licence and provenance, and can be one of several loaded at once. So
 * "what is installed" is a real question a learner can ask, and the honest
 * answer is derived from the pack rather than read off its description — a
 * manifest can say it teaches A1 and A2 while the file it points at holds
 * neither.
 *
 * It lives in the domain and not in the settings screen for the usual reason:
 * counting is a query over the repository, it needs no React, and a screen that
 * counts things itself is a screen whose numbers nothing can test. The one rule
 * this file follows closely is the one Study got wrong once — **count with the
 * filter the label describes**, so `words` counts word cards rather than every
 * item that happens to exemplify a word.
 */

import { packIdOf, type PackId } from './ids';
import {
  DEFAULT_REFERENCE_LANGUAGE,
  languageOption,
  pronunciationLabel,
  type LanguageOption,
  type LanguageTag,
  type PronunciationLocaleOption,
} from './language';
import type { Level, ItemType, PackManifest } from './model';
import type { ProvenanceSource, ReviewState } from './provenance';
import type { ContentRepository } from './repository';

export interface PackContents {
  readonly manifest: PackManifest;
  /** Every learnable item in the pack, whatever its type. */
  readonly items: number;
  /** Word cards — not items exemplifying a word, which is a larger number. */
  readonly words: number;
  readonly phrases: number;
  readonly sentences: number;
  /** Connected texts and dialogues, which reference items rather than hold text. */
  readonly passages: number;
  /** Grammar, morphology and communicative-function skills together. */
  readonly skills: number;
  /** Declared categories that something in the pack actually uses. */
  readonly topics: number;
  /**
   * Levels the manifest declares, **in the order its ladder climbs**.
   *
   * "In CEFR order" is what this said, which was true of the only pack that
   * existed and is not a property of a pack — see `docs/tasks/language-matrix.md`
   * §7. The order is the pack's own, so a span read off it is right for HSK too.
   */
  readonly levels: readonly Level[];
  /** What the pack calls each rung, where the id does not name itself. */
  readonly levelLabels: Readonly<Record<string, string>>;
  /** Languages meanings are available in. */
  readonly referenceLanguages: readonly LanguageTag[];
  /** Accents the pack can be spoken in, whether by clip or by device voice. */
  readonly pronunciationLocales: readonly LanguageTag[];
  /** Recorded voices the pack ships clips for. */
  readonly voices: number;
  /** Whether the pack ships audio files at all, as opposed to relying on TTS. */
  readonly hasAudio: boolean;
  readonly source: ProvenanceSource | undefined;
  readonly review: ReviewState | undefined;
}

/**
 * The contents of one loaded pack, or `undefined` if it is not loaded.
 *
 * Absent rather than empty on purpose: zero of everything is a real answer for a
 * pack that failed validation, and a caller has to be able to tell that from a
 * pack that was never there.
 */
export function packContents(repository: ContentRepository, id: PackId): PackContents | undefined {
  const manifest = repository.getPack(id);
  if (!manifest) return undefined;

  const count = (types?: readonly ItemType[]) =>
    repository.query({ packs: [id], ...(types ? { types } : {}) }).length;

  return {
    manifest,
    items: count(),
    words: count(['word']),
    phrases: count(['phrase']),
    sentences: count(['sentence']),
    passages: repository.allPassages().filter((passage) => passage.pack === id).length,
    // A skill carries its pack in its namespace rather than as a field, so it is
    // read back through the id parser instead of being spelled out here.
    skills: repository.allSkills().filter((skill) => packIdOf(skill.id) === id).length,
    topics: repository.topics({ packs: [id] }).filter((topic) => topic.count > 0).length,
    levels: manifest.levels ?? [],
    levelLabels: manifest.levelLabels ?? {},
    referenceLanguages: manifest.referenceLanguages ?? [],
    pronunciationLocales: manifest.pronunciationLocales ?? [],
    voices: manifest.voices?.length ?? 0,
    hasAudio: manifest.files.some((file) => file.kind === 'audio'),
    source: manifest.provenance?.source,
    review: manifest.provenance?.review,
  };
}

/** Every loaded pack, in load order — which is the order the catalog listed. */
export function installedPacks(repository: ContentRepository): readonly PackContents[] {
  return repository.packs.flatMap((manifest) => {
    const contents = packContents(repository, manifest.id);
    return contents ? [contents] : [];
  });
}

/**
 * Whether a validation issue came out of this pack.
 *
 * An issue names the file it was found in, and a pack lists the files it is made
 * of, so attribution is a lookup rather than a guess. Without it, a dataset
 * error can only be reported as a number floating on the settings screen with no
 * way to tell which add-on to blame — which is exactly the report that gets
 * ignored.
 */
export function issueBelongsTo(manifest: PackManifest, source: string): boolean {
  return manifest.files.some((file) => source === file.path || source.endsWith(`/${file.path}`));
}

/**
 * The reference languages a learner can actually be offered, named.
 *
 * Derived rather than declared in a constant, which is the same choice
 * `courseOptions` makes about target languages and for the same reason: a pack
 * shipping German meanings should appear in the picker without an edit to a
 * list in `language.ts`, and a list in `language.ts` should not promise a
 * language no loaded pack can honour.
 *
 * English is the floor rather than the first entry. With no translations loaded
 * at all — a pack that ships target-language-only content — the picker still
 * has to name something, and the stored preference still has to resolve; the
 * fallback chain in `referenceLanguageChain` ends at English either way, so
 * offering it is honest about what the setting will do.
 *
 * `exclude` is how a caller keeps the language being learned out of the list.
 * Nothing prevented Spanish glossed in Spanish before, and with one target
 * language that was a curiosity; once a pack is a target language for one
 * learner and a reference language for another it is a setting people will reach
 * by accident. A same-language gloss is a legitimate advanced mode, but it
 * should be asked for — and what it actually wants is the chain's own last step,
 * target-language-only, rather than a reference language that resolves to
 * nothing. See `docs/tasks/language-matrix.md` §7.
 *
 * Excluding everything degrades to the unfiltered list rather than an empty
 * picker: a `select` with no options is a worse answer than one offering a
 * language the course cannot use, and the chain still resolves either way.
 */
export function referenceLanguages(
  repository: ContentRepository,
  exclude?: LanguageTag,
): readonly LanguageOption[] {
  const present = repository.translationLanguages();
  const tags = present.length > 0 ? present : [DEFAULT_REFERENCE_LANGUAGE];
  const offered = exclude ? tags.filter((tag) => tag !== exclude) : tags;
  return (offered.length > 0 ? offered : tags).map((tag) => languageOption(tag));
}

/**
 * The accents one target language can be spoken in, named for a picker.
 *
 * Three sources in order of authority, because a pack may answer the question
 * in any of them: the accents the manifest declares, the accents its recorded
 * voices are in, and — when it says neither — the bare language tag.
 *
 * That last case is the one that matters for a new language. A pack with no
 * regional accents declared and no recorded voices is not unspeakable: it is
 * spoken in German, and the device picks the voice. Returning nothing instead
 * left the preference holding whatever the previous course set, which is how
 * German came to be read aloud by a Spanish voice.
 */
export function pronunciationLocales(
  repository: ContentRepository,
  language: LanguageTag,
): readonly PronunciationLocaleOption[] {
  const locales = new Set<LanguageTag>();
  for (const manifest of repository.packs) {
    if (manifest.targetLanguage !== language) continue;
    for (const locale of manifest.pronunciationLocales ?? []) locales.add(locale);
    for (const voice of manifest.voices ?? []) locales.add(voice.locale);
  }
  if (locales.size === 0) locales.add(language);
  return [...locales].map((locale) => ({ locale, label: pronunciationLabel(locale) }));
}

/**
 * The stored accent corrected into `language`, or the language's first accent.
 *
 * Called when the course changes, because `pronunciationLocale` is one
 * preference across every course: switching from Spanish to German has to move
 * it, or the German course inherits `es-ES` and every play button asks the
 * device for a Spanish voice reading German text. Same language, no change —
 * so a learner's chosen accent survives a level switch and a reload.
 */
export function resolvePronunciationFor(
  repository: ContentRepository,
  language: LanguageTag,
  current: LanguageTag,
): LanguageTag {
  const offered = pronunciationLocales(repository, language);
  const kept = offered.find((option) => option.locale === current);
  return kept?.locale ?? offered[0]?.locale ?? language;
}
