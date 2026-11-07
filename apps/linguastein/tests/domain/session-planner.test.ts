import { describe, expect, it } from 'vitest';
import type { ItemId } from '../../src/domain/content';
import { newProgress, type SubjectProgress } from '../../src/domain/progress';
import { planSession, type SessionConfig } from '../../src/domain/sessions';
import { id, testRepository } from '../fixtures/pack';

const repository = testRepository();
const NOW = 1_700_000_000_000;

const config = (overrides: Partial<SessionConfig> = {}): SessionConfig => ({
  mode: 'practice',
  filter: {},
  size: { kind: 'all' },
  ordering: 'sequential',
  exerciseKinds: ['reveal'],
  referenceLanguage: 'en',
  pronunciationLocale: 'es-ES',
  ...overrides,
});

const plan = (
  overrides: Partial<SessionConfig> = {},
  progress = new Map<ItemId, SubjectProgress>(),
) => planSession({ repository, config: config(overrides), progress, now: NOW });

describe('a session’s identity', () => {
  /**
   * Every session record is keyed by this, so a clock alone is not an identity:
   * two devices starting a session in the same millisecond would collide, and
   * whichever synced second would replace the other's history.
   */
  it('distinguishes two sessions planned at the same instant', () => {
    expect(plan().id).not.toBe(plan().id);
  });

  /**
   * The suffix is drawn from the rng *after* the ordering, so it cannot change
   * which items a seed deals — and a seeded session still reproduces exactly,
   * which is the property the whole planner is built around.
   */
  it('stays reproducible under a seed, ordering included', () => {
    const first = plan({ ordering: 'random', seed: 42 });
    const second = plan({ ordering: 'random', seed: 42 });

    expect(second.id).toBe(first.id);
    expect(second.itemIds).toEqual(first.itemIds);
  });
});

describe('planSession', () => {
  it('keeps pack order for sequential sessions', () => {
    expect(plan().itemIds).toEqual(repository.allItems().map((item) => item.id));
  });

  it('limits item-based sessions', () => {
    expect(plan({ size: { kind: 'items', count: 3 } }).itemIds).toHaveLength(3);
    expect(plan({ size: { kind: 'items', count: 99 } }).itemIds).toHaveLength(7);
  });

  it('estimates a length for time-based sessions', () => {
    const session = plan({ size: { kind: 'time', minutes: 1 } });
    expect(session.itemIds).toHaveLength(5);
    expect(session.targetDurationMs).toBe(60_000);
  });

  it('shuffles reproducibly for a given seed', () => {
    const a = plan({ ordering: 'random', seed: 7 }).itemIds;
    const b = plan({ ordering: 'random', seed: 7 }).itemIds;
    const c = plan({ ordering: 'random', seed: 8 }).itemIds;

    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect([...a].sort()).toEqual([...plan().itemIds].sort());
  });

  it('applies content filters', () => {
    const session = plan({ filter: { types: ['word'] } });
    expect(session.itemIds).toHaveLength(4);
  });

  it('restricts to due items when asked', () => {
    const dueId = id<ItemId>('test-es:item:003');
    const progress = new Map<ItemId, SubjectProgress>([
      [dueId, { ...newProgress(dueId), status: 'review', dueAt: NOW - 1000 }],
      [
        id<ItemId>('test-es:item:004'),
        { ...newProgress(id<ItemId>('test-es:item:004')), dueAt: NOW + 86_400_000 },
      ],
    ]);

    expect(plan({ dueOnly: true }, progress).itemIds).toEqual([dueId]);
  });

  it('puts due and weak items before new ones in smart order', () => {
    const dueId = id<ItemId>('test-es:item:005');
    const weakId = id<ItemId>('test-es:item:006');
    const progress = new Map<ItemId, SubjectProgress>([
      [dueId, { ...newProgress(dueId), status: 'review', dueAt: NOW - 1 }],
      [weakId, { ...newProgress(weakId), status: 'learning', difficulty: 0.8, dueAt: NOW + 1 }],
    ]);

    const ordered = plan({ ordering: 'smart', seed: 3, maxNewItems: 2 }, progress).itemIds;
    expect(ordered[0]).toBe(dueId);
    expect(ordered[1]).toBe(weakId);
    // 1 due + 1 weak + at most 2 unseen items: new material stays controlled.
    expect(ordered).toHaveLength(4);
  });
});
