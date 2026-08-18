/**
 * Learner state (spec §8). Kept strictly separate from content: progress
 * records only reference stable IDs, so datasets can be updated, replaced or
 * extended without invalidating what the learner has done.
 */

import type { ItemId, SkillId } from '../content';
import type { ExerciseKind } from '../exercises/types';

export const ITEM_STATUSES = ['new', 'learning', 'review', 'mastered'] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const REVIEW_GRADES = ['again', 'hard', 'good', 'easy'] as const;
export type ReviewGrade = (typeof REVIEW_GRADES)[number];

/** Epoch milliseconds. Stored as numbers so records survive JSON round-trips. */
export type Timestamp = number;

export interface ItemProgress {
  readonly itemId: ItemId;
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
 * Aggregated mastery of a pattern/verb/topic, inferred from item attempts
 * (spec §8.2). Not surfaced in v0.1, but the model must not prevent it.
 */
export interface SkillProgress {
  readonly skillId: SkillId;
  readonly attempts: number;
  readonly correct: number;
  /** 0 … 1 */
  readonly mastery: number;
  readonly lastReviewedAt?: Timestamp;
}

export function newItemProgress(itemId: ItemId): ItemProgress {
  return {
    itemId,
    status: 'new',
    attempts: 0,
    correct: 0,
    incorrect: 0,
    difficulty: 0.3,
    hintsUsed: 0,
    streak: 0,
  };
}

export function isDue(progress: ItemProgress, now: Timestamp): boolean {
  return progress.dueAt !== undefined && progress.dueAt <= now;
}
