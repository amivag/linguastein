/**
 * The scheduler is asserted on behaviour, not on constants: the weights are
 * defaults awaiting a per-user fit, so pinning exact intervals would make the
 * suite fight future tuning instead of protecting the learner.
 */

import { describe, expect, it } from 'vitest';
import type { ItemId } from '../../src/domain/content';
import {
  fsrsScheduler,
  intervalDays,
  newProgress,
  retrievability,
  type SubjectProgress,
  type ReviewGrade,
} from '../../src/domain/progress';
import { id } from '../fixtures/pack';

const ITEM = id<ItemId>('test-es:item:001');
const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_700_000_000_000;

/** Reviews at the moment each item falls due, as a real learner would. */
function study(grades: readonly ReviewGrade[], from: SubjectProgress = newProgress(ITEM)) {
  let progress = from;
  let clock = NOW;
  for (const grade of grades) {
    progress = fsrsScheduler.review(progress, grade, clock);
    clock = progress.dueAt ?? clock + DAY;
  }
  return progress;
}

const intervalOf = (progress: SubjectProgress) =>
  (progress.dueAt ?? 0) - (progress.lastReviewedAt ?? 0);

describe('forgetting curve', () => {
  it('is certain at zero elapsed time and decays from there', () => {
    expect(retrievability(0, 10)).toBeCloseTo(1, 5);
    expect(retrievability(10, 10)).toBeLessThan(1);
    expect(retrievability(100, 10)).toBeLessThan(retrievability(10, 10));
  });

  it('decays more slowly for a more stable memory', () => {
    expect(retrievability(10, 30)).toBeGreaterThan(retrievability(10, 3));
  });

  it('schedules the review where retention reaches the target', () => {
    // By construction the interval for stability S is S days at 90% retention.
    expect(intervalDays(10)).toBeCloseTo(10, 5);
    expect(retrievability(intervalDays(10), 10)).toBeCloseTo(0.9, 5);
  });
});

describe('fsrsScheduler', () => {
  it('gives a new item its first interval from how well it went', () => {
    const again = fsrsScheduler.review(newProgress(ITEM), 'again', NOW);
    const hard = fsrsScheduler.review(newProgress(ITEM), 'hard', NOW);
    const good = fsrsScheduler.review(newProgress(ITEM), 'good', NOW);
    const easy = fsrsScheduler.review(newProgress(ITEM), 'easy', NOW);

    expect(intervalOf(again)).toBeLessThan(intervalOf(hard));
    expect(intervalOf(hard)).toBeLessThan(intervalOf(good));
    expect(intervalOf(good)).toBeLessThan(intervalOf(easy));
  });

  it('brings a failed item back within the same session', () => {
    const lapsed = fsrsScheduler.review(newProgress(ITEM), 'again', NOW);
    expect(intervalOf(lapsed)).toBeLessThanOrEqual(15 * 60 * 1000);
    expect(lapsed.status).toBe('learning');
  });

  it('lengthens intervals as a memory stabilises', () => {
    const intervals: number[] = [];
    let progress = newProgress(ITEM);
    let clock = NOW;

    for (let review = 0; review < 5; review++) {
      progress = fsrsScheduler.review(progress, 'good', clock);
      intervals.push(intervalOf(progress));
      clock = progress.dueAt!;
    }

    for (let i = 1; i < intervals.length; i++) {
      expect(intervals[i]).toBeGreaterThan(intervals[i - 1]!);
    }
    expect(progress.stability).toBeGreaterThan(10);
  });

  it('shortens the schedule after a lapse but does not start from scratch', () => {
    const learned = study(['good', 'good', 'good']);
    const lapsed = fsrsScheduler.review(learned, 'again', learned.dueAt!);
    const recovered = fsrsScheduler.review(lapsed, 'good', lapsed.dueAt!);

    expect(lapsed.stability).toBeLessThan(learned.stability!);
    expect(lapsed.streak).toBe(0);
    // Relearning is faster than learning it for the first time.
    const fresh = fsrsScheduler.review(newProgress(ITEM), 'good', NOW);
    expect(recovered.stability).toBeGreaterThan(fresh.stability!);
  });

  it('schedules a hard item sooner than an easy one', () => {
    const hard = study(['hard', 'hard', 'hard']);
    const easy = study(['easy', 'easy', 'easy']);

    expect(hard.difficulty).toBeGreaterThan(easy.difficulty);
    expect(hard.stability).toBeLessThan(easy.stability!);
    expect(intervalOf(hard)).toBeLessThan(intervalOf(easy));
  });

  it('reaches mastered only after a durable streak', () => {
    expect(study(['good']).status).toBe('learning');
    expect(study(['good', 'good', 'good', 'good', 'good']).status).toBe('mastered');
  });

  it('caps intervals at a year', () => {
    const veteran = study(Array.from({ length: 12 }, () => 'easy' as const));
    expect(intervalOf(veteran)).toBeLessThanOrEqual(365 * DAY);
  });

  it('adopts records written before scheduling was upgraded', () => {
    // No stability field: the ladder scheduler wrote these.
    const legacy: SubjectProgress = {
      ...newProgress(ITEM),
      attempts: 3,
      correct: 3,
      streak: 3,
      difficulty: 0.4,
      lastReviewedAt: NOW - 3 * DAY,
      dueAt: NOW,
    };

    const reviewed = fsrsScheduler.review(legacy, 'good', NOW);
    expect(reviewed.stability).toBeGreaterThan(0);
    expect(reviewed.dueAt).toBeGreaterThan(NOW);
    expect(reviewed.attempts).toBe(4);
  });

  it('rewards reviewing an item that was nearly forgotten', () => {
    const base = study(['good', 'good']);
    const onTime = fsrsScheduler.review(base, 'good', base.dueAt!);
    const overdue = fsrsScheduler.review(base, 'good', base.dueAt! + 30 * DAY);

    // The spacing effect: recalling something on the edge of forgetting
    // strengthens it more than recalling something still fresh.
    expect(overdue.stability).toBeGreaterThan(onTime.stability!);
  });
});
