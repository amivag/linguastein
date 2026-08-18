/** How a preset plus a URL becomes a `SessionConfig`. */

import { describe, expect, it } from 'vitest';
import type { ItemId } from '../../src/domain/content';
import { buildSessionConfig, PRESETS } from '../../src/features/practice/presets';
import { DEFAULT_PREFERENCES } from '../../src/storage';
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
    expect(scoped.filter.lexemes?.length).toBeGreaterThan(0);
  });

  it('passes the review-only flag through to the planner', () => {
    expect(buildSessionConfig(PRESETS.quick, { ...base(), dueOnly: true }).dueOnly).toBe(true);
    expect(buildSessionConfig(PRESETS.quick, base()).dueOnly).toBeUndefined();
  });
});
