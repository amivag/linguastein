/** How a preset plus a URL becomes a `SessionConfig`. */

import { describe, expect, it } from 'vitest';
import type { ItemId } from '../../src/domain/content';
import { planSession } from '../../src/domain/sessions';
import { buildSessionConfig, PRESETS } from '../../src/features/practice/presets';
import { DEFAULT_PREFERENCES } from '../../src/storage';
import { seededRng } from '../../src/utils/random';
import { id, testRepository } from '../fixtures/pack';

const base = () => ({
  repository: testRepository(),
  preferences: DEFAULT_PREFERENCES,
  size: { kind: 'items', count: 20 } as const,
});

describe('buildSessionConfig', () => {
  it('caps new material in an open-ended session', () => {
    expect(buildSessionConfig(PRESETS.quick, base()).maxNewItems).toBe(8);
  });

  /**
   * The cap exists to stop "10 minutes of practice" becoming ten first
   * encounters. Applied to a chosen set it silently shrinks it instead — a
   * 12-sentence passage would practise 8 and report itself complete.
   */
  it('does not cap a set the learner picked, however new it is', () => {
    const scoped = buildSessionConfig(PRESETS.quick, {
      ...base(),
      scope: { ids: [id<ItemId>('test-es:item:001')] },
    });

    expect(scoped.maxNewItems).toBeUndefined();
  });

  it('treats an empty scope as no scope, so a bare filter still gets the cap', () => {
    expect(buildSessionConfig(PRESETS.quick, { ...base(), scope: {} }).maxNewItems).toBe(8);
  });

  it('narrows the preset with the scope rather than replacing it', () => {
    const scoped = buildSessionConfig(PRESETS.verbs, {
      ...base(),
      scope: { topics: ['work'] },
    });

    expect(scoped.filter.topics).toEqual(['work']);
    expect(scoped.filter.pos).toEqual(['VERB']);
  });

  it('passes the review-only flag through to the planner', () => {
    expect(buildSessionConfig(PRESETS.quick, { ...base(), dueOnly: true }).dueOnly).toBe(true);
    expect(buildSessionConfig(PRESETS.quick, base()).dueOnly).toBeUndefined();
  });
});

/**
 * "I keep seeing the same material" was true of exactly one preset, and not
 * because of the scheduler: Flashcards dealt in pack order, so pressing it
 * handed over the first ten items of the pack every time, for the life of the
 * install. Studying is the mode with no memory — nothing is recorded, so nothing
 * moves the pile on — which is precisely why it must not start from the top.
 */
describe('what a preset deals', () => {
  const deal = (seed: number) => {
    const repository = testRepository();
    const config = buildSessionConfig(PRESETS.flashcards, {
      ...base(),
      repository,
      size: { kind: 'items', count: 3 },
    });
    return planSession({
      repository,
      config,
      progress: new Map(),
      now: 1,
      rng: seededRng(seed),
    }).itemIds.join();
  };

  it('varies a study session rather than always dealing the first cards', () => {
    expect(new Set([deal(1), deal(2), deal(3), deal(4)]).size).toBeGreaterThan(1);
  });

  it('still deals pack order when a link asks for it', () => {
    const repository = testRepository();
    const config = buildSessionConfig(PRESETS.flashcards, {
      ...base(),
      repository,
      size: { kind: 'items', count: 3 },
      ordering: 'sequential',
    });
    const plan = planSession({ repository, config, progress: new Map(), now: 1 });

    expect(plan.itemIds).toEqual(
      repository
        .query(config.filter)
        .slice(0, 3)
        .map((item) => item.id),
    );
  });
});
