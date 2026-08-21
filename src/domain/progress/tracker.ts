/**
 * Pure transitions of learner state. The store persists whatever these return;
 * it never computes progress itself.
 */

import { systemRng, token, type Rng } from '../../utils/random';
import type { ItemId } from '../content';
import type { ExerciseKind } from '../exercises/types';
import { fsrsScheduler } from './fsrs';
import type { Scheduler } from './scheduler';
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

/**
 * `rng` is here for the attempt's id and nothing else.
 *
 * The id used to be the item and the clock joined together, which is a value
 * this function could compute on its own — and two attempts on one item inside
 * the same millisecond therefore shared one id, so the store's `put` replaced
 * the first with the second. An id that a merge has to trust cannot be a pure
 * function of what it identifies. Injected rather than ambient, like all
 * randomness here, so a test can pin it.
 */
export function recordAttempt(
  current: ItemProgress | undefined,
  input: AttemptInput,
  now: Timestamp,
  scheduler: Scheduler = fsrsScheduler,
  rng: Rng = systemRng,
): RecordedAttempt {
  const previous = current ?? newItemProgress(input.itemId, now);
  const reviewed = scheduler.review(previous, input.grade, now);

  const progress: ItemProgress = {
    ...reviewed,
    hintsUsed: previous.hintsUsed + (input.hintsUsed ?? 0),
    updatedAt: now,
    ...(input.latencyMs !== undefined
      ? { averageLatencyMs: smoothLatency(previous.averageLatencyMs, input.latencyMs) }
      : {}),
  };

  const attempt: Attempt = {
    // Time-ordered so a log stays readable, and unique so two of them can be
    // merged; see the `rng` note above for why the clock alone was not enough.
    id: `${now.toString(36)}-${token(rng)}`,
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
