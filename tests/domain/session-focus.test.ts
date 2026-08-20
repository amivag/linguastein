/**
 * Practice focus: which of the things worth practising comes first.
 *
 * The load-bearing property is that a focus is a *bias*, never a filter. Every
 * focus must return the same set of items in a different order, so a learner who
 * asked for "the shaky ones" on a day when nothing is shaky gets a session
 * rather than an empty screen.
 */

import { describe, expect, it } from 'vitest';
import type { ItemId } from '../../src/domain/content';
import { newItemProgress, type ItemProgress } from '../../src/domain/progress';
import { planSession, type SessionConfig, type SessionFocus } from '../../src/domain/sessions';
import { id, testRepository } from '../fixtures/pack';

const repository = testRepository();
const NOW = 1_700_000_000_000;

const ITEM = {
  due: id<ItemId>('test-es:item:001'),
  hard: id<ItemId>('test-es:item:002'),
  harder: id<ItemId>('test-es:item:003'),
  easy: id<ItemId>('test-es:item:004'),
} as const;

/**
 * One item of each kind the planner sorts by, so a focus has something to
 * reorder: due, two weak ones of different difficulty, and a settled one. The
 * remaining fixture items carry no progress and are therefore new.
 */
function learnerState(): Map<ItemId, ItemProgress> {
  return new Map<ItemId, ItemProgress>([
    [ITEM.due, { ...newItemProgress(ITEM.due), status: 'review', attempts: 3, dueAt: NOW - 1000 }],
    [
      ITEM.hard,
      {
        ...newItemProgress(ITEM.hard),
        status: 'learning',
        attempts: 4,
        difficulty: 0.6,
        dueAt: NOW + 86_400_000,
      },
    ],
    [
      ITEM.harder,
      {
        ...newItemProgress(ITEM.harder),
        status: 'learning',
        attempts: 5,
        difficulty: 0.9,
        dueAt: NOW + 86_400_000,
      },
    ],
    [
      ITEM.easy,
      {
        ...newItemProgress(ITEM.easy),
        status: 'review',
        attempts: 6,
        difficulty: 0.1,
        dueAt: NOW + 86_400_000,
      },
    ],
  ]);
}

function ordered(focus: SessionFocus, overrides: Partial<SessionConfig> = {}): readonly ItemId[] {
  const config: SessionConfig = {
    mode: 'practice',
    filter: {},
    size: { kind: 'all' },
    ordering: 'smart',
    exerciseKinds: ['reveal'],
    referenceLanguage: 'en',
    pronunciationLocale: 'es-ES',
    seed: 11,
    focus,
    ...overrides,
  };
  return planSession({ repository, config, progress: learnerState(), now: NOW }).itemIds;
}

describe('a practice focus', () => {
  it('leads with reviews when balanced, as it always has', () => {
    expect(ordered('balanced')[0]).toBe(ITEM.due);
  });

  it('leads with the hardest item under "shaky items", worst first', () => {
    const plan = ordered('struggling');
    expect(plan[0]).toBe(ITEM.harder);
    expect(plan[1]).toBe(ITEM.hard);
  });

  it('puts new material last under "shaky items"', () => {
    const plan = ordered('struggling');
    // Consolidating what is going wrong is the opposite of meeting new words.
    const newItems = [id<ItemId>('test-es:item:005'), id<ItemId>('test-es:item:006')];
    for (const fresh of newItems) {
      expect(plan.indexOf(fresh)).toBeGreaterThan(plan.indexOf(ITEM.harder));
    }
  });

  it('leads with new material under "new material"', () => {
    const plan = ordered('fresh');
    expect([ITEM.due, ITEM.hard, ITEM.harder, ITEM.easy]).not.toContain(plan[0]);
  });

  it('clears the review queue first under "reviews"', () => {
    const plan = ordered('due');
    expect(plan[0]).toBe(ITEM.due);
    // …and unlike `dueOnly`, everything else is still in the session.
    expect(plan).toHaveLength(repository.itemCount);
  });

  /**
   * The whole reason a focus is an ordering rather than a filter: on a good day
   * "shaky items" has nothing to lead with, and the session must still happen.
   */
  it('never narrows the session, whichever focus is chosen', () => {
    const all = [...repository.allItems().map((item) => item.id)].sort();
    for (const focus of ['balanced', 'struggling', 'due', 'fresh'] as const) {
      expect([...ordered(focus)].sort(), focus).toEqual(all);
    }
  });

  it('reorders rather than reshuffles: same set, different order', () => {
    expect(ordered('struggling')).not.toEqual(ordered('fresh'));
  });

  /**
   * The cap stops "10 minutes of practice" becoming ten first encounters. Under
   * `fresh` that is what was asked for, so it has to lift — otherwise the focus
   * would silently deliver eight new items and call it new material.
   */
  it('lifts the new-item cap only for "new material"', () => {
    const capped = ordered('balanced', { maxNewItems: 1, size: { kind: 'all' } });
    const uncapped = ordered('fresh', { maxNewItems: 1, size: { kind: 'all' } });

    expect(capped).toHaveLength(5);
    expect(uncapped).toHaveLength(repository.itemCount);
  });

  it('stays reproducible under a seed', () => {
    expect(ordered('struggling')).toEqual(ordered('struggling'));
  });
});
