/**
 * Learner state (spec §8). Kept strictly separate from content: progress
 * records only reference stable IDs, so datasets can be updated, replaced or
 * extended without invalidating what the learner has done.
 */

import { packIdOf, type EntityId, type PackId } from '../content';
import type { ExerciseKind } from '../exercises/types';

export const ITEM_STATUSES = ['new', 'learning', 'review', 'mastered'] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const REVIEW_GRADES = ['again', 'hard', 'good', 'easy'] as const;
export type ReviewGrade = (typeof REVIEW_GRADES)[number];

/** Epoch milliseconds. Stored as numbers so records survive JSON round-trips. */
export type Timestamp = number;

/**
 * What one thing the learner is getting better at looks like.
 *
 * **The subject is any content entity, not only an item**, and that widening is
 * what lets a drill exist at all. Three things the app wants to practise are not
 * items and never can be: a verb form (`core-es:form:ser-pres-1s`), a grammatical
 * pattern (`core-es:skill:numerals-y-joining`), and a passage as a whole. The
 * first two already ship as records with stable ids — 9,206 forms in `core-es` —
 * so nothing new had to be minted for them.
 *
 * It also answers the question `docs/tasks/numerals.md` §6.1 got stuck on. A
 * generated target like 1042 has no id and must not be given one; what it
 * *exercises* does. An attempt on 1042 is recorded against the patterns
 * `rulesFor(1042)` names, which are closed, stable and few — so the scheduler
 * sees a handful of durable skills rather than an infinity of integers.
 *
 * Architecture rule 4 is unchanged in substance: a progress row still references
 * an id the dataset owns and can never invalidate. Only the set of ids widened,
 * and it widened to one that already existed.
 */
export interface SubjectProgress {
  /**
   * What this row is about: `core-es:item:000123`, `core-es:form:ser-pres-1s`,
   * `core-es:skill:numerals-y-joining`.
   *
   * Named `subject` rather than `itemId` because it stopped being an item id.
   * The rename cost a database migration and a file-format version, and was
   * taken while the format was one day old rather than later, when every
   * exported file in existence would have had to be read through a shim forever.
   */
  readonly subject: EntityId;
  /**
   * The pack the subject belongs to, derived from its id rather than new
   * information — `packIdOf('core-es:item:000123')`.
   *
   * Stored because an IndexedDB index is built from a stored key path and
   * nothing else: "how much of the French course have I done?" cannot be asked
   * of a value computed in memory, and answering it by materialising every item
   * id in the course is what every screen does today. The record still
   * *references* only the subject (architecture rule 4) — this is the same fact,
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
  /** What was practised. See {@link SubjectProgress.subject}. */
  readonly subject: EntityId;
  readonly exerciseKind: ExerciseKind;
  readonly grade: ReviewGrade;
  readonly correct?: boolean;
  readonly latencyMs?: number;
  readonly hintsUsed?: number;
  readonly at: Timestamp;
  readonly sessionId?: string;
}

/**
 * A record for a subject nothing has been recorded against yet.
 *
 * `now` defaults to 0 rather than reading a clock — this module is pure, and a
 * fresh record only reaches storage through `recordAttempt`, which stamps
 * `updatedAt` with the attempt's own clock. Epoch zero is also the right answer
 * for a merge: a row nobody has written loses to one somebody has.
 */
export function newProgress(subject: EntityId, now: Timestamp = 0): SubjectProgress {
  const packId = packIdOf(subject);
  return {
    subject,
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

export function isDue(progress: SubjectProgress, now: Timestamp): boolean {
  return progress.dueAt !== undefined && progress.dueAt <= now;
}
