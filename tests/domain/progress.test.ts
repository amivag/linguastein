import { describe, expect, it } from 'vitest';
import type { ItemId } from '../../src/domain/content';
import {
  ladderScheduler,
  newItemProgress,
  recordAttempt,
  summarise,
  type ItemProgress,
} from '../../src/domain/progress';
import { id } from '../fixtures/pack';

const ITEM = id<ItemId>('test-es:item:001');
const NOW = 1_700_000_000_000;

const review = (progress: ItemProgress, grades: readonly ('again' | 'good' | 'easy' | 'hard')[]) =>
  grades.reduce(
    (state, grade, index) => ladderScheduler.review(state, grade, NOW + index),
    progress,
  );

describe('ladder scheduler', () => {
  it('schedules a first review shortly after a correct answer', () => {
    const result = ladderScheduler.review(newItemProgress(ITEM), 'good', NOW);
    expect(result.status).toBe('learning');
    expect(result.streak).toBe(1);
    expect(result.dueAt).toBeGreaterThan(NOW);
    expect(result.dueAt! - NOW).toBeLessThan(2 * 24 * 60 * 60 * 1000);
  });

  it('lengthens intervals as the streak grows', () => {
    const first = ladderScheduler.review(newItemProgress(ITEM), 'good', NOW);
    const second = ladderScheduler.review(first, 'good', NOW);
    expect(second.dueAt! - NOW).toBeGreaterThan(first.dueAt! - NOW);
  });

  it('resets the streak and difficulty on a lapse', () => {
    const learned = review(newItemProgress(ITEM), ['good', 'good', 'easy']);
    const lapsed = ladderScheduler.review(learned, 'again', NOW);

    expect(lapsed.streak).toBe(0);
    expect(lapsed.status).toBe('learning');
    expect(lapsed.incorrect).toBe(1);
    expect(lapsed.difficulty).toBeGreaterThan(learned.difficulty);
  });

  it('reaches mastered after a consistent easy streak', () => {
    const mastered = review(newItemProgress(ITEM), ['easy', 'easy', 'easy', 'easy']);
    expect(mastered.status).toBe('mastered');
    expect(mastered.correct).toBe(4);
  });
});

describe('recordAttempt', () => {
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
