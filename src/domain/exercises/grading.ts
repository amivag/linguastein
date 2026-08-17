/**
 * Turning an interaction into a grade. Machine-checkable exercises grade
 * themselves; audio-first ones are self-rated by the learner (spec §4.2).
 */

import { normalise } from '../content';
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
      const correct =
        built.length === exercise.solution.length &&
        built.every((word, index) => normalise(word) === normalise(exercise.solution[index] ?? ''));
      return {
        correct,
        grade: correct ? gradeFromLatency(answer) : 'again',
        expected: exercise.solution.join(' '),
      };
    }
    case 'listen-repeat':
    case 'reveal':
    case 'think-say':
      // Self-rated: the learner supplies the grade directly.
      return null;
  }
}

/** Fast and unhinted answers count as `easy`; hesitant ones as `hard`. */
function gradeFromLatency(answer: Answer): ReviewGrade {
  if ((answer.hintsUsed ?? 0) > 0) return 'hard';
  if (answer.latencyMs === undefined) return 'good';
  if (answer.latencyMs < 3000) return 'easy';
  if (answer.latencyMs > 12000) return 'hard';
  return 'good';
}
