/**
 * Pure transitions of learner state. The store persists whatever these return;
 * it never computes progress itself.
 */

import { systemRng, token, type Rng } from '../../utils/random';
import { isItemId, type EntityId, type ItemId } from '../content';
import type { ExerciseKind } from '../exercises/types';
import { fsrsScheduler } from './fsrs';
import type { Scheduler } from './scheduler';
import {
  isDue,
  newProgress,
  type Attempt,
  type ReviewGrade,
  type SubjectProgress,
  type Timestamp,
} from './types';

export interface AttemptInput {
  readonly subject: EntityId;
  readonly exerciseKind: ExerciseKind;
  readonly grade: ReviewGrade;
  readonly correct?: boolean;
  readonly latencyMs?: number;
  readonly hintsUsed?: number;
  readonly sessionId?: string;
}

export interface RecordedAttempt {
  readonly progress: SubjectProgress;
  readonly attempt: Attempt;
}

/**
 * One attempt applied to one progress row — the transition, and nothing else.
 *
 * Split out of {@link recordAttempt} because **`SubjectProgress` is a fold, not a
 * document**: every field is a function of the row before it and the attempt
 * applied to it, and nothing in the chain reads a clock or a random source. That
 * makes the row reproducible from the log, which is what
 * `docs/tasks/learner-profile.md` §9.1 settles the merge policy on — an importer
 * and, later, a sync both rebuild progress by replaying attempts rather than by
 * merging accumulators, because last-write-wins on a counter is a lost-update
 * bug that desynchronises two stores meant to be one fact.
 *
 * It takes a stored {@link Attempt} rather than an {@link AttemptInput}, which is
 * what lets replay reuse it: an `Attempt` carries every field an input has, so
 * the mapping back is lossless and no logic is duplicated.
 */
export function applyAttempt(
  current: SubjectProgress | undefined,
  attempt: Attempt,
  scheduler: Scheduler = fsrsScheduler,
): SubjectProgress {
  const previous = current ?? newProgress(attempt.subject, attempt.at);
  const reviewed = scheduler.review(previous, attempt.grade, attempt.at);

  return {
    ...reviewed,
    hintsUsed: previous.hintsUsed + (attempt.hintsUsed ?? 0),
    updatedAt: attempt.at,
    ...(attempt.latencyMs !== undefined
      ? { averageLatencyMs: smoothLatency(previous.averageLatencyMs, attempt.latencyMs) }
      : {}),
  };
}

/**
 * The progress row a subject's whole attempt log implies.
 *
 * `undefined` for an empty log, which is the honest answer: a row for an item
 * nothing has been recorded against is not the same thing as no row, and only
 * the caller knows whether to keep one it already has.
 *
 * Ordering is by `at`, then by `id`, and the tiebreak is not decoration: a fold
 * whose order depended on which device listed the attempts first would produce
 * two different answers from one log, and a merge concatenates two logs in
 * whatever order they arrived.
 *
 * That tiebreak is also the one place replay and the incremental path can
 * disagree. Two attempts inside the same millisecond — what the collision-free
 * id exists for — are applied here in id order, while the live path applied them
 * in arrival order, which the log does not record. The stored row and the fold
 * then differ in the last digit or two of `difficulty` and the latency mean.
 * Reachable only synthetically: an attempt is a person answering a card. This
 * order is the canonical one because it is the one two devices agree on.
 */
export function replaySubject(
  subject: EntityId,
  attempts: readonly Attempt[],
  scheduler: Scheduler = fsrsScheduler,
): SubjectProgress | undefined {
  const ordered = attempts
    .filter((attempt) => attempt.subject === subject)
    .sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  if (ordered.length === 0) return undefined;

  let progress: SubjectProgress | undefined;
  for (const attempt of ordered) progress = applyAttempt(progress, attempt, scheduler);
  return progress;
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
  current: SubjectProgress | undefined,
  input: AttemptInput,
  now: Timestamp,
  scheduler: Scheduler = fsrsScheduler,
  rng: Rng = systemRng,
): RecordedAttempt {
  const attempt: Attempt = {
    // Time-ordered so a log stays readable, and unique so two of them can be
    // merged; see the `rng` note above for why the clock alone was not enough.
    id: `${now.toString(36)}-${token(rng)}`,
    subject: input.subject,
    exerciseKind: input.exerciseKind,
    grade: input.grade,
    at: now,
    ...(input.correct !== undefined ? { correct: input.correct } : {}),
    ...(input.latencyMs !== undefined ? { latencyMs: input.latencyMs } : {}),
    ...(input.hintsUsed !== undefined ? { hintsUsed: input.hintsUsed } : {}),
    ...(input.sessionId !== undefined ? { sessionId: input.sessionId } : {}),
  };

  return { progress: applyAttempt(current, attempt, scheduler), attempt };
}

/**
 * The rows about items the caller cares about, keyed by those items.
 *
 * Three screens did this filter inline and all three now need a narrowing as
 * well as a filter: `subject` is an {@link EntityId}, so a row about a pattern
 * or a verb form has to be dropped before its id can be used as an `ItemId`.
 * That is the whole of what keeps a drill's rows out of the due count, the
 * review session, the weak-item list and the practised set — one function with
 * one explanation, rather than the same two-part condition written three times
 * and, eventually, two-and-a-half times.
 *
 * The filter is by *membership*, not by shape: a course's `ids` are the items it
 * admits, so this narrows to the course and to items in one pass.
 */
export function itemProgressIn(
  rows: readonly SubjectProgress[],
  ids: ReadonlySet<ItemId>,
): ReadonlyMap<ItemId, SubjectProgress> {
  const found = new Map<ItemId, SubjectProgress>();
  for (const row of rows) {
    if (isItemId(row.subject) && ids.has(row.subject)) found.set(row.subject, row);
  }
  return found;
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
  known: readonly SubjectProgress[],
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
