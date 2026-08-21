/**
 * The canonical language model (spec §13, §14, §16).
 *
 * Learning content describes *language*. It never describes exercises: the
 * exercise engine derives interactions from these records (Rule 2). One
 * sentence is stored once and reused as a flashcard, a listening drill, a
 * cloze, a multiple-choice question or speaking practice.
 */

import type { Annotation, Morphology, PartOfSpeech, Token } from './annotation';
import type {
  AudioId,
  ItemId,
  LexemeId,
  PackId,
  PassageId,
  SenseId,
  SkillId,
  VerbFormId,
} from './ids';
import type { LanguageTag } from './language';
import type { Provenance, ReviewState } from './provenance';

export const CEFR_LEVELS = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2'] as const;
export type CefrLevel = (typeof CEFR_LEVELS)[number];

/**
 * How a phrase is pitched. Ordered from most to least widely usable, which is
 * the order a picker should offer them in.
 *
 * `slang` is not a synonym for `colloquial` and the distinction is the one a
 * learner most needs: `vale` is casual and completely standard, while `chido` is
 * slang and marks the speaker as Mexican — saying the second in a job interview
 * lands very differently from saying the first. Nor is it `vulgar`, which is
 * about offence rather than about being in-group.
 */
export const REGISTERS = ['neutral', 'colloquial', 'slang', 'formal', 'vulgar'] as const;
export type Register = (typeof REGISTERS)[number];

/**
 * What a learner sees for each register.
 *
 * A table beside the values rather than a conditional at the one call site that
 * needed it: `colloquial` has always been shown as "casual", spelled as an
 * inline ternary in the Browse select, so a second place that listed registers
 * would have disagreed with the first about what they are called.
 */
export const REGISTER_LABELS: Record<Register, string> = {
  neutral: 'neutral',
  colloquial: 'casual',
  slang: 'slang',
  formal: 'formal',
  vulgar: 'vulgar',
};

/**
 * Who a phrase addresses. Spanish forces this choice in almost every sentence
 * spoken to another person, and getting it wrong is the difference between
 * polite and rude — so it is first-class data rather than a note.
 *
 * Named after the pronouns because that is the choice a learner is making.
 * Third-person singular is deliberately never inferred: `está` is `usted` or
 * `él`/`ella` depending on context, and guessing would teach the wrong thing.
 */
export const ADDRESS_FORMS = ['tu', 'usted', 'vosotros', 'ustedes'] as const;
export type AddressForm = (typeof ADDRESS_FORMS)[number];

/**
 * What playback needs to speak one item: where the sound is and how long it
 * lasts. Items may embed these directly, which suits a small hand-authored
 * pack; a generated pack ships `AudioClip` records instead (see below).
 */
export interface AudioRef {
  readonly locale: LanguageTag;
  /** Path relative to the pack root, e.g. `audio/es-ES/lucia/000001-9f3ab27c.m4a`. */
  readonly src: string;
  readonly durationMs?: number;
  readonly voice?: string;
  readonly provenance?: Provenance;
}

/**
 * One recording of one item, as its own record referencing the item — the same
 * shape passages use for text.
 *
 * Audio deliberately does not live *on* the item. A voice would otherwise mean
 * rewriting every content file that mentions it, and an item could only ever
 * hold one set of takes. As separate records, a voice is addable without
 * touching content, several voices can coexist for the same phrase, and a whole
 * voice can be shipped, archived or dropped on its own.
 */
export interface AudioClip {
  readonly id: AudioId;
  readonly pack: PackId;
  readonly item: ItemId;
  readonly locale: LanguageTag;
  /** Which voice speaks it, matching a `PackVoice` id in the manifest. */
  readonly voice: string;
  /** Path relative to the pack root. Never absolute: packs are portable. */
  readonly src: string;
  /**
   * Hash of the text this clip actually speaks. An item keeps its id through a
   * typo fix, so this is the only thing that can tell a current clip from one
   * that is still pronouncing the old wording.
   */
  readonly textHash: string;
  readonly durationMs?: number;
  readonly provenance?: Provenance;
}

