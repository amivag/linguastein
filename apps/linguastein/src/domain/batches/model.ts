/**
 * A batch is a set of material the *learner* picked, kept so that a week of
 * short sessions can all draw on the same items.
 *
 * It is deliberately the same shape as a mission — a bounded set of existing
 * items, with completion derived rather than recorded — and deliberately not a
 * mission. A mission is authored curriculum whose transfer ladder exists to put
 * the learner in three *different* situations; a batch exists to bring them back
 * to the *same* material until it holds. Same structure, opposite intent.
 *
 * This is the first curriculum object a learner can author, which is the one
 * genuinely new idea here. It stores item ids and nothing else about content, so
 * architecture rule 4 holds: the set *references* items, exactly as a progress
 * record does, and a pack can grow, be reordered or retire a row without
 * invalidating it.
 */

import type { Course, ItemId, LanguageTag } from '../content';
import type { Timestamp } from '../progress/types';
import { token, type Rng } from '../../utils/random';

export interface BatchDefinition {
  /** Short and URL-safe: it is written into a session link as `?batch=`. */
  readonly id: string;
  readonly label: string;
  /**
   * The course it was drawn in.
   *
   * The ids resolve in any course that loads their pack, so this is not about
   * resolution — it is so a batch of Spanish nouns is not listed on a French
   * screen. Same reasoning as `SessionRecord.course`.
   */
  readonly course: Course;
  /**
   * Frozen at creation, and that is the point of the feature: a set whose
   * membership drifts is not something a learner can ever be finished with.
   */
  readonly itemIds: readonly ItemId[];
  readonly createdAt: Timestamp;
  /**
   * How many items a single slot should deal. A pacing hint for sizing a
   * session, never a target that can be hit or missed — see the task brief.
   */
  readonly perSession?: number;
}

/**
 * `batch-lq2p8v-k3f9a1`: the clock for readable ordering, the token for
 * uniqueness. The same spelling `Attempt.id` and a session id use, and for the
 * same reason — a device that creates two batches in one millisecond must not
 * have them collide, and a merge has to be able to trust the id.
 */
export function newBatchId(now: Timestamp, rng: Rng): string {
  return `batch-${now.toString(36)}-${token(rng)}`;
}

/**
 * The batches belonging to a course, newest first.
 *
 * Matched on **language**, not on the whole course, which is the same call
 * `SessionStore.recent` makes and for the same reason: a level is a ceiling, so a
 * batch drawn at A1 is part of what an A2 learner is working on. A batch drawn
 * *above* the current level still lists, with its out-of-scope items reported as
 * `missing` by {@link batchStanding} — a course is a scope rather than a
 * partition, and a set that quietly disappeared on switching level would look
 * like lost work.
 */
export function batchesForCourse(
  batches: readonly BatchDefinition[],
  course: Course,
): readonly BatchDefinition[] {
  return batchesForLanguage(batches, course.language);
}

export function batchesForLanguage(
  batches: readonly BatchDefinition[],
  language: LanguageTag,
): readonly BatchDefinition[] {
  return batches
    .filter((batch) => batch.course.language === language)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function batchById(
  batches: readonly BatchDefinition[],
  id: string,
): BatchDefinition | undefined {
  return batches.find((batch) => batch.id === id);
}
