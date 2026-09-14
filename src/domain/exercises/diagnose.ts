/**
 * Why a typed answer was wrong — which grammatical axis slipped, not merely
 * that something did.
 *
 * `GradeResult` says `{ correct, grade, expected }`, so a learner who writes
 * `Ayer hablo con mi hermana` is shown the right sentence and left to spot the
 * difference. The same feedback serves a missed tense, a missed person and an
 * entirely wrong word, which are three different mistakes with three different
 * fixes. Stage B of `docs/tasks/typed-production.md`.
 *
 * **This turned out not to need a language module.** The brief specified a
 * `MissDiagnoser` under `src/languages/`, on the reasoning that naming a missed
 * tense means knowing how the language conjugates. It does not: a pack ships
 * `InflectedForm` records — 9,206 of them in `core-es` — each carrying a
 * {@link Morphology} whose fields (`tense`, `person`, `gender`, …) are already
 * language-neutral, and each sentence token already carries the `lexeme` the
 * build linked it to. So the whole diagnosis is a lookup and a field comparison
 * over the neutral model, and a French pack gets it for nothing. The seam is not
 * built rather than built and left empty; §3.3 of the brief records why.
 *
 * The one thing it will not do is guess. A diagnosis is offered only where both
 * spellings are known forms of the same lexeme — everything else returns `null`
 * and the card says what it says today. A missing lemma shows up in a coverage
 * report; a confidently wrong one is counted as a success.
 */

import {
  normalise,
  splitWords,
  type ContentRepository,
  type LanguageTag,
  type Morphology,
  type Token,
} from '../content';
import type { TypeItExercise } from './types';

/**
 * The grammatical axes a miss can fall on, in the order they are reported.
 *
 * Derived from {@link Morphology}'s own keys rather than invented beside them,
 * so a field added to the model cannot be silently undiagnosable. The order is
 * editorial: more than one axis can differ at once — `hablé` against `hablas` is
 * a different tense *and* a different person — and naming the tense is more use
 * than naming the person, because the tense is the choice the learner was making.
 */
export const MISS_AXES = [
  'tense',
  'mood',
  'person',
  'number',
  'gender',
  'formality',
  'verbForm',
  'case',
  'degree',
] as const satisfies readonly (keyof Morphology)[];

export type MissAxis = (typeof MISS_AXES)[number];

export interface Miss {
  /** The leading axis. `axes` carries the rest when several differ at once. */
  readonly axis: MissAxis;
  readonly axes: readonly MissAxis[];
  /** The word as written, how that spelling parses, and its value on `axis`. */
  readonly written: string;
  readonly writtenGrammar?: string;
  readonly writtenValue?: string;
  /** The word that was wanted, the same three ways. */
  readonly expected: string;
  readonly expectedGrammar?: string;
  readonly expectedValue?: string;
}

/**
 * What one wrong word in a typed answer was wrong about.
 *
 * `null` wherever the answer cannot be pinned to exactly one substituted word
 * whose two spellings the pack can both account for. That is most of the space,
 * deliberately: a learner who typed a different sentence has not made a
 * *grammatical* mistake to explain, and a pack that has never heard of the word
 * they wrote cannot say what it is.
 */
