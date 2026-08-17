/**
 * The canonical language model (spec §13, §14, §16).
 *
 * Learning content describes *language*. It never describes exercises: the
 * exercise engine derives interactions from these records (Rule 2). One
 * sentence is stored once and reused as a flashcard, a listening drill, a
 * cloze, a multiple-choice question or speaking practice.
 */

import type { Annotation, Morphology, PartOfSpeech, Token } from './annotation';
import type { ItemId, LexemeId, PackId, SenseId, SkillId, VerbFormId } from './ids';
import type { LanguageTag } from './language';
import type { Provenance } from './provenance';

export const CEFR_LEVELS = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2'] as const;
export type CefrLevel = (typeof CEFR_LEVELS)[number];

export const REGISTERS = ['neutral', 'colloquial', 'formal', 'vulgar'] as const;
export type Register = (typeof REGISTERS)[number];

/** Pre-generated, reviewed audio for one pronunciation locale (spec §6). */
export interface AudioRef {
  readonly locale: LanguageTag;
  /** Path relative to the pack root, e.g. `audio/es-ES/000001.mp3`. */
  readonly src: string;
  readonly durationMs?: number;
  readonly voice?: string;
  readonly provenance?: Provenance;
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
}
