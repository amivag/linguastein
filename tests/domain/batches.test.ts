import { describe, expect, it } from 'vitest';
import {
  ABSORBED_PRODUCTION_DAYS,
  ABSORBED_STABILITY_DAYS,
  batchById,
  batchesForCourse,
  batchStanding,
  newBatchId,
  type BatchDefinition,
} from '../../src/domain/batches';
import type { Course, ItemId } from '../../src/domain/content';
import { newItemProgress, type Attempt, type ItemProgress } from '../../src/domain/progress';
import { seededRng } from '../../src/utils/random';
import { id } from '../fixtures/pack';

const ES: Course = { language: 'es', level: 'a1' };
const FR: Course = { language: 'fr', level: 'all' };

const item = (n: number) => id<ItemId>(`test-es:item:${String(n).padStart(3, '0')}`);

const DAY = 86_400_000;
/** Test days are whole multiples of a day, so a UTC date string is enough. */
const dayOf = (at: number) => new Date(at).toISOString().slice(0, 10);

function batch(overrides: Partial<BatchDefinition> = {}): BatchDefinition {
  return {
    id: 'batch-1',
    label: 'Food nouns',
    course: ES,
    itemIds: [item(1), item(2), item(3)],
    createdAt: 1_000,
    ...overrides,
  };
}

/** A record held well enough to pass the stability half of the bar. */
function held(itemId: ItemId, stability = ABSORBED_STABILITY_DAYS): ItemProgress {
  return { ...newItemProgress(itemId), attempts: 3, correct: 3, stability, status: 'review' };
}

function attempt(overrides: Partial<Attempt> & { itemId: ItemId; at: number }): Attempt {
  return {
    id: `a-${overrides.itemId}-${overrides.at}`,
    exerciseKind: 'think-say',
    grade: 'good',
    ...overrides,
  };
}

function standing(input: {
  batch?: BatchDefinition;
  progress?: readonly ItemProgress[];
  attempts?: readonly Attempt[];
  courseItemIds?: readonly ItemId[];
  now?: number;
}) {
  const definition = input.batch ?? batch();
  return batchStanding({
    batch: definition,
    courseItemIds: new Set(input.courseItemIds ?? definition.itemIds),
    progress: new Map((input.progress ?? []).map((record) => [record.itemId, record])),
    attempts: input.attempts ?? [],
    now: input.now ?? 100 * DAY,
    dayOf,
  });
}

describe('batch model', () => {
  it('gives each batch a distinct id under the same clock', () => {
    const rng = seededRng(7);
    expect(newBatchId(1_000, rng)).not.toBe(newBatchId(1_000, rng));
  });

  it('reproduces an id under a seed', () => {
    expect(newBatchId(1_000, seededRng(7))).toBe(newBatchId(1_000, seededRng(7)));
  });

  /**
   * Language, not the whole course. A level is a ceiling, so a set drawn at A1 is
   * part of what an A2 learner is working on — the same call `SessionStore.recent`
   * makes about session history.
   */
  it('lists a batch drawn at another level of the same language', () => {
    const drawnAtA1 = batch({ id: 'a', course: { language: 'es', level: 'a1' } });
    const drawnAtA2 = batch({ id: 'b', course: { language: 'es', level: 'a2' }, createdAt: 2_000 });
    const french = batch({ id: 'c', course: FR });

    const listed = batchesForCourse([drawnAtA1, drawnAtA2, french], {
      language: 'es',
      level: 'a2',
    });

    expect(listed.map((entry) => entry.id)).toEqual(['b', 'a']);
  });

  it('finds nothing for an id no batch carries', () => {
    expect(batchById([batch()], 'batch-9')).toBeUndefined();
  });
});

