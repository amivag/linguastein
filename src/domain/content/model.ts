/**
 * The canonical language model (spec §13, §14, §16).
 *
 * Learning content describes *language*. It never describes exercises: the
 * exercise engine derives interactions from these records (Rule 2). One
 * sentence is stored once and reused as a flashcard, a listening drill, a
 * cloze, a multiple-choice question or speaking practice.
 */

import type { Annotation, Morphology, PartOfSpeech, Token } from './annotation';
import type { AudioId, FormId, ItemId, LexemeId, PackId, PassageId, SenseId, SkillId } from './ids';
import type { LanguageTag } from './language';
import type { Provenance, ReviewState } from './provenance';

/**
 * A level, as the id its pack's ladder calls that rung.
 *
 * **A slug, not an enum, and the order is not here.** This was
 * `['a1','a2','b1','b2','c1','c2']` with a `CEFR_LEVELS.indexOf(...)` comparison
 * at six call sites, which made two Spanish-shaped assumptions in the model every
 * pack shares: that a curriculum has CEFR levels, and that the app knows what
 * order they climb in. Chinese is taught in HSK bands and Japanese in JLPT ones,
 * and `docs/tasks/language-matrix.md` §7 calls this the most urgent of its schema
 * decisions because the level reaches the zod boundary, the URL path, mission
 * filtering, `session-url.ts` and `ReadScreen`.
 *
 * The ladder is **declared per pack** (`content/<tag>/levels.tsv` → `PackManifest.levels`,
 * in the order it climbs) and read back through `levelLadder`. Level is still a
 * ceiling everywhere — `a2` means "a2 and below" — but "below" is now a fact
 * about the pack rather than about this file.
 *
 * The **build** is what refuses a level its ladder does not declare, as it does
 * for a topic slug and an address form. A shared schema could only ever have
 * checked one curriculum's list, and did.
 */
export type Level = string;

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
 * Who a phrase addresses, as the id its language calls that choice.
 *
 * Spanish forces this choice in almost every sentence spoken to another person,
 * and getting it wrong is the difference between polite and rude — so it is
 * first-class data rather than a note. Third-person singular is deliberately
 * never inferred: `está` is `usted` or `él`/`ella` depending on context, and
 * guessing would teach the wrong thing.
 *
 * **A slug, not an enum, and that is a language-neutrality fix rather than a
 * loosening.** This was `['tu', 'usted', 'vosotros', 'ustedes']` — four Spanish
 * pronouns in the model every pack shares, reaching the zod boundary as a closed
 * enum and `UsageBadges` as a label table. German's `du`/`Sie`/`ihr` could not be
 * spelled through it, and `docs/tasks/language-matrix.md` §7 records the case that
 * settles it: Chinese barely marks the distinction, so the field has to be
 * droppable and a screen has to render nothing rather than guess.
 *
 * The vocabulary is the language module's (`LanguageModule.addressForms`), which
 * is where the pronoun, the label a learner reads and the neutral number and
 * formality now live together. The **build** is what refuses a value the language
 * does not declare — the same place, and for the same reason, as a topic or a
 * skill slug. A shared schema could only ever have checked one language's list.
 */
export type AddressForm = string;

/**
 * The gender a sentence commits its *speaker* to.
 *
 * Spanish makes a learner say something about themselves in order to say
 * anything else: `Estoy cansado` and `Estoy cansada` are the same sentence, and
 * exactly one of them is the learner's. The pack ships both — it already did,
 * as independent rows — and this field is what lets a learner be taught the one
 * that is true of them rather than the one that happened to be written first.
 *
 * Absent is the common case and means the sentence says nothing about who is
 * speaking, so it is usable by anyone. Only first-person self-description sets
 * it; `El comedor estaba vacío` describes a room.
 *
 * Deliberately not {@link Gender}, which is a property of a *word* — `mesa` is
 * feminine regardless of who says it. Sharing the type would have invited a
 * filter that narrowed the dictionary by the learner's own gender.
 */
export const SPEAKER_GENDERS = ['masculine', 'feminine'] as const;
export type SpeakerGender = (typeof SPEAKER_GENDERS)[number];

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
  readonly level?: Level;
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

/**
 * One inflected form of a lexeme (spec §14). Never a rendered table.
 *
 * Verb conjugations are the bulk of these and were once the whole of them — the
 * record and its pack file both said `verb-form`. But a noun's plural and an
 * adjective's four agreement forms are the same kind of fact, generated by the
 * same language module, and a learner tapping `verduras` has the same question
 * about it as one tapping `tengo`. Two record types for one idea would have
 * meant two accessors, two schemas and two places to forget.
 */
