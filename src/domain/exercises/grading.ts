/**
 * Turning an interaction into a grade. Machine-checkable exercises grade
 * themselves; audio-first ones are self-rated by the learner (spec §4.2).
 */

import { normalise, splitWords } from '../content';
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
}

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
    case 'listen-repeat':
    case 'reveal':
    case 'think-say':
      // Self-rated: the learner supplies the grade directly.
      return null;
  }
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
