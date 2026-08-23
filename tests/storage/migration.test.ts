/**
 * Opening an old database with the current code.
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
 *
 * Version 3 is a different kind of bump — it adds an empty store and touches no
 * existing record — and the second block below is what holds that claim: the
 * version-2 rows have to come through it untouched, and the new store has to
 * work on a database that was not created with it.
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

/** Version 2 as it shipped: the fields are already there, the batches are not. */
async function seedVersion2(): Promise<void> {
  await deleteDB(APP.id);
  const db = await openDB(APP.id, 2, {
    upgrade(database) {
      const progress = database.createObjectStore('progress', { keyPath: 'itemId' });
      progress.createIndex('by-due', 'dueAt');
      progress.createIndex('by-status', 'status');
      progress.createIndex('by-pack', 'packId');

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
    packId: 'test-es',
    status: 'review',
    attempts: 2,
    correct: 2,
    incorrect: 0,
    difficulty: 0.3,
    hintsUsed: 0,
    streak: 2,
    lastReviewedAt: 1_000,
    dueAt: 5_000,
    updatedAt: 1_000,
  });
  await db.put('sessions', {
    id: 'session-1',
    course: { language: 'es', level: 'a1' },
    startedAt: 500,
    endedAt: 900,
    planned: 3,
    completed: 3,
    correct: 2,
  });
  await db.put('meta', { targetLanguage: 'es', level: 'a1' }, 'preferences');

  db.close();
}

describe('upgrading a version-2 database', () => {
  let upgraded: AppDatabase | undefined;

  const open = async (): Promise<AppDatabase> => {
    upgraded = await openAppDatabase();
    return upgraded;
  };

  beforeEach(seedVersion2);
  afterEach(() => {
    upgraded?.close();
    upgraded = undefined;
  });

  it('adds the batches store to a database that never had one', async () => {
    const storage = createIndexedDbStorage(await open());

    expect(await storage.batches.all()).toEqual([]);

    const batch = {
      id: 'batch-1',
      label: 'Food nouns',
      course: { language: 'es', level: 'a1' } as const,
      itemIds: [REVIEWED],
      createdAt: 2_000,
    };
    await storage.batches.put(batch);
    expect(await storage.batches.all()).toEqual([batch]);
  });

  /**
   * The whole claim of version 3: it adds a store and rewrites nothing. A bump
   * that quietly re-put every progress row would be indistinguishable here from
   * one that did not, until the day it got the rewrite wrong.
   */
  it('leaves the version-2 rows exactly as they were', async () => {
    const db = await open();
    const storage = createIndexedDbStorage(db);

    // Through the index rather than the store, for the reason the version-1
    // block gives: a row disturbed out of `by-pack` is still in `getAll()`.
    expect(await db.getAllFromIndex('progress', 'by-pack', 'test-es')).toHaveLength(1);

    expect(await storage.progress.get(REVIEWED)).toEqual({
      itemId: REVIEWED,
      packId: 'test-es',
      status: 'review',
      attempts: 2,
      correct: 2,
      incorrect: 0,
      difficulty: 0.3,
      hintsUsed: 0,
      streak: 2,
      lastReviewedAt: 1_000,
      dueAt: 5_000,
      updatedAt: 1_000,
    });

    const [record] = await storage.sessions.recent(10);
    expect(record?.course).toEqual({ language: 'es', level: 'a1' });
  });
});
