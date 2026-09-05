/**
 * The invariant that makes an importer — and, later, a sync — possible:
 * **for every item, folding its attempts reproduces its stored progress row.**
 *
 * Today it holds because there is one writer. After a merge it holds only
 * because the merge maintains it, and nothing about a broken reconciler looks
 * wrong from the outside: `mastery.ts` derives what a learner is *shown* from
 * exactly the row that would be silently off. `docs/tasks/learner-profile.md`
 * §9.1.2 names this as the test that catches it before a learner does, which is
 * why it is generated over a random log rather than written as three examples.
 */

import { describe, expect, it } from 'vitest';
import { id } from '../fixtures/pack';
import type { EntityId, ItemId } from '../../src/domain/content';
import type { ExerciseKind } from '../../src/domain/exercises/types';
import {
  applyAttempt,
  recordAttempt,
  replaySubject,
  type Attempt,
  type SubjectProgress,
  type ReviewGrade,
} from '../../src/domain/progress';
import { randomInt, seededRng, type Rng } from '../../src/utils/random';

const ITEM = id<ItemId>('test-es:item:001');
const OTHER = id<ItemId>('test-es:item:002');
const START = 1_700_000_000_000;
const MINUTE = 60_000;

const GRADES: readonly ReviewGrade[] = ['again', 'hard', 'good', 'easy'];
const KINDS: readonly ExerciseKind[] = ['think-say', 'tap-to-build', 'multiple-choice', 'reveal'];

/**
 * A session's worth of practice on one item, recorded the way the app records
 * it — through `recordAttempt`, so the "stored" row is the one the incremental
 * path actually produces rather than one this test built to match itself.
 */
function practise(
  subject: EntityId,
  count: number,
  rng: Rng,
): { readonly progress: SubjectProgress | undefined; readonly attempts: readonly Attempt[] } {
  let progress: SubjectProgress | undefined;
  const attempts: Attempt[] = [];
  let at = START;

  for (let i = 0; i < count; i++) {
    /*
     * Uneven gaps, because stability is a function of elapsed time: a fold over
     * evenly spaced attempts would exercise one branch of the forgetting curve.
     *
     * Always advancing, and that part is not incidental. Two attempts sharing a
     * millisecond is the one case where the canonical order (`at`, then `id`)
     * and the order they were recorded in can disagree — see the dedicated test
     * below for what the fold does then. It is not a case a *learner* produces:
     * an attempt is a person answering a card. Generating it here would assert
     * agreement with an arrival order the log does not record.
     */
    at += 1_000 + randomInt(rng, 20 * 24 * 60) * MINUTE;
    const recorded = recordAttempt(
      progress,
      {
        subject,
        exerciseKind: KINDS[randomInt(rng, KINDS.length)]!,
        grade: GRADES[randomInt(rng, GRADES.length)]!,
        ...(randomInt(rng, 2) ? { latencyMs: 500 + randomInt(rng, 8000) } : {}),
        ...(randomInt(rng, 4) === 0 ? { hintsUsed: 1 } : {}),
      },
      at,
      undefined,
      rng,
    );
    progress = recorded.progress;
    attempts.push(recorded.attempt);
  }

  return { progress, attempts };
}

describe('replaying an attempt log', () => {
  it('reproduces the stored row exactly, for any log', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const rng = seededRng(seed);
      const { progress, attempts } = practise(ITEM, 1 + randomInt(rng, 25), rng);

      expect(replaySubject(ITEM, attempts)).toEqual(progress);
    }
  });

  /**
   * The fold has to be order-independent given the same *set*, because a merge
   * hands it two logs concatenated in whatever order they arrived. Sorting is by
   * `at` then `id`, so shuffling the input cannot change the answer.
   */
  it('does not depend on the order the attempts arrive in', () => {
    const rng = seededRng(99);
    const { progress, attempts } = practise(ITEM, 12, rng);

    expect(replaySubject(ITEM, [...attempts].reverse())).toEqual(progress);
    expect(
      replaySubject(
        ITEM,
        [...attempts].sort((a, b) => a.id.localeCompare(b.id)),
      ),
    ).toEqual(progress);
  });

  /**
   * Two attempts inside one millisecond are exactly what the collision-free id
   * exists for, and they are also the only case where `at` cannot decide the
   * order. The tiebreak makes the answer the same on both devices.
   */
  it('orders attempts sharing a millisecond by id', () => {
    const base = { subject: ITEM, exerciseKind: 'think-say' as const, at: START };
    const again: Attempt = { ...base, id: 'a-zzz', grade: 'again' };
    const good: Attempt = { ...base, id: 'a-aaa', grade: 'good' };

    // `a-aaa` is applied first either way, so the streak is the one that follows
    // a good answer *then* a lapse: zero.
    for (const log of [
      [again, good],
      [good, again],
    ]) {
      expect(replaySubject(ITEM, log)).toEqual(applyAttempt(applyAttempt(undefined, good), again));
    }
  });

  /**
   * The fold knows nothing about what a subject *is*, and that is what lets a
   * drill exist: `core-es:skill:numerals-y-joining` is scheduled by exactly the
   * same arithmetic as a sentence.
   */
  it('folds a subject that is not an item', () => {
    const pattern = id<EntityId>('test-es:skill:numerals-y-joining');
    const { progress, attempts } = practise(pattern, 8, seededRng(3));

    expect(replaySubject(pattern, attempts)).toEqual(progress);
    expect(replaySubject(pattern, attempts)?.subject).toBe(pattern);
  });

  it('reads only the item it was asked about', () => {
    const rng = seededRng(5);
    const mine = practise(ITEM, 6, rng);
    const theirs = practise(OTHER, 6, rng);

    expect(replaySubject(ITEM, [...mine.attempts, ...theirs.attempts])).toEqual(mine.progress);
    expect(replaySubject(OTHER, [...mine.attempts, ...theirs.attempts])).toEqual(theirs.progress);
  });

  /**
   * No evidence is not the same answer as a fresh record. The caller — an
   * importer deciding what to do with a projection whose log is gone — is the
   * only thing that knows whether to keep the row it already has.
   */
  it('has no answer for an empty log', () => {
    expect(replaySubject(ITEM, [])).toBeUndefined();
    expect(replaySubject(ITEM, practise(OTHER, 3, seededRng(1)).attempts)).toBeUndefined();
  });
});
