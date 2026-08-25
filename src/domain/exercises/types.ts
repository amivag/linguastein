/**
 * Exercises are generated from content, never stored alongside it (Rule 2).
 * `Tengo que trabajar.` is one item; listen-and-repeat, reveal, think-and-say
 * and multiple-choice are four views of that same item.
 */

import type { ItemId, LanguageTag, LearningItem, Translation } from '../content';

export const EXERCISE_KINDS = [
  'listen-repeat',
  'reveal',
  'think-say',
  'multiple-choice',
  'cloze-choice',
  'tap-to-build',
] as const;
export type ExerciseKind = (typeof EXERCISE_KINDS)[number];

interface ExerciseBase {
  /** Deterministic per (item, kind) so a session can be replayed/resumed. */
  readonly id: string;
  readonly kind: ExerciseKind;
  readonly item: LearningItem;
  /** Reference-language translation used for prompts/answers, if available. */
  readonly translation?: Translation;
}

/** Hear it, say it back. The default audio-first loop (spec §4.1). */
export interface ListenRepeatExercise extends ExerciseBase {
  readonly kind: 'listen-repeat';
}

/** Show the target text, reveal the meaning on demand (spec §4.2 study mode). */
export interface RevealExercise extends ExerciseBase {
  readonly kind: 'reveal';
}

/** Prompt in the reference language, produce the target language aloud (spec §4.3). */
export interface ThinkSayExercise extends ExerciseBase {
  readonly kind: 'think-say';
  readonly prompt: string;
  readonly answer: string;
}

export interface Choice {
  readonly id: string;
  readonly text: string;
  readonly correct: boolean;
  /** Item the distractor came from, for post-answer explanation. */
  readonly sourceItem?: ItemId;
}

/** Recognition with plausible distractors drawn from the same dataset (spec §4.4). */
export interface MultipleChoiceExercise extends ExerciseBase {
  readonly kind: 'multiple-choice';
  readonly prompt: string;
  /**
   * The language the prompt is in, for the `lang` a renderer tags it with.
   *
   * Absent when the item's pack is not loaded, which is the same honest answer
   * `useTargetLanguage` gives: no attribute leaves the document language in
   * charge, while a guessed one asserts something false. It was the literal
   * `'es'` until 2026-08-25 — the one place the pass that removed `lang="es"`
   * from twenty elements did not reach, because nothing reads it yet.
   */
  readonly promptLanguage?: LanguageTag;
  readonly choices: readonly Choice[];
}

/** One blanked token, answered by tapping a choice (spec §4.5). */
export interface ClozeChoiceExercise extends ExerciseBase {
  readonly kind: 'cloze-choice';
  /** Item text with the blank rendered as `___`. */
  readonly prompt: string;
  readonly blankTokenId: string;
  readonly choices: readonly Choice[];
}

/** Rebuild the sentence by tapping words in order (spec §4.6). */
export interface TapToBuildExercise extends ExerciseBase {
  readonly kind: 'tap-to-build';
  readonly prompt: string;
  /** Shuffled words, including a few distractors. */
  readonly parts: readonly string[];
  readonly solution: readonly string[];
}

export type Exercise =
  | ListenRepeatExercise
  | RevealExercise
  | ThinkSayExercise
  | MultipleChoiceExercise
  | ClozeChoiceExercise
  | TapToBuildExercise;

export type ExerciseOf<K extends ExerciseKind> = Extract<Exercise, { kind: K }>;

/** True for exercises the engine can grade itself; the rest are self-rated. */
export function isSelfRated(kind: ExerciseKind): boolean {
  return kind === 'listen-repeat' || kind === 'reveal' || kind === 'think-say';
}