describe('batch standing', () => {
  it('counts an untouched batch as untouched', () => {
    expect(standing({})).toMatchObject({ total: 3, absorbed: 0, shaky: 0, untouched: 3 });
  });

  /**
   * The three conditions of the bar, each shown to be load-bearing by removing
   * exactly one of them. This is the heart of the feature: a batch that
   * graduated on any two of the three would be flattering the learner.
   */
  it('needs production, stability and two days together', () => {
    const days = [
      attempt({ itemId: item(1), at: 10 * DAY }),
      attempt({ itemId: item(1), at: 11 * DAY }),
    ];

    // All three: absorbed.
    expect(standing({ progress: [held(item(1))], attempts: days }).absorbed).toBe(1);

    // Recognition only — the same two days, but answered by picking from four
    // options rather than producing anything.
    expect(
      standing({
        progress: [held(item(1))],
        attempts: days.map((one) => ({ ...one, exerciseKind: 'multiple-choice' as const })),
      }).absorbed,
    ).toBe(0);

    // Produced twice on two days, but the memory has not survived a gap yet.
    expect(
      standing({ progress: [held(item(1), ABSORBED_STABILITY_DAYS - 1)], attempts: days }).absorbed,
    ).toBe(0);

    // Held and produced, but all in one sitting: cramming.
    expect(
      standing({
        progress: [held(item(1))],
        attempts: [
          attempt({ itemId: item(1), at: 10 * DAY }),
          attempt({ itemId: item(1), at: 10 * DAY + 60_000 }),
        ],
      }).absorbed,
    ).toBe(0);
  });

  it('does not count a failed attempt as a day of retrieval', () => {
    const standingWithFailures = standing({
      progress: [held(item(1))],
      attempts: [
        attempt({ itemId: item(1), at: 10 * DAY, grade: 'again' }),
        attempt({ itemId: item(1), at: 11 * DAY, grade: 'again' }),
      ],
    });

    expect(standingWithFailures.absorbed).toBe(0);
    // Attempted and not absorbed is precisely what "shaky" is for.
    expect(standingWithFailures.shaky).toBe(1);
  });

  it('accepts tap-to-build as production', () => {
    const built = standing({
      progress: [held(item(1))],
      attempts: [
        attempt({ itemId: item(1), at: 10 * DAY, exerciseKind: 'tap-to-build' }),
        attempt({ itemId: item(1), at: 12 * DAY, exerciseKind: 'tap-to-build' }),
      ],
    });

    expect(built.absorbed).toBe(1);
  });

  it('reports items outside the course rather than pruning them', () => {
    const result = standing({ courseItemIds: [item(1)] });

    expect(result).toMatchObject({ total: 1, missing: 2, untouched: 1 });
    // The definition is untouched: the ids are still there to come back to.
    expect(result.batch.itemIds).toHaveLength(3);
  });

  it('counts due items inside the batch', () => {
    const due = { ...held(item(1)), dueAt: 50 * DAY };
    const later = { ...held(item(2)), dueAt: 200 * DAY };

    expect(standing({ progress: [due, later], now: 100 * DAY }).dueNow).toBe(1);
  });

  /**
   * 90%, not 100%: one stubborn item must not hold a batch hostage. Ten items
   * makes the rounding visible — nine absorbed is exactly the bar.
   */
  it('completes at ninety per cent', () => {
    const ids = Array.from({ length: 10 }, (_, index) => item(index + 1));
    const ten = batch({ itemIds: ids });
    const absorb = (count: number) => ({
      progress: ids.slice(0, count).map((one) => held(one)),
      attempts: ids
        .slice(0, count)
        .flatMap((one) => [
          attempt({ itemId: one, at: 10 * DAY }),
          attempt({ itemId: one, at: 11 * DAY }),
        ]),
    });

    expect(standing({ batch: ten, ...absorb(8) })).toMatchObject({ absorbed: 8, complete: false });
    expect(standing({ batch: ten, ...absorb(9) })).toMatchObject({ absorbed: 9, complete: true });
  });

  it('is never complete when nothing resolves', () => {
    expect(standing({ courseItemIds: [] })).toMatchObject({
      total: 0,
      missing: 3,
      complete: false,
    });
  });

  it('cannot count a duplicated id twice', () => {
    const duplicated = batch({ itemIds: [item(1), item(1), item(2)] });

    expect(standing({ batch: duplicated })).toMatchObject({ total: 2, untouched: 2 });
  });

  it('needs the production days to be that item’s own', () => {
    // Two days of producing item 2 must not graduate item 1.
    const result = standing({
      progress: [held(item(1))],
      attempts: [
        attempt({ itemId: item(2), at: 10 * DAY }),
        attempt({ itemId: item(2), at: 11 * DAY }),
      ],
    });

    expect(result.absorbed).toBe(0);
  });

  it('states the day requirement as a constant rather than a literal', () => {
    // A guard, not a tautology: the tests above hard-code two days, so a change
    // to the constant has to come with a change to them.
    expect(ABSORBED_PRODUCTION_DAYS).toBe(2);
  });
});
