import { describe, expect, it } from 'vitest';
import type { ItemId } from '../../src/domain/content';
import { newItemProgress, type ItemProgress } from '../../src/domain/progress';
import {
  composeSession,
  modeCounts,
  retrievalModeFor,
  type RetrievalMode,
} from '../../src/domain/sessions';
import { seededRng } from '../../src/utils/random';
import { id, testRepository } from '../fixtures/pack';

const repository = testRepository();
const items = repository.allItems();
const ALL = [
  'multiple-choice',
  'cloze-choice',
  'tap-to-build',
  'think-say',
  'listen-repeat',
  'reveal',
] as const;

const progressAt = (local: string, overrides: Partial<ItemProgress>): [ItemId, ItemProgress] => {
  const itemId = id<ItemId>(`test-es:item:${local}`);
  return [itemId, { ...newItemProgress(itemId), attempts: 3, ...overrides }];
};

const compose = (progress: ReadonlyMap<ItemId, ItemProgress>, study = false) =>
  composeSession({ items, progress, allowed: ALL, rng: seededRng(7), study });

describe('retrievalModeFor', () => {
  it('starts a new item on recognition', () => {
    expect(retrievalModeFor(undefined)).toBe('recognition');
    expect(retrievalModeFor(newItemProgress(id<ItemId>('test-es:item:001')))).toBe('recognition');
  });

  it('promotes to cued recall once the memory holds for a day', () => {
    const [, progress] = progressAt('001', { status: 'review', stability: 3, difficulty: 0.3 });
    expect(retrievalModeFor(progress)).toBe('cued-recall');
  });

  it('promotes to production once the memory is durable', () => {
    const [, progress] = progressAt('001', { status: 'review', stability: 30, difficulty: 0.2 });
    expect(retrievalModeFor(progress)).toBe('production');
  });

  it('holds a stubbornly difficult item back from production', () => {
    const [, progress] = progressAt('001', { status: 'review', stability: 30, difficulty: 0.9 });
    expect(retrievalModeFor(progress)).toBe('cued-recall');
  });

  it('drops a lapsed item back to recognition', () => {
    const [, progress] = progressAt('001', { status: 'learning', stability: 12, difficulty: 0.5 });
    expect(retrievalModeFor(progress)).toBe('recognition');
  });
});

describe('composeSession', () => {
  it('asks a new learner to recognise, not to produce', () => {
    const steps = compose(new Map());
    expect(modeCounts(steps).recognition).toBe(items.length);
    expect(steps.every((step) => step.kinds[0] === 'multiple-choice')).toBe(false);
  });

  it('does not let one exercise type run through a whole session', () => {
    const steps = compose(new Map());

    let longestRun = 1;
    let run = 1;
    for (let i = 1; i < steps.length; i++) {
      run = steps[i]!.kinds[0] === steps[i - 1]!.kinds[0] ? run + 1 : 1;
      longestRun = Math.max(longestRun, run);
    }

    // This is the fix for "quick practice is multiple choice on every item".
    expect(longestRun).toBeLessThanOrEqual(2);
  });

  it('mixes modes when the learner is at mixed strengths', () => {
    const progress = new Map([
      progressAt('001', { status: 'review', stability: 30, difficulty: 0.2 }),
      progressAt('002', { status: 'review', stability: 3, difficulty: 0.3 }),
      progressAt('003', { status: 'learning', stability: 0.5, difficulty: 0.8 }),
    ]);

    const counts = modeCounts(compose(progress));
    expect(counts.production).toBeGreaterThan(0);
    expect(counts['cued-recall']).toBeGreaterThan(0);
    expect(counts.recognition).toBeGreaterThan(0);
  });

  it('offers every item something to do, even a thin one', () => {
    const steps = compose(new Map());
    expect(steps).toHaveLength(items.length);
    expect(steps.every((step) => step.kinds.length > 0)).toBe(true);
  });

  it('falls back to other allowed kinds when the ideal one is unavailable', () => {
    const steps = composeSession({
      items,
      progress: new Map([progressAt('001', { status: 'review', stability: 30, difficulty: 0.1 })]),
      // Production is the right mode for item 001, but only cloze is allowed.
      allowed: ['cloze-choice'],
      rng: seededRng(1),
    });

    expect(steps[0]?.kinds).toEqual(['cloze-choice']);
  });

  it('browses rather than tests in study mode', () => {
    const steps = compose(new Map(), true);
    const modes = new Set<RetrievalMode>(steps.map((step) => step.mode));
    expect([...modes]).toEqual(['study']);
    expect(steps[0]?.kinds[0]).toBe('reveal');
  });

  it('is reproducible for a given seed', () => {
    const a = compose(new Map());
    const b = compose(new Map());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
