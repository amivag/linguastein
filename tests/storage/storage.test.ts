import { beforeEach, describe, expect, it } from 'vitest';
import type { ItemId } from '../../src/domain/content';
import { newItemProgress } from '../../src/domain/progress';
import {
  createIndexedDbStorage,
  createMemoryStorage,
  DEFAULT_PREFERENCES,
  openLingoDB,
  type LearnerStorage,
} from '../../src/storage';
import { id } from '../fixtures/pack';

const ITEM = id<ItemId>('test-es:item:001');

// The same contract must hold for both implementations, so a learner gets
// identical behaviour whether or not IndexedDB is available.
const implementations: readonly [string, () => Promise<LearnerStorage>][] = [
  ['memory', () => Promise.resolve(createMemoryStorage())],
  ['indexeddb', async () => createIndexedDbStorage(await openLingoDB())],
];

describe.each(implementations)('%s storage', (_name, create) => {
  let storage: LearnerStorage;

  beforeEach(async () => {
    storage = await create();
    await storage.clearAll();
  });

  it('round-trips progress', async () => {
    const progress = { ...newItemProgress(ITEM), status: 'review' as const, dueAt: 123 };
    await storage.progress.put(progress);

    expect(await storage.progress.get(ITEM)).toEqual(progress);
    expect(await storage.progress.all()).toHaveLength(1);
    expect((await storage.progress.getMany([ITEM])).get(ITEM)).toEqual(progress);
  });

  it('returns attempts newest first', async () => {
    await storage.attempts.append({
      id: 'a1',
      itemId: ITEM,
      exerciseKind: 'reveal',
      grade: 'good',
      at: 1000,
    });
    await storage.attempts.append({
      id: 'a2',
      itemId: ITEM,
      exerciseKind: 'reveal',
      grade: 'easy',
      at: 2000,
    });

    expect((await storage.attempts.recent(10)).map((attempt) => attempt.id)).toEqual(['a2', 'a1']);
    expect(await storage.attempts.forItem(ITEM)).toHaveLength(2);
  });

  it('merges preference patches over defaults', async () => {
    expect(await storage.preferences.read()).toEqual(DEFAULT_PREFERENCES);

    const updated = await storage.preferences.write({ pronunciationLocale: 'es-MX' });
    expect(updated.pronunciationLocale).toBe('es-MX');
    expect(updated.referenceLanguage).toBe(DEFAULT_PREFERENCES.referenceLanguage);
    expect((await storage.preferences.read()).pronunciationLocale).toBe('es-MX');
  });

  it('clears everything on reset', async () => {
    await storage.progress.put(newItemProgress(ITEM));
    await storage.sessions.put({
      id: 's1',
      startedAt: 1,
      planned: 5,
      completed: 5,
      correct: 4,
    });

    await storage.clearAll();
    expect(await storage.progress.all()).toEqual([]);
    expect(await storage.sessions.recent(10)).toEqual([]);
  });
});