/**
 * A voice a pack ships, described well enough to choose, credit and license it.
 * Generated speech is not automatically yours to redistribute, so a voice
 * carries its own licence rather than inheriting the pack's.
 */
export interface PackVoice {
  readonly id: string;
  readonly locale: LanguageTag;
  /** What a learner sees in the settings picker. */
  readonly label?: string;
  /** Model or service that produced it, for reproducibility. */
  readonly provider?: string;
  readonly license?: string;
  readonly review?: ReviewState;
}

export const TRANSLATION_TYPES = ['natural', 'literal', 'alternative'] as const;
export type TranslationType = (typeof TRANSLATION_TYPES)[number];

/**
 * Translations are separate records, not fields on the Spanish content, so a
 * sentence stays usable with any reference language or none at all (Rule 5).
 */
export interface Translation {
  /** The entity being translated: an item, a sense, or a skill description. */
  readonly ref: string;
  readonly lang: LanguageTag;
  readonly text: string;
  readonly type?: TranslationType;
  readonly note?: string;
  readonly provenance?: Provenance;
}

/** A dictionary headword: a word/verb, independent of its examples. */
export interface Lexeme {
  readonly id: LexemeId;
  readonly lemma: string;
  readonly pos: PartOfSpeech;
  readonly level?: CefrLevel;
  /** Frequency rank in the target language; lower is more frequent. */
  readonly frequencyRank?: number;
  readonly register?: Register;
  /** Regions where this word is the usual choice: papa in Latin America, patata in Spain. */
  readonly regions?: readonly LanguageTag[];
  readonly gender?: Morphology['gender'];
  readonly tags?: readonly string[];
  readonly provenance?: Provenance;
}

/** One meaning/use of a lexeme. A word is not one translation (spec §13.1). */
export interface Sense {
  readonly id: SenseId;
  readonly lexeme: LexemeId;
  /** Short target-language label, e.g. `obligación`. Translations live separately. */
  readonly label?: string;
  readonly register?: Register;
  readonly regions?: readonly LanguageTag[];
  readonly skills?: readonly SkillId[];
  readonly provenance?: Provenance;
}

/** A structured inflected form (spec §14). Never a rendered conjugation table. */
export interface VerbForm {
  readonly id: VerbFormId;
  readonly lexeme: LexemeId;
  readonly form: string;
  readonly morph: Morphology;
  readonly level?: CefrLevel;
  readonly regions?: readonly LanguageTag[];
  readonly provenance?: Provenance;
}

/** Something the learner can get better at: a pattern, a form, a function. */
export const SKILL_KINDS = ['pattern', 'grammar', 'lexeme', 'function', 'topic'] as const;
export type SkillKind = (typeof SKILL_KINDS)[number];

export interface Skill {
  readonly id: SkillId;
  readonly kind: SkillKind;
  /** Target-language or neutral label, e.g. `tener que + infinitivo`. */
  readonly label: string;
  readonly level?: CefrLevel;
  readonly prerequisites?: readonly SkillId[];
  readonly provenance?: Provenance;
}

export const ITEM_TYPES = ['word', 'phrase', 'sentence'] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

/**
 * A reusable unit of learnable target-language text: the thing a learner sees,
 * hears and repeats. The same item may exemplify several lexemes and skills
 * and be reused across exercises and future contextual content (spec §13.2).
 */
export interface LearningItem {
  readonly id: ItemId;
  readonly pack: PackId;
  readonly type: ItemType;
  /** Target-language text, e.g. `Tengo que trabajar.` */
  readonly text: string;
  readonly level?: CefrLevel;
  readonly register?: Register;
  /** Set when the phrase is spoken to someone; derived from morphology where possible. */
  readonly address?: AddressForm;
  /** Where this is said. Absent means it works anywhere Spanish is spoken. */
  readonly regions?: readonly LanguageTag[];
  readonly topics?: readonly string[];
  readonly tags?: readonly string[];
  readonly tokens?: readonly Token[];
  readonly annotations?: readonly Annotation[];
  /** Lexemes this item exemplifies. */
  readonly lexemes?: readonly LexemeId[];
  readonly skills?: readonly SkillId[];
  /** Further items that illustrate this one (`Tengo que irme.` for `tener que`). */
  readonly examples?: readonly ItemId[];
  readonly audio?: readonly AudioRef[];
  /** Short target-language usage note; reference-language notes are translations. */
  readonly note?: string;
  readonly provenance?: Provenance;
}

