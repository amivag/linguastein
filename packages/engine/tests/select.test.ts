/** Choosing the next drill subject: due first, then unmet in order, then weakest. */
import { describe, expect, it } from 'vitest';
import { nextSubject, seededRng, type MemoryState } from '../src/index.ts';

const DAY = 86_400_000;
const NOW = 100 * DAY;

function state(overrides: Partial<MemoryState> = {}): MemoryState {
  return {
    status: 'review',
    attempts: 4,
    correct: 4,
    incorrect: 0,
    difficulty: 0.3,
    stability: 10,
    streak: 4,
    lastReviewedAt: NOW - DAY,
    dueAt: NOW + 5 * DAY,
    ...overrides,
  };
}

describe('nextSubject', () => {
  it('has nothing to offer from no subjects', () => {
    expect(nextSubject([], new Map(), NOW, seededRng(1))).toBeUndefined();
  });

  it('takes the most overdue subject before anything else', () => {
    const progress = new Map([
      ['a', state({ dueAt: NOW - DAY })],
      ['b', state({ dueAt: NOW - 3 * DAY })],
    ]);

    expect(nextSubject(['new', 'a', 'b'], progress, NOW, seededRng(1))).toBe('b');
  });

  it('then the first subject never met, in the order given', () => {
    const progress = new Map([['a', state()]]);

    expect(nextSubject(['a', 'second', 'third'], progress, NOW, seededRng(1))).toBe('second');
  });

  it('then the weakest, by accuracy weighted by how well it has survived a gap', () => {
    const progress = new Map([
      ['strong', state()],
      ['shaky', state({ correct: 2, incorrect: 2 })],
      ['fresh', state({ stability: 1 })],
    ]);

    expect(nextSubject(['strong', 'shaky', 'fresh'], progress, NOW, seededRng(1))).toBe('shaky');
  });

  it('breaks a tie between equally weak subjects with the injected randomness', () => {
    const progress = new Map([
      ['a', state({ stability: 0 })],
      ['b', state({ stability: 0 })],
    ]);
    const chosen = new Set(
      Array.from({ length: 20 }, (_, seed) =>
        nextSubject(['a', 'b'], progress, NOW, seededRng(seed)),
      ),
    );

    expect(chosen).toEqual(new Set(['a', 'b']));
  });
});
