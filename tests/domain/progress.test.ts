import { describe, expect, it } from 'vitest';
import type { ItemId } from '../../src/domain/content';
import {
  newItemProgress,
  recordAttempt,
  summarise,
  type ItemProgress,
  type Scheduler,
} from '../../src/domain/progress';
import { seededRng } from '../../src/utils/random';
import { id } from '../fixtures/pack';

const ITEM = id<ItemId>('test-es:item:001');
const NOW = 1_700_000_000_000;

describe('the scheduler seam', () => {
  /**
   * Scheduling is swappable by design, so `recordAttempt` must delegate the
   * interval rather than compute one of its own — and must still layer on the
   * things only it tracks. A stub is the whole point of the seam: it proves the
   * indirection without a second real algorithm to keep in step.
   */
  it('delegates scheduling and keeps its own bookkeeping on top', () => {
    const stub: Scheduler = {
      id: 'stub',
      review: (progress) => ({ ...progress, attempts: progress.attempts + 1, dueAt: 42 }),
    };

    const { progress } = recordAttempt(
      undefined,
      { itemId: ITEM, exerciseKind: 'reveal', grade: 'good', latencyMs: 1000, hintsUsed: 2 },
      NOW,
      stub,
    );

    expect(progress.dueAt).toBe(42);
    expect(progress.attempts).toBe(1);
    // Latency and hints belong to the tracker, not the scheduler.
    expect(progress.averageLatencyMs).toBe(1000);
    expect(progress.hintsUsed).toBe(2);
  });
});

describe('an attempt’s identity', () => {
  /**
   * The id used to be the item and the clock joined together — a value
   * `recordAttempt` could compute on its own, which meant two answers to one
   * item inside the same millisecond shared an id and the store's `put` replaced
   * the first with the second. Answering twice in a millisecond is rare;
   * silently losing the first answer when it happens is not acceptable, and no
   * later migration can recover a row that was overwritten.
   */
  it('distinguishes two attempts on one item at the same instant', () => {
    const input = { itemId: ITEM, exerciseKind: 'reveal' as const, grade: 'good' as const };
    // One rng, drawn from twice — a fresh seeded rng would (correctly) repeat.
    const rng = seededRng(7);

    const first = recordAttempt(undefined, input, NOW, undefined, rng);
    const second = recordAttempt(first.progress, input, NOW, undefined, rng);

    expect(second.attempt.id).not.toBe(first.attempt.id);
  });

  it('stays reproducible under a seed', () => {
    const input = { itemId: ITEM, exerciseKind: 'reveal' as const, grade: 'good' as const };

    expect(recordAttempt(undefined, input, NOW, undefined, seededRng(7)).attempt.id).toBe(
      recordAttempt(undefined, input, NOW, undefined, seededRng(7)).attempt.id,
    );
  });
});

describe('recordAttempt', () => {
  /**
   * `lastReviewedAt` says when the learner last saw the item; this says when the
   * row was last written. They coincide today and will not once anything else
   * touches a record — and it is the field a merge of two devices compares, so
   * it has to be written from the start rather than invented afterwards.
   */
  it('stamps when the record was written', () => {
    const { progress } = recordAttempt(
      undefined,
      { itemId: ITEM, exerciseKind: 'reveal', grade: 'good' },
      NOW,
    );

    expect(progress.updatedAt).toBe(NOW);
  });

  it('produces progress and an attempt record together', () => {
    const { progress, attempt } = recordAttempt(
      undefined,
      {
        itemId: ITEM,
        exerciseKind: 'multiple-choice',
        grade: 'good',
        correct: true,
        latencyMs: 2400,
      },
      NOW,
    );

    expect(progress.attempts).toBe(1);
    expect(progress.averageLatencyMs).toBe(2400);
    expect(attempt.itemId).toBe(ITEM);
    expect(attempt.exerciseKind).toBe('multiple-choice');
    expect(attempt.at).toBe(NOW);
  });

  it('smooths latency across attempts', () => {
    const first = recordAttempt(
      undefined,
      { itemId: ITEM, exerciseKind: 'reveal', grade: 'good', latencyMs: 4000 },
      NOW,
    );
    const second = recordAttempt(
      first.progress,
      { itemId: ITEM, exerciseKind: 'reveal', grade: 'good', latencyMs: 2000 },
      NOW + 1,
    );
    expect(second.progress.averageLatencyMs).toBe(3400);
  });
});

describe('summarise', () => {
  it('counts due and mastered items', () => {
    const known: ItemProgress[] = [
      { ...newItemProgress(ITEM), status: 'review', dueAt: NOW - 1 },
      { ...newItemProgress(id<ItemId>('test-es:item:002')), status: 'mastered', dueAt: NOW + 1000 },
    ];

    expect(summarise(known, 7, NOW)).toEqual({
      total: 7,
      seen: 2,
      due: 1,
      learning: 0,
      review: 1,
      mastered: 1,
    });
  });
});
