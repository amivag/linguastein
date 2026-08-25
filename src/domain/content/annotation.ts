/**
 * Linguistic annotation (spec §15).
 *
 * Tokens carry local IDs (`t1`, `t2`, …) and their array order carries the
 * sequence. Character offsets are never stored — they are derived at render
 * time when highlighting is needed (Rule 3).
 */

import type { LexemeId, SkillId } from './ids';

/** Universal Dependencies POS tags (spec §15.2). */
export const POS_TAGS = [
  'NOUN',
  'VERB',
  'ADJ',
  'ADV',
  'PRON',
  'DET',
  'ADP',
  'AUX',
  'CCONJ',
  'SCONJ',
  'NUM',
  'PART',
  'INTJ',
  'PROPN',
  'PUNCT',
  'X',
] as const;
export type PartOfSpeech = (typeof POS_TAGS)[number];

/**
 * The parts of speech a learner picks a *set* of words by — "the verbs", "the
 * nouns" — rather than the full tag inventory.
 *
 * The open classes plus numerals. Determiners, prepositions, pronouns and
 * conjunctions are a closed handful each, met inside phrases rather than
 * studied as a batch, and offering them as a category would put `de` and `el`
 * at the head of a list of thousands. Which of these a picker actually shows is
 * still derived from the packs: an empty one is dropped, exactly as an empty
 * topic is.
 */
export const STUDYABLE_POS = ['VERB', 'NOUN', 'ADJ', 'ADV', 'NUM'] as const;
export type StudyablePos = (typeof STUDYABLE_POS)[number];

/**
 * How a part of speech is spelled in a URL or a link: `verb`, `adj`.
 *
 * Both directions live here for the reason `session-url.ts` records about
 * itself — a slug written by one hand and read by another is a slug that can go
 * stale. The lowercased tag *is* the spelling, so there is no table to keep in
 * step with `POS_TAGS`.
 */
export function posSlug(pos: PartOfSpeech): string {
  return pos.toLowerCase();
}

export function posFromSlug(slug: string): PartOfSpeech | undefined {
  const wanted = slug.trim().toLowerCase();
  return POS_TAGS.find((tag) => posSlug(tag) === wanted);
}

export const MOODS = ['indicative', 'subjunctive', 'imperative', 'conditional'] as const;
export type Mood = (typeof MOODS)[number];

export const TENSES = [
  'present',
  'preterite',
  'imperfect',
  'future',
  'present-perfect',
  'past-perfect',
  'conditional',
] as const;
export type Tense = (typeof TENSES)[number];

export const VERB_FORMS = ['finite', 'infinitive', 'gerund', 'participle'] as const;
export type VerbFormType = (typeof VERB_FORMS)[number];

export type GrammaticalPerson = 1 | 2 | 3;
export type GrammaticalNumber = 'singular' | 'plural';
export type Gender = 'masculine' | 'feminine' | 'neuter';

/**
 * Grammatical case. Empty for Spanish, which is why it is here before there is
 * a language that fills it.
 *
 * The union is the two inventories the planned languages need — German's four
 * and Greek's four, overlapping in three — rather than a universal set, because
 * a list nobody can enumerate is a `string`. A language module declares which of
 * these it uses, exactly as it declares its tenses; a language that inflects for
 * none simply never sets the field.
 *
 * It is here rather than added with the pack that needs it because `Morphology`
 * is TSV schema: a field added afterwards has to be back-filled across every
 * authored row, while an optional one added now costs nothing and is ignored by
 * every language that has no cases. See `docs/tasks/second-language.md` §4.
 */
export const CASES = ['nominative', 'accusative', 'dative', 'genitive', 'vocative'] as const;
export type GrammaticalCase = (typeof CASES)[number];

/** Open-ended morphology bag; all fields optional because data is incremental. */
export interface Morphology {
  readonly person?: GrammaticalPerson;
  readonly number?: GrammaticalNumber;
  readonly gender?: Gender;
  readonly tense?: Tense;
  readonly mood?: Mood;
  readonly verbForm?: VerbFormType;
  readonly case?: GrammaticalCase;
  readonly degree?: 'positive' | 'comparative' | 'superlative';
  /** Politeness/address distinction, e.g. `tu` vs `usted`. */
  readonly formality?: 'informal' | 'formal';
}

/** Local, item-scoped token identifier such as `t1`. */
export type TokenId = string;

export interface Token {
  readonly id: TokenId;
  readonly text: string;
  /**
   * How the surface is read in a script the learner can already decode:
   * romanisation, transliteration, furigana. See {@link LearningItem.reading}.
   */
  readonly reading?: string;
  readonly lemma?: string;
  readonly pos?: PartOfSpeech;
  readonly morph?: Morphology;
  /** Link to the canonical lexeme when known. */
  readonly lexeme?: LexemeId;
}

export const ANNOTATION_TYPES = ['construction', 'grammar', 'collocation', 'note'] as const;
export type AnnotationType = (typeof ANNOTATION_TYPES)[number];

/**
 * Spans one or more tokens and optionally links to a trainable skill or a
 * dictionary entry.
 *
 * {@link lexeme} is how a **multi-word lexeme** is expressed, and the reason it
 * is here rather than on {@link Token}. A phrasal verb is one headword spread
 * over tokens that need not touch: `look up` is a dictionary entry meaning
 * "search for", and `look it up` puts a pronoun in the middle of it. Spanish
 * never forced the question — the shipped pack has exactly one multi-word lexeme
 * (`por qué`) and it is contiguous — so the model has assumed one lexeme per
 * token, and English breaks that on a word a learner meets in week one.
 *
 * `Token.lexeme` is the wrong home for it. Pointing both `look` and `up` at
 * `lexeme:look-up` makes a token answer "what unit am I part of" instead of
 * "what word am I", so tapping `look` would stop reaching `look`. A span that
 * names a lexeme keeps both answers: the tokens say what the words are, the
 * annotation says what they are together.
 *
 * This is also not a {@link Skill}. `tener que + infinitivo` is a pattern —
 * how the language works — and the pack correctly models the twelve of those as
 * skills. `look up` is not a pattern but a meaning, and only a lexeme can carry
 * one: `Sense` hangs off a `LexemeId`, so a phrasal verb filed as a skill could
 * never be glossed, which is the whole thing a learner tapping it wants.
 *
 * `collocation` is the {@link AnnotationType} for this and has been declared and
 * unused since the type existed; all 398 annotations the pack ships are
 * `construction`. Nothing reads the field yet, deliberately — see
 * `docs/tasks/language-matrix.md` §4. It is invisible while missing and a
 * back-fill across every authored row once it is late.
 */
export interface Annotation {
  readonly tokens: readonly TokenId[];
  readonly type: AnnotationType;
  readonly skill?: SkillId;
  /** The headword this span *is*, when the span is a multi-word lexeme. */
  readonly lexeme?: LexemeId;
  readonly label?: string;
}

/** Derives character offsets for rendering. Presentation data, never stored. */
export interface TokenSpan {
  readonly id: TokenId;
  readonly start: number;
  readonly end: number;
}

export function deriveTokenSpans(text: string, tokens: readonly Token[]): readonly TokenSpan[] {
  const spans: TokenSpan[] = [];
  let cursor = 0;
  for (const token of tokens) {
    const start = text.indexOf(token.text, cursor);
    if (start === -1) continue;
    const end = start + token.text.length;
    spans.push({ id: token.id, start, end });
    cursor = end;
  }
  return spans;
}
