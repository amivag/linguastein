/**
 * Review scheduling — the seam, and only the seam.
 *
 * `fsrs.ts` holds the implementation the app runs. Keeping the contract in its
 * own file is what lets the algorithm be swapped by adding a file rather than
 * touching the session planner, the UI or the stored shape of `ItemProgress`.
 *
 * An interval ladder used to live here and was removed once FSRS replaced it:
 * nothing outside its own tests called it, and a spare scheduler that no code
 * path exercises only drifts out of step with the real one. `recordAttempt`
 * takes a `Scheduler` parameter, so the seam is exercised by injecting a stub
 * rather than by maintaining a second algorithm.
 */

import type { ItemProgress, ReviewGrade, Timestamp } from './types';

export interface Scheduler {
  readonly id: string;
  review(progress: ItemProgress, grade: ReviewGrade, now: Timestamp): ItemProgress;
}