export function diagnoseMiss(
  exercise: TypeItExercise,
  written: string,
  repository: ContentRepository,
): Miss | null {
  const tokens = contentTokens(exercise);
  const writtenWords = splitWords(written);
  if (tokens.length === 0 || tokens.length !== writtenWords.length) return null;

  const slipped = soleDifference(tokens, writtenWords, exercise.answerLanguage);
  if (!slipped) return null;

  const { token, word } = slipped;
  const lexeme = token.lexeme;
  if (!lexeme) return null;

  // Both spellings must be accounted for by the *same* lexeme. A word the pack
  // cannot place is not evidence that the learner picked the wrong one — the
  // pack may simply not carry that form — so it is not reported as anything.
  const forms = repository.formsOf(lexeme);
  const target = normalise(token.text);
  const typed = normalise(word);
  const expectedForm = forms.find((form) => normalise(form.form) === target);
  const writtenForm = forms.find((form) => normalise(form.form) === typed);
  if (!expectedForm || !writtenForm) return null;

  const axes = MISS_AXES.filter((axis) => writtenForm.morph[axis] !== expectedForm.morph[axis]);
  const axis = axes[0];
  // Two distinct spellings of one lexeme that differ on no modelled axis: the
  // paradigm has a genuine variant pair, or its annotation is incomplete.
  // Either way there is nothing to name.
  if (!axis) return null;

  return {
    axis,
    axes,
    written: word,
    expected: token.text,
    ...optional('writtenGrammar', describeGrammar(writtenForm.morph)),
    ...optional('expectedGrammar', describeGrammar(expectedForm.morph)),
    ...optional('writtenValue', axisValue(writtenForm.morph, axis)),
    ...optional('expectedValue', axisValue(expectedForm.morph, axis)),
  };
}

/** The words of the answer as the pack knows them, punctuation dropped. */
function contentTokens(exercise: TypeItExercise): readonly Token[] {
  return (exercise.item.tokens ?? []).filter(
    (token) => token.pos !== 'PUNCT' && normalise(token.text).length > 0,
  );
}

/**
 * The single substituted word, or nothing.
 *
 * Compared accent-blind, because an accent-only difference is what `near`
 * already covers and is not a grammatical slip to explain. Exactly one
 * difference is the bar: two or more and there is no way to tell a mis-inflected
 * word from a different sentence, which is the case this must not guess at.
 */
function soleDifference(
  tokens: readonly Token[],
  written: readonly string[],
  language: LanguageTag | undefined,
): { readonly token: Token; readonly word: string } | null {
  const collator = new Intl.Collator(language, { sensitivity: 'base' });
  let found: { token: Token; word: string } | null = null;

  for (const [index, token] of tokens.entries()) {
    const word = written[index] ?? '';
    if (collator.compare(token.text, word) === 0) continue;
    if (found) return null;
    found = { token, word };
  }

  return found;
}

function optional<T>(key: string, value: T | undefined): Record<string, T> {
  return value === undefined ? {} : { [key]: value };
}

/**
 * A morphology as a learner-facing phrase.
 *
 * `describeMorphology` in `content/inspect.ts` is the same idea and is what the
 * word sheet shows, but it is tuned for a paradigm table — it drops `indicative`
 * as the unmarked case and collapses an imperative to its audience. Here the two
 * sides are read against each other, so the mood that was dropped is sometimes
 * the whole answer. Kept separate rather than parameterised: one caller wants
 * the short label and one wants the contrastive one.
 */
function describeGrammar(morph: Morphology): string | undefined {
  const parts: string[] = [];

  if (morph.person !== undefined) parts.push(`${PERSONS[morph.person] ?? morph.person}`);
  if (morph.number) parts.push(morph.number === 'singular' ? 'sg' : 'pl');
  if (morph.tense) parts.push(morph.tense);
  if (morph.mood) parts.push(morph.mood);
  if (morph.verbForm && morph.verbForm !== 'finite') parts.push(morph.verbForm);
  if (morph.gender) parts.push(morph.gender);
  if (morph.formality) parts.push(morph.formality);

  return parts.length > 0 ? parts.join(' · ') : undefined;
}

/**
 * One axis's value, as a word a sentence can be built round.
 *
 * The whole parse is on the record too, and it is the wrong thing to put in a
 * line of feedback: `hablo is 1st · sg · present · indicative` buries the one
 * difference among three things that were right. The named axis is what the
 * learner got wrong, so it is what the line says.
 */
function axisValue(morph: Morphology, axis: MissAxis): string | undefined {
  const value = morph[axis];
  if (value === undefined) return undefined;
  return typeof value === 'number' ? (PERSONS[value] ?? String(value)) : String(value);
}

const PERSONS: Record<number, string> = { 1: '1st', 2: '2nd', 3: '3rd' };
