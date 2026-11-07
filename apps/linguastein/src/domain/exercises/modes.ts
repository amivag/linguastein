/**
 * Retrieval modes, and which one an exercise kind is evidence of.
 *
 * This vocabulary used to live in `sessions/composer.ts`, which is where it is
 * *used* to plan a session. It is here because it is a statement about exercise
 * kinds rather than about sessions, and because `progress/` has to read it:
 * `SubjectProgress.evidence` is keyed by mode, and `progress` importing
 * `sessions` would be a cycle while `progress` importing `exercises` is a
 * dependency that already exists (`Attempt.exerciseKind`).
 *
 * The two directions are not symmetrical, and the asymmetry is the point —
 * see {@link modeOfKind}.
 */

import { EXERCISE_KINDS, type ExerciseKind } from './types';

export const RETRIEVAL_MODES = ['recognition', 'cued-recall', 'production', 'study'] as const;
export type RetrievalMode = (typeof RETRIEVAL_MODES)[number];

/**
 * The modes an attempt can be evidence of, **weakest first**.
 *
 * The order is load-bearing twice over: it is the ladder a learner climbs, and
 * it is what {@link modeOfKind} means by "weakest". `study` is not here because
 * a study session records nothing at all — there is no such thing as evidence
 * from one, and leaving it in the type would invite a caller to write a
 * progress row that says there is.
 */
export const GRADED_MODES = ['recognition', 'cued-recall', 'production'] as const;
export type GradedMode = (typeof GRADED_MODES)[number];

/** Exercise kinds that realise each mode, hardest-first within the mode. */
export const MODE_KINDS: Record<RetrievalMode, readonly ExerciseKind[]> = {
  recognition: ['multiple-choice', 'reveal'],
  'cued-recall': ['cloze-choice', 'tap-to-build', 'multiple-choice'],
  production: ['type-it', 'think-say', 'listen-repeat'],
  study: ['reveal', 'listen-repeat'],
};

/**
 * Which retrieval mode an exercise kind is evidence of.
 *
 * Derived from {@link MODE_KINDS} rather than written beside it, because a
 * second hand-maintained table is how a kind ends up in one list and not the
 * other.
 *
 * **A kind claimed by several modes resolves to the weakest of them**, and that
 * is the whole of what stops this inflating the ladder it exists to gate.
 * `MODE_KINDS` is a *preference order for offering* an exercise, so a harder
 * mode lists easier kinds as fallbacks for items that support nothing better —
 * `multiple-choice` is the last entry under `cued-recall` for exactly that
 * reason. Reading that membership as a claim would make the commonest
 * recognition exercise in the app count as evidence of cued recall, which is the
 * bug this module was written to close rather than a detail of it.
 *
 * `study` is excluded before the search, so a kind that only ever appears under
 * `study` would be unclaimed — `unclaimedKinds` is what refuses that in a test.
 */
export function modeOfKind(kind: ExerciseKind): GradedMode {
  const mode = GRADED_MODES.find((candidate) => MODE_KINDS[candidate].includes(kind));
  // Unreachable while the test below passes; `recognition` rather than a throw
  // because a kind the tables have not caught up with must not stop practice.
  return mode ?? 'recognition';
}

/**
 * Exercise kinds no graded mode claims.
 *
 * Exported for the test that asserts it is empty. A kind added to
 * `EXERCISE_KINDS` and to no mode would otherwise silently record every attempt
 * on it as recognition, which is a lie the type system cannot catch.
 */
export function unclaimedKinds(): readonly ExerciseKind[] {
  return EXERCISE_KINDS.filter(
    (kind) => !GRADED_MODES.some((mode) => MODE_KINDS[mode].includes(kind)),
  );
}

/** Where a mode sits on the ladder. `-1` for `study`, which is not on it. */
export function rungOf(mode: RetrievalMode): number {
  return GRADED_MODES.indexOf(mode as GradedMode);
}
