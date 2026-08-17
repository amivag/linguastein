/**
 * Pure transitions of learner state. The store persists whatever these return;
 * it never computes progress itself.
 */

import type { ItemId } from '../content';
import type { ExerciseKind } from '../exercises/types';
import { ladderScheduler, type Scheduler } from './scheduler';
import {
  isDue,
  newItemProgress,
  type Attempt,
  type ItemProgress,
  type ReviewGrade,
  type Timestamp,
} from './types';

export interface AttemptInput {
  readonly itemId: ItemId;
  readonly exerciseKind: ExerciseKind;
  readonly grade: ReviewGrade;
  readonly correct?: boolean;
  readonly latencyMs?: number;
  readonly hintsUsed?: number;
  readonly sessionId?: string;
}

export interface RecordedAttempt {
  readonly progress: ItemProgress;
  readonly attempt: Attempt;
}

export function recordAttempt(
  current: ItemProgress | undefined,
  input: AttemptInput,
  now: Timestamp,
  scheduler: Scheduler = ladderScheduler,
): RecordedAttempt {
  const previous = current ?? newItemProgress(input.itemId);
  const reviewed = scheduler.review(previous, input.grade, now);

  const progress: ItemProgress = {
    ...reviewed,
    hintsUsed: previous.hintsUsed + (input.hintsUsed ?? 0),
    ...(input.latencyMs !== undefined
      ? { averageLatencyMs: smoothLatency(previous.averageLatencyMs, input.latencyMs) }
      : {}),
  };

  const attempt: Attempt = {
    id: `${input.itemId}@${now}`,
    itemId: input.itemId,
    exerciseKind: input.exerciseKind,
    grade: input.grade,
    at: now,
    ...(input.correct !== undefined ? { correct: input.correct } : {}),
    ...(input.latencyMs !== undefined ? { latencyMs: input.latencyMs } : {}),
    ...(input.hintsUsed !== undefined ? { hintsUsed: input.hintsUsed } : {}),
    ...(input.sessionId !== undefined ? { sessionId: input.sessionId } : {}),
  };

  return { progress, attempt };
}

export interface ProgressSummary {
  readonly total: number;
  readonly seen: number;
  readonly due: number;
  readonly learning: number;
  readonly review: number;
  readonly mastered: number;
}

export function summarise(
  known: readonly ItemProgress[],
  totalItems: number,
  now: Timestamp,
): ProgressSummary {
  let due = 0;
  let learning = 0;
  let review = 0;
  let mastered = 0;
  for (const progress of known) {
    if (isDue(progress, now)) due++;
    if (progress.status === 'learning') learning++;
    if (progress.status === 'review') review++;
    if (progress.status === 'mastered') mastered++;
  }
  return { total: totalItems, seen: known.length, due, learning, review, mastered };
}

function smoothLatency(previous: number | undefined, latencyMs: number): number {
  if (previous === undefined) return latencyMs;
  return Math.round(previous * 0.7 + latencyMs * 0.3);
}
