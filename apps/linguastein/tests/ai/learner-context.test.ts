import { describe, expect, it } from 'vitest';
import { buildLearnerContext, formatLearnerContext } from '../../src/ai';
import type { ItemId } from '../../src/domain/content';
import { newProgress, type SubjectProgress } from '../../src/domain/progress';
import { id, testRepository } from '../fixtures/pack';

const repository = testRepository();
const NOW = 1_700_000_000_000;

const record = (local: string, overrides: Partial<SubjectProgress>): SubjectProgress => ({
  ...newProgress(id<ItemId>(`test-es:item:${local}`)),
  attempts: 3,
  ...overrides,
});

const build = (progress: readonly SubjectProgress[]) =>
  buildLearnerContext({
    repository,
    progress,
    referenceLanguage: 'en',
    targetLanguage: 'es',
    now: NOW,
  });

describe('buildLearnerContext', () => {
  it('summarises an empty history without pretending to know anything', () => {
    const context = build([]);
    expect(context).toMatchObject({
      level: 'a1',
      known: [],
      weak: [],
      totals: { seen: 0, mastered: 0, due: 0 },
    });
  });

  it('separates confident lemmas from weak ones', () => {
    const context = build([
      record('001', { difficulty: 0.7, status: 'learning' }),
      record('004', { difficulty: 0.1, status: 'mastered' }),
    ]);

    // Item 001 is a `tener que` sentence, so the weakness is reported as the
    // pattern rather than the sentence.
    expect(context.weak.map((point) => point.label)).toContain('tener que + infinitivo');
    expect(context.weak[0]?.kind).toBe('skill');
    expect(context.totals).toEqual({ seen: 2, mastered: 1, due: 0 });
  });

  it('counts due items', () => {
    const context = build([record('001', { difficulty: 0.2, dueAt: NOW - 1, status: 'review' })]);
    expect(context.totals.due).toBe(1);
  });

  it('caps how much it reports', () => {
    const many = Array.from({ length: 30 }, (_, index) =>
      record(String(index % 7).padStart(3, '0'), { difficulty: 0.9 }),
    );
    const context = buildLearnerContext({
      repository,
      progress: many,
      referenceLanguage: 'en',
      targetLanguage: 'es',
      now: NOW,
      maxWeak: 3,
    });

    expect(context.weak.length).toBeLessThanOrEqual(3);
    expect(context.maxNewWords).toBe(3);
  });

  it('can focus on a single topic', () => {
    const context = buildLearnerContext({
      repository,
      progress: [record('001', { difficulty: 0.8 }), record('004', { difficulty: 0.8 })],
      referenceLanguage: 'en',
      targetLanguage: 'es',
      now: NOW,
      topic: 'food-drink',
    });

    expect(context.topics).toEqual(['food-drink']);
  });
});

describe('formatLearnerContext', () => {
  it('renders the prompt preamble from the spec', () => {
    const text = formatLearnerContext(
      build([
        record('001', { difficulty: 0.8, status: 'learning' }),
        record('004', { difficulty: 0.1, status: 'mastered' }),
      ]),
    );

    expect(text).toContain('Learner level: A1');
    expect(text).toContain('Explain in: en');
    expect(text).toContain('Weak:');
    expect(text).toContain('- tener que + infinitivo');
    expect(text).toContain('Maximum new vocabulary: 3 words');
  });
});
