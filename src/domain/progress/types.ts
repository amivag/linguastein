/**
 * Learner state (spec §8). Kept strictly separate from content: progress
 * records only reference stable IDs, so datasets can be updated, replaced or
 * extended without invalidating what the learner has done.
 */

import { packIdOf, type ItemId, type PackId } from '../content';
import type { ExerciseKind } from '../exercises/types';

export const ITEM_STATUSES = ['new', 'learning', 'review', 'mastered'] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const REVIEW_GRADES = ['again', 'hard', 'good', 'easy'] as const;
export type ReviewGrade = (typeof REVIEW_GRADES)[number];

/** Epoch milliseconds. Stored as numbers so records survive JSON round-trips. */
export type Timestamp = number;

export interface ItemProgress {
  readonly itemId: ItemId;
  /**
   * The pack the item belongs to, derived from its id rather than new
   * information — `packIdOf('core-es:item:000123')`.
   *
   * Stored because an IndexedDB index is built from a stored key path and
   * nothing else: "how much of the French course have I done?" cannot be asked
   * of a value computed in memory, and answering it by materialising every item
   * id in the course is what every screen does today. The record still
   * *references* only the item (architecture rule 4) — this is the same fact,
   * written where the database can group by it.
   *
   * Absent only where the id does not parse, which is also the one case where
   * there is no honest answer.
   */
  readonly packId?: PackId;
  readonly status: ItemStatus;
  readonly attempts: number;
  readonly correct: number;
  readonly incorrect: number;
  /** 0 (effortless) … 1 (very hard). FSRS difficulty, normalised for display. */
  readonly difficulty: number;
  /**
   * Days until recall of this item decays to the target retention. The core
   * FSRS quantity: absent on records written before scheduling was upgraded,
   * in which case the next review initialises it.
   */
  readonly stability?: number;
  readonly lastReviewedAt?: Timestamp;
  readonly dueAt?: Timestamp;
  /** Rolling mean answer latency, used later for fluency work. */
  readonly averageLatencyMs?: number;
  readonly hintsUsed: number;
  /** Consecutive non-`again` grades; gates the learning → review → mastered status. */
  readonly streak: number;
  /**
   * When this record was last written. Distinct from `lastReviewedAt`, which is
   * a statement about the learner: this one is about the row, and it is what a
   * merge of two devices has to compare. Nothing can reconstruct it afterwards,
   * which is why it is here before there is anything to merge.
   */
  readonly updatedAt: Timestamp;
}

export interface Attempt {
  readonly id: string;
  readonly itemId: ItemId;
  readonly exerciseKind: ExerciseKind;
  readonly grade: ReviewGrade;
  readonly correct?: boolean;
  readonly latencyMs?: number;
  readonly hintsUsed?: number;
  readonly at: Timestamp;
  readonly sessionId?: string;
}

/**
 * A record for an item nothing has been recorded against yet.
 *
 * `now` defaults to 0 rather than reading a clock — this module is pure, and a
 * fresh record only reaches storage through `recordAttempt`, which stamps
 * `updatedAt` with the attempt's own clock. Epoch zero is also the right answer
 * for a merge: a row nobody has written loses to one somebody has.
 */
export function newItemProgress(itemId: ItemId, now: Timestamp = 0): ItemProgress {
  const packId = packIdOf(itemId);
  return {
    itemId,
    ...(packId ? { packId } : {}),
    status: 'new',
    attempts: 0,
    correct: 0,
    incorrect: 0,
    difficulty: 0.3,
    hintsUsed: 0,
    streak: 0,
    updatedAt: now,
  };
}

export function isDue(progress: ItemProgress, now: Timestamp): boolean {
  return progress.dueAt !== undefined && progress.dueAt <= now;
}
