/**
 * Spaced repetition on the FSRS model.
 *
 * The interval ladder this replaces asked the same question of every item: it
 * gave `agua` and `¿Tienes tiempo?` identical schedules regardless of how hard
 * each actually was for the learner. FSRS models two things per item instead —
 * how *stable* the memory is (how long until recall decays to the target) and
 * how *difficult* the material is — and derives the interval from them. In
 * practice that means roughly the same retention for materially fewer reviews.
 *
 * This implements the FSRS model shape — power forgetting curve, stability and
 * difficulty updates — with the published default weights. It is not a
 * per-user parameter fit: FSRS's own optimiser trains weights on review logs,
 * which is a later job for the attempt history we already store. The tests
 * assert the behaviour that matters (intervals grow, lapses shorten them,
 * harder items are scheduled sooner) rather than exact constants.
 */

import { type ItemProgress, type ItemStatus, type ReviewGrade, type Timestamp } from './types';
import type { Scheduler } from './scheduler';

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/** Forgetting curve exponent and the factor that makes R(S days) = 0.9. */
const DECAY = -0.5;
const FACTOR = 19 / 81;

/** Retention the schedule aims for. 0.9 is FSRS's default and a sane default here. */
const REQUEST_RETENTION = 0.9;

/** Published FSRS-4.5 default weights, used until per-user fitting exists. */
const W = [
  0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072,
  0.0793, 0.3246, 1.587, 0.2272, 2.8755,
] as const;

const MIN_STABILITY = 0.1;
const MAX_INTERVAL_DAYS = 365;
/** A lapsed item comes back inside the same session, as Anki-style relearning. */
const RELEARN_DELAY = 10 * MINUTE;

const GRADE_VALUES: Record<ReviewGrade, 1 | 2 | 3 | 4> = {
  again: 1,
  hard: 2,
  good: 3,
  easy: 4,
};

/** Probability of recall after `elapsedDays` given a memory of `stability` days. */
export function retrievability(elapsedDays: number, stability: number): number {
  if (stability <= 0) return 0;
  return (1 + (FACTOR * elapsedDays) / stability) ** DECAY;
}

/** Days until retrievability falls to the requested retention. */
export function intervalDays(stability: number, retention = REQUEST_RETENTION): number {
  return (stability / FACTOR) * (retention ** (1 / DECAY) - 1);
}

/** `ItemProgress.difficulty` is normalised 0–1 for the UI; FSRS works on 1–10. */
const toFsrsDifficulty = (normalised: number) => clamp(1 + 9 * normalised, 1, 10);
const toNormalised = (difficulty: number) => round2((clamp(difficulty, 1, 10) - 1) / 9);

export const fsrsScheduler: Scheduler = {
  id: 'fsrs-v1',

  review(progress, grade, now) {
    const g = GRADE_VALUES[grade];
    const failed = grade === 'again';
    const first = progress.attempts === 0 || progress.stability === undefined;

    const difficulty = first
      ? initialDifficulty(g)
      : nextDifficulty(toFsrsDifficulty(progress.difficulty), g);

    const stability = first
      ? initialStability(g)
      : nextStability(progress, toFsrsDifficulty(progress.difficulty), grade, now);

    const interval = failed ? RELEARN_DELAY : Math.round(intervalDays(stability)) * DAY;
    const streak = failed ? 0 : progress.streak + 1;

    return {
      ...progress,
      attempts: progress.attempts + 1,
      correct: progress.correct + (failed ? 0 : 1),
      incorrect: progress.incorrect + (failed ? 1 : 0),
      streak,
      stability: round2(stability),
      difficulty: toNormalised(difficulty),
      status: statusFor(stability, streak, failed),
      lastReviewedAt: now,
      dueAt: now + clamp(interval, RELEARN_DELAY, MAX_INTERVAL_DAYS * DAY),
    };
  },
};

function initialStability(grade: number): number {
  return Math.max(W[grade - 1] ?? W[2]!, MIN_STABILITY);
}

function initialDifficulty(grade: number): number {
  return clamp(W[4]! - (grade - 3) * W[5]!, 1, 10);
}

/** Difficulty drifts with performance but reverts towards the "easy" anchor. */
function nextDifficulty(difficulty: number, grade: number): number {
  const adjusted = difficulty - W[6]! * (grade - 3);
  const reverted = W[7]! * initialDifficulty(4) + (1 - W[7]!) * adjusted;
  return clamp(reverted, 1, 10);
}

function nextStability(
  progress: ItemProgress,
  difficulty: number,
  grade: ReviewGrade,
  now: Timestamp,
): number {
  const stability = Math.max(progress.stability ?? MIN_STABILITY, MIN_STABILITY);
  const elapsedDays = progress.lastReviewedAt
    ? Math.max(0, (now - progress.lastReviewedAt) / DAY)
    : 0;
  const recall = retrievability(elapsedDays, stability);

  if (grade === 'again') {
    // A lapse does not reset the memory to zero; it shortens it.
    const lapsed =
      W[11]! *
      difficulty ** -W[12]! *
      ((stability + 1) ** W[13]! - 1) *
      Math.exp(W[14]! * (1 - recall));
    return clamp(lapsed, MIN_STABILITY, stability);
  }

  // Reviewing an item you had almost forgotten strengthens it more than
  // reviewing one you still knew well — the spacing effect, in a formula.
  const growth =
    Math.exp(W[8]!) *
    (11 - difficulty) *
    stability ** -W[9]! *
    (Math.exp(W[10]! * (1 - recall)) - 1) *
    (grade === 'hard' ? W[15]! : 1) *
    (grade === 'easy' ? W[16]! : 1);

  return Math.max(stability * (1 + growth), stability);
}

function statusFor(stability: number, streak: number, failed: boolean): ItemStatus {
  // One correct answer is not yet learning something: an item stays in
  // learning until it has survived a second, spaced encounter.
  if (failed || stability < 1 || streak < 2) return 'learning';
  if (stability >= 21 && streak >= 3) return 'mastered';
  return 'review';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
