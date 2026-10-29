/** Transactions protect every writer, not just the queue in one React app. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createIndexedDbStorage,
  createMemoryStorage,
  DEFAULT_PREFERENCES,
  openAppDatabase,
  saveAttempts,
  type LearnerStorage,
  type LearnerStores,
} from '../../src/storage';
import { replaySubject, type Attempt } from '../../src/domain/progress';
import type { ItemId } from '../../src/domain/content';
import { applyExport, buildExport } from '../../src/storage/transfer';
import { id } from '../fixtures/pack';

const ITEM = id<ItemId>('test-es:item:001');
const OTHER = id<ItemId>('test-es:item:002');
const NOW = 1_757_030_400_000;
const first: Attempt = {
  id: 'a1',
  subject: ITEM,
  exerciseKind: 'think-say',
  grade: 'good',
  at: NOW,
};
const second: Attempt = { ...first, id: 'a2', at: NOW + 86_400_000 };
const options = { app: 'test', now: NOW, packs: [{ id: 'test-es', version: '1.0.0' }] };
const importing = { installedPacks: ['test-es'], settings: true };
function failingProjection(storage: LearnerStorage): LearnerStorage {
  return {
    ...storage,
    transaction: (operation) =>
      storage.transaction((tx) =>
        operation({
          ...tx,
          progress: {
            ...tx.progress,
            put: async () => {
              throw new Error('Injected projection failure');
            },
            putMany: async () => {
              throw new Error('Injected projection failure');
            },
          },
        }),
      ),
  };
}

describe.each(['memory', 'indexeddb'])('%s atomic persistence', (kind) => {
  let storage: LearnerStorage;
  let close: (() => void) | undefined;
  beforeEach(async () => {
    if (kind === 'memory') storage = createMemoryStorage();
    else {
      const db = await openAppDatabase();
      close = () => db.close();
      storage = createIndexedDbStorage(db);
    }
    await storage.clearAll();
  });
  afterEach(() => close?.());

  it('commits records and settings together and returns a callback result', async () => {
    const result = await storage.transaction(async (tx) => {
      await tx.attempts.append(first);
      await tx.progress.put(replaySubject(ITEM, [first])!);
      await tx.preferences.write({ displayName: 'Ada' });
      await tx.courses.write('es', { level: 'a2' });
      return 'committed';
    });
    expect(result).toBe('committed');
    expect((await storage.progress.get(ITEM))?.attempts).toBe(1);
    expect(await storage.attempts.get(first.id)).toEqual(first);
    expect((await storage.preferences.read()).displayName).toBe('Ada');
    expect((await storage.courses.read()).es?.level).toBe('a2');
  });

  it('rolls back every store after a late failure and accepts later work', async () => {
    await expect(
      storage.transaction(async (tx) => {
        await tx.attempts.append(first);
        await tx.progress.put(replaySubject(ITEM, [first])!);
        await tx.sessions.put({
          id: 's1',
          course: { language: 'es', level: 'a1' },
          startedAt: NOW,
          planned: 1,
          completed: 1,
          correct: 1,
        });
        await tx.batches.put({
          id: 'b1',
          label: 'Set',
          course: { language: 'es', level: 'a1' },
          itemIds: [ITEM],
          createdAt: NOW,
        });
        await tx.preferences.write({ displayName: 'Ada' });
        await tx.courses.write('es', { level: 'a2' });
        throw new Error('Late failure');
      }),
    ).rejects.toThrow('Late failure');
    expect(await storage.attempts.count()).toBe(0);
    expect(await storage.progress.count()).toBe(0);
    expect(await storage.sessions.count()).toBe(0);
    expect(await storage.batches.all()).toEqual([]);
    expect(await storage.preferences.read()).toEqual(DEFAULT_PREFERENCES);
    expect(await storage.courses.read()).toEqual({});
    await saveAttempts(storage, [first]);
    expect(await storage.attempts.count()).toBe(1);
  });

  it('does not expose transaction-scoped stores after completion', async () => {
    let held: LearnerStores | undefined;
    await storage.transaction(async (tx) => {
      held = tx;
      await tx.preferences.read();
    });
    await expect(held!.preferences.write({ displayName: 'Late' })).rejects.toThrow();
    expect((await storage.preferences.read()).displayName).toBe('');
  });

  it('serializes concurrent preference patches and per-course patches', async () => {
    await Promise.all([
      storage.preferences.write({ displayName: 'Ada' }),
      storage.preferences.write({ theme: 'dark' }),
    ]);
    expect(await storage.preferences.read()).toMatchObject({ displayName: 'Ada', theme: 'dark' });
    await Promise.all([
      storage.courses.write('es', { level: 'a2' }),
      storage.courses.write('es', { voiceName: 'Mónica' }),
      storage.courses.write('fr', { level: 'a1' }),
    ]);
    expect(await storage.courses.read()).toMatchObject({
      es: { level: 'a2', voiceName: 'Mónica' },
      fr: { level: 'a1' },
    });
  });

  it('serializes standalone writes with a multi-store transaction', async () => {
    await Promise.all([
      storage.transaction(async (tx) => {
        await tx.preferences.write({ displayName: 'Ada' });
        await tx.courses.write('es', { level: 'a2' });
      }),
      storage.preferences.write({ theme: 'dark' }),
    ]);
    expect(await storage.preferences.read()).toMatchObject({ displayName: 'Ada', theme: 'dark' });
    expect((await storage.courses.read()).es?.level).toBe('a2');
  });

  it('counts concurrent practice once each, and safely retries identical attempts', async () => {
    await Promise.all([saveAttempts(storage, [first]), saveAttempts(storage, [second])]);
    expect(await storage.progress.get(ITEM)).toEqual(replaySubject(ITEM, [first, second]));
    await saveAttempts(storage, [first, second]);
    expect(await storage.attempts.count()).toBe(2);
    expect(await storage.progress.get(ITEM)).toEqual(replaySubject(ITEM, [first, second]));
  });

  it('commits no evidence when its projection fails, then retries without duplication', async () => {
    await expect(saveAttempts(failingProjection(storage), [first])).rejects.toThrow('Injected');
    expect(await storage.attempts.count()).toBe(0);
    expect(await storage.progress.get(ITEM)).toBeUndefined();
    await saveAttempts(storage, [first]);
    expect(await storage.attempts.count()).toBe(1);
    expect((await storage.progress.get(ITEM))?.attempts).toBe(1);
  });

  it('replays out-of-order and same-time attempts canonically, beyond the recent-page limit', async () => {
    const log = Array.from({ length: 25 }, (_, i): Attempt => ({
      ...first,
      id: `a${i}`,
      at: NOW + i * 86_400_000,
    }));
    await saveAttempts(storage, log);
    const older: Attempt = { ...first, id: 'older', at: NOW - 1, grade: 'again' };
    const tied: Attempt = { ...first, id: 'tie', at: log.at(-1)!.at, grade: 'again' };
    await saveAttempts(storage, [older, tied]);
    expect(await storage.progress.get(ITEM)).toEqual(replaySubject(ITEM, [...log, older, tied]));
  });

  it('refuses conflicting immutable ids and rolls back earlier work in the batch', async () => {
    await saveAttempts(storage, [first]);
    await expect(
      saveAttempts(storage, [
        { ...second, subject: OTHER },
        { ...first, grade: 'again' },
      ]),
    ).rejects.toThrow('different evidence');
    expect(await storage.attempts.count()).toBe(1);
    expect(await storage.progress.get(OTHER)).toBeUndefined();
    expect(await storage.progress.get(ITEM)).toEqual(replaySubject(ITEM, [first]));
  });

  it('rolls back an entire import when projection writing fails', async () => {
    const source = createMemoryStorage();
    await saveAttempts(source, [first, second]);
    await source.preferences.write({ displayName: 'Imported' });
    const envelope = await buildExport(source, options);
    await expect(applyExport(failingProjection(storage), envelope, importing)).rejects.toThrow(
      'Injected',
    );
    expect(await storage.attempts.count()).toBe(0);
    expect(await storage.progress.count()).toBe(0);
    expect((await storage.preferences.read()).displayName).toBe('');
    await applyExport(storage, envelope, importing);
    expect(await storage.attempts.count()).toBe(2);
    expect((await storage.preferences.read()).displayName).toBe('Imported');
  });

  it('repairs a legacy interrupted import even when every attempt is already held', async () => {
    await saveAttempts(storage, [first]);
    await storage.attempts.append(second);
    const source = createMemoryStorage();
    await saveAttempts(source, [first, second]);
    const report = await applyExport(storage, await buildExport(source, options), importing);
    expect(report.attemptsAdded).toBe(0);
    expect(report.itemsRebuilt).toBe(1);
    expect(await storage.progress.get(ITEM)).toEqual(replaySubject(ITEM, [first, second]));
  });

  it('deduplicates incoming ids and refuses a conflicting import without partial writes', async () => {
    const source = createMemoryStorage();
    await saveAttempts(source, [first]);
    const envelope = await buildExport(source, options);
    const report = await applyExport(storage, { ...envelope, attempts: [first, first] }, importing);
    expect(report.attemptsAdded).toBe(1);
    await expect(
      applyExport(
        storage,
        { ...envelope, attempts: [second, { ...first, grade: 'again' }] },
        importing,
      ),
    ).rejects.toThrow('different evidence');
    expect(await storage.attempts.count()).toBe(1);
  });
});

it('merges settings across separate database connections', async () => {
  const firstDb = await openAppDatabase();
  const secondDb = await openAppDatabase();
  const one = createIndexedDbStorage(firstDb);
  const two = createIndexedDbStorage(secondDb);
  try {
    await one.clearAll();
    await Promise.all([
      one.preferences.write({ displayName: 'Ada' }),
      two.preferences.write({ theme: 'dark' }),
    ]);
    expect(await one.preferences.read()).toMatchObject({ displayName: 'Ada', theme: 'dark' });
    await Promise.all([
      one.courses.write('es', { level: 'a2' }),
      two.courses.write('fr', { level: 'a1' }),
    ]);
    expect(await two.courses.read()).toMatchObject({ es: { level: 'a2' }, fr: { level: 'a1' } });
  } finally {
    firstDb.close();
    secondDb.close();
  }
});

it('clears initial course settings in memory just as IndexedDB clears metadata', async () => {
  const seeded = createMemoryStorage(DEFAULT_PREFERENCES, {
    es: {
      level: 'a2',
      focusTopics: [],
      focus: 'balanced',
      pronunciationLocale: 'es',
      voiceName: '',
    },
  });
  await seeded.clearAll();
  expect(await seeded.courses.read()).toEqual({});
});