export const PASSAGE_KINDS = ['text', 'dialogue'] as const;
export type PassageKind = (typeof PASSAGE_KINDS)[number];

/**
 * Several sentences read as one connected text (spec §16).
 *
 * A passage is a *container*, not a longer item: it references sentences that
 * remain independently practisable items. That matters twice over. The exercise
 * engine derives interactions per item, so a passage's sentences stay usable as
 * cloze, flashcards and speaking practice; and mastery weights a word by how
 * many different sentences it appears in, so a paragraph earns its recycling
 * honestly rather than looking like one long sentence.
 *
 * It is also why a passage carries no text of its own — the text is its
 * sentences, in order.
 */
export interface Passage {
  readonly id: PassageId;
  readonly pack: PackId;
  readonly kind: PassageKind;
  /** Target-language title, e.g. `Una mañana normal`. Translated separately. */
  readonly title: string;
  readonly level?: CefrLevel;
  readonly topics?: readonly string[];
  /** Union of the regions its sentences are limited to; absent means anywhere. */
  readonly regions?: readonly LanguageTag[];
  /** The sentences, in reading order. */
  readonly items: readonly ItemId[];
  /**
   * Who speaks each line of a dialogue, index-aligned with `items`. A name is a
   * display label, so it is plain text rather than an id.
   */
  readonly speakers?: readonly string[];
  readonly provenance?: Provenance;
}

/**
 * A thematic category the pack offers, declared rather than inferred.
 *
 * Scanning items for distinct topic strings gives you slugs and nothing else —
 * no label, no order, and no way to say a category exists but is still empty.
 * Declaring them also makes the pack the single source of the controlled
 * vocabulary its content is validated against.
 */
export interface PackTopic {
  /** Stable slug, as used in item `topics` and in a session or browse link. */
  readonly id: string;
  /** What a learner sees. */
  readonly label: string;
  /** Heading it is shown under, e.g. `Foundations`. */
  readonly group?: string;
}

/** A published, independently versioned collection of content (spec §10, §20). */
export interface PackManifest {
  readonly id: PackId;
  readonly name: string;
  readonly targetLanguage: LanguageTag;
  readonly version: string;
  readonly description?: string;
  readonly license?: string;
  readonly levels?: readonly CefrLevel[];
  readonly referenceLanguages?: readonly LanguageTag[];
  readonly pronunciationLocales?: readonly LanguageTag[];
  /** Thematic categories this pack offers, in the order they should be shown. */
  readonly topics?: readonly PackTopic[];
  /** Voices this pack ships clips for, so they can be listed, credited and chosen. */
  readonly voices?: readonly PackVoice[];
  readonly files: readonly PackFile[];
  readonly provenance?: Provenance;
}

export const PACK_FILE_KINDS = [
  'items',
  'lexemes',
  'senses',
  'verb-forms',
  'skills',
  'translations',
  'passages',
  'audio',
] as const;
export type PackFileKind = (typeof PACK_FILE_KINDS)[number];

export interface PackFile {
  readonly kind: PackFileKind;
  /** Path relative to the pack root, e.g. `es-a1-core-phrases.jsonl`. */
  readonly path: string;
}

/** A fully loaded pack, before normalisation into the repository index. */
export interface ContentPack {
  readonly manifest: PackManifest;
  readonly items: readonly LearningItem[];
  readonly lexemes: readonly Lexeme[];
  readonly senses: readonly Sense[];
  readonly verbForms: readonly VerbForm[];
  readonly skills: readonly Skill[];
  readonly translations: readonly Translation[];
  readonly passages: readonly Passage[];
  readonly audio: readonly AudioClip[];
}
