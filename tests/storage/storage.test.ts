import { beforeEach, describe, expect, it } from 'vitest';
import type { ItemId } from '../../src/domain/content';
import { newItemProgress } from '../../src/domain/progress';
import {
  createIndexedDbStorage,
  createMemoryStorage,
  DEFAULT_PREFERENCES,
  openAppDatabase,
  type LearnerStorage,
} from '../../src/storage';
import { id } from '../fixtures/pack';

const ITEM = id<ItemId>('test-es:item:001');

/** A finished session, minus the course each case supplies. */
const session = (recordId: string) => ({
  id: recordId,
  startedAt: 1_700_000_000_000,
  endedAt: 1_700_000_060_000,
  planned: 2,
  completed: 2,
  correct: 2,
});

// The same contract must hold for both implementations, so a learner gets
// identical behaviour whether or not IndexedDB is available.
const implementations: readonly [string, () => Promise<LearnerStorage>][] = [
  ['memory', () => Promise.resolve(createMemoryStorage())],
  ['indexeddb', async () => createIndexedDbStorage(await openAppDatabase())],
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

  /**
   * A progress row knows its pack without being told, because the item id says
   * so. Stored rather than derived at the call site: an IndexedDB index is built
   * from a stored key path, so "how much of this course have I done?" cannot be
   * asked of a value that only exists in memory.
   */
  it('derives the pack from the item id', async () => {
    await storage.progress.put(newItemProgress(ITEM));

    expect((await storage.progress.get(ITEM))?.packId).toBe('test-es');
  });

  /**
   * A session row carries its course because nothing else can work out what it
   * was — and the narrowing happens before the limit, so a page of two is two.
   */
  it('keeps one language out of another language’s history', async () => {
    await storage.sessions.put({ ...session('es-1'), course: { language: 'es', level: 'a1' } });
    await storage.sessions.put({ ...session('fr-1'), course: { language: 'fr', level: 'all' } });

    expect((await storage.sessions.recent(10, 'es')).map((record) => record.id)).toEqual(['es-1']);
    expect((await storage.sessions.recent(10, 'fr')).map((record) => record.id)).toEqual(['fr-1']);
    expect(await storage.sessions.recent(10)).toHaveLength(2);
  });

  it('round-trips a batch and removes one by id', async () => {
    const batch = {
      id: 'batch-1',
      label: 'Food nouns',
      course: { language: 'es', level: 'a1' } as const,
      itemIds: [ITEM],
      createdAt: 1_700_000_000_000,
      perSession: 10,
    };
    await storage.batches.put(batch);
    expect(await storage.batches.all()).toEqual([batch]);

    // A put under the same id replaces rather than duplicating, which is what
    // lets a learner rename a set without minting a second one.
    await storage.batches.put({ ...batch, label: 'Food & drink nouns' });
    const stored = await storage.batches.all();
    expect(stored).toHaveLength(1);
    expect(stored[0]?.label).toBe('Food & drink nouns');

    await storage.batches.remove('batch-1');
    expect(await storage.batches.all()).toEqual([]);
  });

  it('clears everything on reset', async () => {
    await storage.progress.put(newItemProgress(ITEM));
    await storage.sessions.put({
      id: 's1',
      course: { language: 'es', level: 'all' },
      startedAt: 1,
      planned: 5,
      completed: 5,
      correct: 4,
    });
    await storage.batches.put({
      id: 'batch-1',
      label: 'Food nouns',
      course: { language: 'es', level: 'a1' },
      itemIds: [ITEM],
      createdAt: 1,
    });

    await storage.clearAll();
    expect(await storage.progress.all()).toEqual([]);
    expect(await storage.sessions.recent(10)).toEqual([]);
    expect(await storage.batches.all()).toEqual([]);
  });
});
