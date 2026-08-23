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
import type { LanguageTag } from './language';
import type { CefrLevel, ItemType, PackManifest } from './model';
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
  /** Levels the manifest declares, in CEFR order. */
  readonly levels: readonly CefrLevel[];
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
