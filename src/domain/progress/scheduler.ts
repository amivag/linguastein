/**
 * Review scheduling.
 *
 * v0.1 uses a deliberately small interval ladder rather than a full SRS
 * algorithm. `Scheduler` is the seam: swapping in SM-2/FSRS later means adding
 * an implementation here, not changing the session planner, the UI or the
 * stored shape of `ItemProgress`.
 */

import { type ItemProgress, type ItemStatus, type ReviewGrade, type Timestamp } from './types';

export interface Scheduler {
  readonly id: string;
  review(progress: ItemProgress, grade: ReviewGrade, now: Timestamp): ItemProgress;
}

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/** Interval per streak length, in milliseconds. The last entry repeats. */
const LADDER = [10 * MINUTE, 1 * DAY, 3 * DAY, 7 * DAY, 16 * DAY, 35 * DAY] as const;

const GRADE_WEIGHT: Record<ReviewGrade, number> = {
  again: 1,
  hard: 0.6,
  good: 0.25,
  easy: 0,
};

const GRADE_FACTOR: Record<ReviewGrade, number> = {
  again: 0,
  hard: 0.6,
  good: 1,
  easy: 1.6,
};

export const ladderScheduler: Scheduler = {
  id: 'ladder-v1',
  review(progress, grade, now) {
    const failed = grade === 'again';
    const streak = failed ? 0 : progress.streak + 1;
    const attempts = progress.attempts + 1;

    // Exponential smoothing keeps difficulty responsive but not jumpy.
    const difficulty = round2(progress.difficulty * 0.7 + GRADE_WEIGHT[grade] * 0.3);
    const base = LADDER[Math.min(streak, LADDER.length - 1)] ?? (LADDER.at(-1) as number);
    const interval = failed
      ? LADDER[0]!
      : Math.round(base * GRADE_FACTOR[grade] * (1.3 - difficulty));

    return {
      ...progress,
      attempts,
      correct: progress.correct + (failed ? 0 : 1),
      incorrect: progress.incorrect + (failed ? 1 : 0),
      streak,
      difficulty,
      status: nextStatus(streak, difficulty),
      lastReviewedAt: now,
      dueAt: now + Math.max(interval, MINUTE),
    };
  },
};

function nextStatus(streak: number, difficulty: number): ItemStatus {
  if (streak === 0) return 'learning';
  if (streak >= 4 && difficulty < 0.3) return 'mastered';
  if (streak >= 2) return 'review';
  return 'learning';
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
