/**
 * Opening a version-1 database with the version-2 code.
 *
 * The two fields added in version 2 are the reason this file exists. `packId` is
 * indexed, and an IndexedDB index is built from a stored key path and nothing
 * else — a row that keeps no `packId` is *absent* from `by-pack`, which reads
 * exactly like lost history rather than like a missing field. `updatedAt` is
 * what a future merge of two devices compares, so a row that arrives without one
 * is a row a merge cannot reason about.
 *
 * So the assertions here are deliberately about the old rows, not the new ones:
 * a fresh install exercises none of this.
 */

import { deleteDB, openDB } from 'idb';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { APP } from '../../src/app/identity';
import type { ItemId } from '../../src/domain/content';
import { createIndexedDbStorage, openAppDatabase } from '../../src/storage';
import { id } from '../fixtures/pack';

const REVIEWED = id<ItemId>('test-es:item:001');
const UNSEEN = id<ItemId>('test-es:item:002');

/** The schema exactly as version 1 shipped it, with rows in the old shape. */
async function seedVersion1(): Promise<void> {
  await deleteDB(APP.id);
  const db = await openDB(APP.id, 1, {
    upgrade(database) {
      const progress = database.createObjectStore('progress', { keyPath: 'itemId' });
      progress.createIndex('by-due', 'dueAt');
      progress.createIndex('by-status', 'status');

      const attempts = database.createObjectStore('attempts', { keyPath: 'id' });
      attempts.createIndex('by-item', 'itemId');
      attempts.createIndex('by-time', 'at');

      const sessions = database.createObjectStore('sessions', { keyPath: 'id' });
      sessions.createIndex('by-time', 'startedAt');

      database.createObjectStore('meta');
    },
  });

  await db.put('progress', {
    itemId: REVIEWED,
    status: 'review',
    attempts: 2,
    correct: 2,
    incorrect: 0,
    difficulty: 0.3,
    hintsUsed: 0,
    streak: 2,
    lastReviewedAt: 1_000,
    dueAt: 5_000,
  });
  await db.put('progress', {
    itemId: UNSEEN,
    status: 'new',
    attempts: 0,
    correct: 0,
    incorrect: 0,
    difficulty: 0.3,
    hintsUsed: 0,
    streak: 0,
  });
  await db.put('sessions', {
    id: 'session-1',
    startedAt: 500,
    endedAt: 900,
    planned: 3,
    completed: 3,
    correct: 2,
  });
  // The learner was studying French, which is the only evidence of what the
  // session above was.
  await db.put('meta', { targetLanguage: 'fr', level: 'a1' }, 'preferences');

  db.close();
}

type AppDatabase = Awaited<ReturnType<typeof openAppDatabase>>;

describe('upgrading a version-1 database', () => {
  /**
   * Held so it can be closed again. `deleteDB` blocks on an open connection, so
   * a case that leaves one behind times out the *next* case's setup rather than
   * failing itself — which is a confusing way to find out.
   */
  let upgraded: AppDatabase | undefined;

  const open = async (): Promise<AppDatabase> => {
    upgraded = await openAppDatabase();
    return upgraded;
  };

  beforeEach(seedVersion1);
  afterEach(() => {
    upgraded?.close();
    upgraded = undefined;
  });

  it('backfills the pack, so the new index finds the old rows', async () => {
    const db = await open();

    // The assertion that matters: read through the index, not the store. A row
    // the backfill missed would still be in `getAll()` and simply not here.
    expect(await db.getAllFromIndex('progress', 'by-pack', 'test-es')).toHaveLength(2);
  });

  it('dates a row from its last review, never from the migration', async () => {
    const storage = createIndexedDbStorage(await open());

    // Stamping every row with `Date.now()` would make a merge prefer whichever
    // device happened to open the app last, which is the opposite of evidence.
    expect((await storage.progress.get(REVIEWED))?.updatedAt).toBe(1_000);
    // Never reviewed, so there is nothing to date it by; epoch zero loses to any
    // row somebody has actually written.
    expect((await storage.progress.get(UNSEEN))?.updatedAt).toBe(0);
  });

  it('attributes an old session to the language the learner was studying', async () => {
    const storage = createIndexedDbStorage(await open());

    const [record] = await storage.sessions.recent(10);
    expect(record?.course.language).toBe('fr');
    // `all` is the absence of a claim: a version-1 row never recorded a level.
    expect(record?.course.level).toBe('all');

    // And it is still found by the filter the Progress screen passes.
    expect(await storage.sessions.recent(10, 'fr')).toHaveLength(1);
    expect(await storage.sessions.recent(10, 'es')).toHaveLength(0);
  });

  it('keeps everything else the row already held', async () => {
    const storage = createIndexedDbStorage(await open());

    expect(await storage.progress.get(REVIEWED)).toMatchObject({
      itemId: REVIEWED,
      status: 'review',
      attempts: 2,
      correct: 2,
      streak: 2,
      dueAt: 5_000,
    });
  });
});
