/**
 * Turning an interaction into a grade. Machine-checkable exercises grade
 * themselves; audio-first ones are self-rated by the learner (spec §4.2).
 */

import { normalise, splitWords, type LanguageTag } from '../content';
import type { ReviewGrade } from '../progress';
import type { Exercise } from './types';

export interface Answer {
  /** Chosen choice id, typed text, or the ordered parts for tap-to-build. */
  readonly value: string | readonly string[];
  readonly latencyMs?: number;
  readonly hintsUsed?: number;
}

export interface GradeResult {
  readonly correct: boolean;
  readonly grade: ReviewGrade;
  readonly expected: string;
  /** How close a typed answer was. Absent for every other kind. */
  readonly verdict?: TypedVerdict;
}

/**
 * A typed answer is not a boolean, and the middle value is the reason this kind
 * can exist on a phone at all.
 *
 * `near` is an answer that matches once the written accents are set aside.
 * Marking it wrong punishes a learner who knew the tense for a keyboard they do
 * not have; marking it right teaches that Spanish accents are decoration, when
 * `él`/`el` and `té`/`te` are different words — `content/es/stem-collisions.tsv`
 * records eight such pairs the pack has already hit. So it counts, it schedules
 * sooner, and the feedback says which mark was missing.
 */
export type TypedVerdict = 'exact' | 'near' | 'wrong';

export function gradeExercise(exercise: Exercise, answer: Answer): GradeResult | null {
  switch (exercise.kind) {
    case 'multiple-choice':
    case 'cloze-choice': {
      const chosen = exercise.choices.find((choice) => choice.id === answer.value);
      const expected = exercise.choices.find((choice) => choice.correct)?.text ?? '';
      const correct = chosen?.correct === true;
      return { correct, grade: correct ? gradeFromLatency(answer) : 'again', expected };
    }
    case 'tap-to-build': {
      const built = Array.isArray(answer.value) ? answer.value : [answer.value];
      const correct = sameWords(built, exercise.solution);
      // The sentence as it is actually written, rather than the solution joined
      // by spaces: the words are what was graded, but `Abre la boca , por favor .`
      // is not how anyone would show someone what they should have built.
      return {
        correct,
        grade: correct ? gradeFromLatency(answer) : 'again',
        expected: exercise.item.text,
      };
    }
    case 'type-it': {
      const written = typeof answer.value === 'string' ? answer.value : answer.value.join(' ');
      const verdict = compareTyped(written, exercise.answer, exercise.answerLanguage);
      return {
        // A missing accent is an answer the learner got right; `verdict` is what
        // carries the part they did not, so the summary counts it and the card
        // still says what was missing.
        correct: verdict !== 'wrong',
        grade:
          verdict === 'exact' ? gradeFromLatency(answer) : verdict === 'near' ? 'hard' : 'again',
        expected: exercise.answer,
        verdict,
      };
    }
    case 'listen-repeat':
    case 'reveal':
    case 'think-say':
      // Self-rated: the learner supplies the grade directly.
      return null;
  }
}

/**
 * How close a typed answer is: exact, accents aside, or wrong.
 *
 * Case and punctuation never count. A learner typing `tengo que trabajar` for
 * `Tengo que trabajar.` has produced the sentence, and a capital letter is not
 * what the card is asking about.
 *
 * **Whether a mark is an accent or a letter is asked of the locale, not decided
 * here.** `hablé`/`hable` differ by an accent and `año`/`ano` differ by a
 * letter, and nothing about the characters says which is which — stripping
 * every combining mark would accept `ano` for `año`, the exact accident
 * `src/languages/es/orthography.ts` exists to record. A collator at `sensitivity:
 * 'base'` knows, because CLDR knows: in `es` it equates `hable` with `hablé` and
 * separates `cana` from `caña`, while in `en` it equates both. That keeps the
 * engine free of any claim about Spanish (architecture rule 1) while still
 * getting Spanish right — and a language whose tag is missing simply compares
 * the marks as written, which is strict rather than wrong.
 */
export function compareTyped(
  written: string,
  expected: string,
  language?: LanguageTag,
): TypedVerdict {
  const left = splitWords(written);
  const right = splitWords(expected);
  if (left.length !== right.length) return 'wrong';

  const caseOnly = new Intl.Collator(language, { sensitivity: 'accent' });
  if (left.every((word, index) => caseOnly.compare(word, right[index] ?? '') === 0)) return 'exact';

  if (language === undefined) return 'wrong';
  const accentBlind = new Intl.Collator(language, { sensitivity: 'base' });
  return left.every((word, index) => accentBlind.compare(word, right[index] ?? '') === 0)
    ? 'near'
    : 'wrong';
}

/**
 * Word-for-word equality, ignoring case, accents and punctuation.
 *
 * Word order is what tap-to-build asks for, so it is the only thing it grades.
 * A comma is not a tile a learner is offered any more, and marking someone
 * wrong for one they were never given was the bug this closes.
 */
function sameWords(built: readonly string[], solution: readonly string[]): boolean {
  const left = built.flatMap((part) => splitWords(normalise(part)));
  const right = solution.flatMap((part) => splitWords(normalise(part)));
  return left.length === right.length && left.every((word, index) => word === right[index]);
}

/** Fast and unhinted answers count as `easy`; hesitant ones as `hard`. */
function gradeFromLatency(answer: Answer): ReviewGrade {
  if ((answer.hintsUsed ?? 0) > 0) return 'hard';
  if (answer.latencyMs === undefined) return 'good';
  if (answer.latencyMs < 3000) return 'easy';
  if (answer.latencyMs > 12000) return 'hard';
  return 'good';
}
