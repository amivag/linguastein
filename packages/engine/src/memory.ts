/** Scheduling state only: identity, persistence and subject evidence belong to the app. */
export const ITEM_STATUSES = ['new', 'learning', 'review', 'mastered'] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];
export const REVIEW_GRADES = ['again', 'hard', 'good', 'easy'] as const;
export type ReviewGrade = (typeof REVIEW_GRADES)[number];
/** Epoch milliseconds, supplied by the caller. */
export type Timestamp = number;

export interface MemoryState {
  readonly status: ItemStatus;
  readonly attempts: number;
  readonly correct: number;
  readonly incorrect: number;
  readonly difficulty: number;
  readonly stability?: number;
  readonly lastReviewedAt?: Timestamp;
  readonly dueAt?: Timestamp;
  readonly streak: number;
}

export interface Scheduler {
  readonly id: string;
  review(progress: MemoryState, grade: ReviewGrade, now: Timestamp): MemoryState;
}

export function isDue(progress: Pick<MemoryState, 'dueAt'>, now: Timestamp): boolean {
  return progress.dueAt !== undefined && progress.dueAt <= now;
}
