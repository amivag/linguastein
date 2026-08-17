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

/** Open-ended morphology bag; all fields optional because data is incremental. */
export interface Morphology {
  readonly person?: GrammaticalPerson;
  readonly number?: GrammaticalNumber;
  readonly gender?: Gender;
  readonly tense?: Tense;
  readonly mood?: Mood;
  readonly verbForm?: VerbFormType;
  readonly degree?: 'positive' | 'comparative' | 'superlative';
  /** Politeness/address distinction, e.g. `tu` vs `usted`. */
  readonly formality?: 'informal' | 'formal';
}

/** Local, item-scoped token identifier such as `t1`. */
export type TokenId = string;

export interface Token {
  readonly id: TokenId;
  readonly text: string;
  readonly lemma?: string;
  readonly pos?: PartOfSpeech;
  readonly morph?: Morphology;
  /** Link to the canonical lexeme when known. */
  readonly lexeme?: LexemeId;
}

export const ANNOTATION_TYPES = ['construction', 'grammar', 'collocation', 'note'] as const;
export type AnnotationType = (typeof ANNOTATION_TYPES)[number];

/** Spans one or more tokens and optionally links to a trainable skill. */
export interface Annotation {
  readonly tokens: readonly TokenId[];
  readonly type: AnnotationType;
  readonly skill?: SkillId;
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
