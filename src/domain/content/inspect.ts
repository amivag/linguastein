/**
 * Word inspection: everything the app knows about one token of a phrase.
 *
 * This is pure derivation from stored content — meaning, grammar, the
 * construction the word takes part in, its other forms, and other phrases that
 * use it. Nothing here is stored per token; it is assembled on demand from the
 * lexeme, verb form, skill and translation records (spec §13, §14, §15).
 */

import type { Morphology, PartOfSpeech, Token, TokenId } from './annotation';
import type { ItemId, LexemeId, SkillId } from './ids';
import type { LanguageTag } from './language';
import type { LearningItem } from './model';
import type { ContentRepository } from './repository';
import { normalise } from './repository';

export interface WordConstruction {
  readonly skill?: SkillId;
  readonly label: string;
  /** Reference-language explanation, when the dataset has one. */
  readonly gloss?: string;
}

export interface WordForm {
  readonly form: string;
  /** Human-readable morphology, e.g. `2nd sg · present`. */
  readonly label: string;
  /** True for the form that appears in the phrase being inspected. */
  readonly current: boolean;
}

export interface WordExample {
  readonly id: ItemId;
  readonly text: string;
  readonly translation?: string;
}

export interface WordInfo {
  readonly token: Token;
  readonly lexeme?: LexemeId;
  readonly lemma?: string;
  readonly pos?: PartOfSpeech;
  readonly posLabel?: string;
  /** Meaning in the reference language, if known. */
  readonly gloss?: string;
  /** Grammar of this occurrence, e.g. `1st sg · present · indicative`. */
  readonly grammar?: string;
  readonly constructions: readonly WordConstruction[];
  /** Other forms of the same lexeme — the "variations" of a verb. */
  readonly forms: readonly WordForm[];
  /** Other phrases in the dataset that use this word. */
  readonly examples: readonly WordExample[];
}

export interface InspectOptions {
  readonly maxExamples?: number;
  readonly maxForms?: number;
}

/** Punctuation carries nothing worth showing, so it is never inspectable. */
export function isInspectable(token: Token): boolean {
  return token.pos !== 'PUNCT' && normalise(token.text).length > 0;
}

export function inspectToken(
  repository: ContentRepository,
  item: LearningItem,
  tokenId: TokenId,
  language: LanguageTag,
  options: InspectOptions = {},
): WordInfo | null {
  const token = (item.tokens ?? []).find((candidate) => candidate.id === tokenId);
  if (!token || !isInspectable(token)) return null;

  const lexemeId = token.lexeme;
  const lexeme = lexemeId ? repository.getLexeme(lexemeId) : undefined;
  const pos = token.pos ?? lexeme?.pos;
  const lemma = token.lemma ?? lexeme?.lemma;

  return {
    token,
    constructions: constructionsOf(repository, item, tokenId, language),
    forms: lexemeId ? formsOf(repository, lexemeId, token, options.maxForms ?? 8) : [],
    examples: lexemeId
      ? examplesOf(repository, lexemeId, item.id, language, options.maxExamples ?? 3)
      : [],
    ...(lexemeId ? { lexeme: lexemeId } : {}),
    ...(lemma ? { lemma } : {}),
    ...(pos ? { pos, posLabel: POS_LABELS[pos] } : {}),
    ...(lexemeId ? optional('gloss', glossOf(repository, lexemeId, language)) : {}),
    ...optional('grammar', describeMorphology(token.morph)),
  };
}

/** `1st sg · present · indicative` — empty when nothing is annotated. */
export function describeMorphology(morph: Morphology | undefined): string | undefined {
  if (!morph) return undefined;
  const parts: string[] = [];

  if (morph.verbForm === 'infinitive') parts.push('infinitive');
  else if (morph.verbForm === 'gerund') parts.push('gerund');
  else if (morph.verbForm === 'participle') parts.push('participle');

  const person = personLabel(morph);
  if (person) parts.push(person);
  if (morph.tense) parts.push(TENSE_LABELS[morph.tense] ?? morph.tense);
  if (morph.mood && morph.mood !== 'indicative') parts.push(morph.mood);
  if (morph.gender) parts.push(morph.gender);
  if (morph.formality) parts.push(morph.formality);

  return parts.length > 0 ? parts.join(' · ') : undefined;
}