export interface InflectedForm {
  readonly id: FormId;
  readonly lexeme: LexemeId;
  readonly form: string;
  readonly morph: Morphology;
  readonly level?: Level;
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
  readonly level?: Level;
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
  /**
   * The same text in a script the learner can already read: `nǐ hǎo` for 你好,
   * `kaliméra` for καλημέρα.
   *
   * Absent for a language written in an alphabet the learner has — which is
   * every language the app ships today, and why this is easy to forget until it
   * is expensive. It is not a translation: it carries no meaning and belongs on
   * the item rather than in a `Translation` record, which resolves through the
   * reference-language chain and would make a reading disappear when someone
   * switched their glosses to German.
   *
   * A *display* preference for showing it belongs with the learner, not here;
   * the field is the fact, and the fact has to exist first. See
   * `docs/tasks/second-language.md` §6.
   */
  readonly reading?: string;
  readonly level?: Level;
  readonly register?: Register;
  /** Set when the phrase is spoken to someone; derived from morphology where possible. */
  readonly address?: AddressForm;
  /**
   * Set when the phrase describes the speaker in a way that carries gender.
   * Derived from morphology where it is unambiguous, declared otherwise.
   */
  readonly speakerGender?: SpeakerGender;
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
  readonly level?: Level;
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
/**
 * Somebody who made a pack, and what they did.
 *
 * A list rather than one `author` string, for the reason {@link PackVoice} is a
 * list: content has contributors rather than an owner, they hold different roles,
 * and a generated pack's honest author is a tool rather than a person. One field
 * would flatten all three into a claim that is wrong in at least one direction.
 */
export interface PackAuthor {
  readonly name: string;
  /** What this name did — `content`, `engineering`, `review`, `generation`. */
  readonly role?: string;
  /** Where a reader can check the claim: a profile, a repository, a model card. */
  readonly url?: string;
}

export interface PackManifest {
  readonly id: PackId;
  readonly name: string;
  readonly targetLanguage: LanguageTag;
  readonly version: string;
  /**
   * The day this version was cut, `YYYY-MM-DD`.
   *
   * Authored beside the version rather than stamped from the clock, because the
   * build has to be reproducible: CI fails when a rebuild changes `public/packs`,
   * and a date read at build time would make every build differ from the last.
   */
  readonly updated?: string;
  /** Who made it. See {@link PackAuthor} for why this is a list. */
  readonly authors?: readonly PackAuthor[];
  readonly description?: string;
  readonly license?: string;
  /**
   * The pack's level ladder, **in the order it climbs**.
   *
   * The order is the whole of it. `a2` means "a2 and below" everywhere in the
   * app, and this list is what "below" is read from — it replaced
   * `CEFR_LEVELS.indexOf(...)`, which could only ever order one curriculum's
   * codes. Only levels the pack actually has content for are listed, so this
   * doubles as what Settings advertises.
   */
  readonly levels?: readonly Level[];
  /**
   * Practisable items per level, exact rather than cumulative.
   *
   * A course is described before its content is fetched: the level chips carry a
   * count, and with the big files sharded by level an A1 learner has not loaded
   * B1. Counting the items in memory would report a smaller course rather than an
   * unfetched one, so the pack states its own figures.
   */
  readonly levelItems?: Readonly<Record<string, number>>;
  /**
   * What to call each rung, where the id does not name itself.
   *
   * Absent for CEFR, deliberately: `a1` reads correctly as `A1` once upper-cased,
   * and a label repeating it would be a second place for it to go stale. `hsk1`
   * does not name itself, so an HSK pack declares `{ hsk1: 'HSK 1' }`.
   */
  readonly levelLabels?: Readonly<Record<string, string>>;
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
  'forms',
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
  /**
   * The one level this file holds, where it holds one.
   *
   * The two biggest files are sharded by level — `sentences` is 3.6 MB and
   * `forms` 1.8 MB, 87% of the pack with `vocabulary` — because a course is a
   * level *ceiling*, so an A1 learner has no use for the B1 corpus at boot
   * (`docs/tasks/language-matrix.md` §5). This is what lets a loader decide that
   * without reading the file first.
   *
   * Absent means "not sharded, load it always": the skills, the lexemes, the
   * passages and the translations, none of which is big enough to be worth
   * splitting, and the last of which carries no level of its own — a translation
   * references an item, a lexeme or a skill, so its level is a join rather than
   * a field.
   */
  readonly level?: Level;
}

/** A fully loaded pack, before normalisation into the repository index. */
export interface ContentPack {
  readonly manifest: PackManifest;
  readonly items: readonly LearningItem[];
  readonly lexemes: readonly Lexeme[];
  readonly senses: readonly Sense[];
  readonly forms: readonly InflectedForm[];
  readonly skills: readonly Skill[];
  readonly translations: readonly Translation[];
  readonly passages: readonly Passage[];
  readonly audio: readonly AudioClip[];
}