function personLabel(morph: Morphology): string | undefined {
  if (morph.person === undefined) return morph.number ? NUMBER_LABELS[morph.number] : undefined;
  const ordinal = PERSON_LABELS[morph.person];
  const count = morph.number ? ` ${NUMBER_LABELS[morph.number]}` : '';
  return `${ordinal}${count}`;
}

function glossOf(
  repository: ContentRepository,
  lexemeId: LexemeId,
  language: LanguageTag,
): string | undefined {
  const direct = repository.translationOf(lexemeId, language);
  if (direct) return direct.text;

  // Fall back to a single-word item for the same lexeme: `cerveza` as an item
  // already carries the meaning even when the lexeme itself has no gloss.
  for (const candidate of repository.itemsOfLexeme(lexemeId)) {
    if (candidate.type !== 'word') continue;
    const translation = repository.translationOf(candidate.id, language);
    if (translation) return translation.text;
  }
  return undefined;
}

function constructionsOf(
  repository: ContentRepository,
  item: LearningItem,
  tokenId: TokenId,
  language: LanguageTag,
): readonly WordConstruction[] {
  const constructions: WordConstruction[] = [];
  for (const annotation of item.annotations ?? []) {
    if (!annotation.tokens.includes(tokenId)) continue;
    const skill = annotation.skill ? repository.getSkill(annotation.skill) : undefined;
    const label = annotation.label ?? skill?.label;
    if (!label) continue;
    const gloss = annotation.skill
      ? repository.translationOf(annotation.skill, language)?.text
      : undefined;
    constructions.push({
      label,
      ...(annotation.skill ? { skill: annotation.skill } : {}),
      ...optional('gloss', gloss),
    });
  }
  return constructions;
}

function formsOf(
  repository: ContentRepository,
  lexemeId: LexemeId,
  token: Token,
  limit: number,
): readonly WordForm[] {
  const current = normalise(token.text);
  return repository
    .verbFormsOf(lexemeId)
    .slice(0, limit)
    .map((form) => ({
      form: form.form,
      label: describeMorphology(form.morph) ?? '',
      current: normalise(form.form) === current,
    }));
}

function examplesOf(
  repository: ContentRepository,
  lexemeId: LexemeId,
  exclude: ItemId,
  language: LanguageTag,
  limit: number,
): readonly WordExample[] {
  return repository
    .itemsOfLexeme(lexemeId)
    .filter((candidate) => candidate.id !== exclude && candidate.type !== 'word')
    .slice(0, limit)
    .map((candidate) => ({
      id: candidate.id,
      text: candidate.text,
      ...optional('translation', repository.translationOf(candidate.id, language)?.text),
    }));
}

/** Omits the key entirely when the value is absent (exactOptionalPropertyTypes). */
function optional<K extends string, V>(key: K, value: V | undefined): Partial<Record<K, V>> {
  return value === undefined ? {} : ({ [key]: value } as Record<K, V>);
}

const PERSON_LABELS: Record<number, string> = { 1: '1st', 2: '2nd', 3: '3rd' };
const NUMBER_LABELS: Record<string, string> = { singular: 'sg', plural: 'pl' };

const TENSE_LABELS: Record<string, string> = {
  present: 'present',
  preterite: 'preterite',
  imperfect: 'imperfect',
  future: 'future',
  'present-perfect': 'present perfect',
  'past-perfect': 'past perfect',
  conditional: 'conditional',
};

export const POS_LABELS: Record<PartOfSpeech, string> = {
  NOUN: 'noun',
  VERB: 'verb',
  ADJ: 'adjective',
  ADV: 'adverb',
  PRON: 'pronoun',
  DET: 'determiner',
  ADP: 'preposition',
  AUX: 'auxiliary',
  CCONJ: 'conjunction',
  SCONJ: 'conjunction',
  NUM: 'numeral',
  PART: 'particle',
  INTJ: 'interjection',
  PROPN: 'proper noun',
  PUNCT: 'punctuation',
  X: 'other',
};
