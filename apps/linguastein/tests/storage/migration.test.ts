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
import {
  createIndexedDbStorage,
  DEFAULT_COURSE_STATE,
  DEFAULT_PREFERENCES,
  openAppDatabase,
} from '../../src/storage';
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
      // Under its new name, and that is version 5's whole job — the key path
      // moved from `itemId` to `subject`, so the row had to be rewritten.
      subject: REVIEWED,
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
      subject: REVIEWED,
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

/**
 * Version 3 as it shipped: one flat settings record holding both halves.
 *
 * The five values that moved are all here and all set to something other than
 * their default, because a migration that dropped them would be invisible
 * against a seed that used the defaults.
 */
async function seedVersion3(): Promise<void> {
  await deleteDB(APP.id);
  const db = await openDB(APP.id, 3, {
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

      database.createObjectStore('batches', { keyPath: 'id' });
      database.createObjectStore('meta');
    },
  });

  await db.put(
    'meta',
    {
      displayName: 'Ada',
      targetLanguage: 'fr',
      referenceLanguage: 'en',
      readingSize: 'large',
      // The five that move.
      level: 'b1',
      focusTopics: ['food-drink', 'work'],
      focus: 'struggling',
      pronunciationLocale: 'fr-CA',
      voiceName: 'Amelie',
    },
    'preferences',
  );

  db.close();
}

/**
 * Splitting the settings in two.
 *
 * The third kind of upgrade this file has seen, and the first that *rewrites* a
 * record rather than backfilling a field or adding a store. What makes it worth
 * testing is that doing nothing would not look broken: an un-migrated
 * `meta:preferences` still reads perfectly well, it just answers with the
 * defaults for everything that moved — so a learner would find their level,
 * their categories and their voice quietly reset, with nothing in any log.
 */
/**
 * Version 4 as it shipped: the settings are already split, and the two history
 * stores are still keyed on `itemId`.
 *
 * Two progress rows and two attempts, because the thing that can go wrong here
 * is *partial*: a store recreated with some rows copied and some lost would pass
 * any test that only looked at one.
 */
async function seedVersion4(): Promise<void> {
  await deleteDB(APP.id);
  const db = await openDB(APP.id, 4, {
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

      database.createObjectStore('batches', { keyPath: 'id' });
      database.createObjectStore('meta');
    },
  });

  for (const [itemId, extra] of [
    [REVIEWED, { status: 'review', attempts: 2, correct: 2, streak: 2, dueAt: 5_000 }],
    [UNSEEN, { status: 'new', attempts: 0, correct: 0, streak: 0 }],
  ] as const) {
    await db.put('progress', {
      itemId,
      packId: 'test-es',
      incorrect: 0,
      difficulty: 0.3,
      hintsUsed: 0,
      lastReviewedAt: 1_000,
      updatedAt: 1_000,
      ...extra,
    });
  }

  for (const [attemptId, itemId] of [
    ['a1', REVIEWED],
    ['a2', UNSEEN],
  ] as const) {
    await db.put('attempts', {
      id: attemptId,
      itemId,
      exerciseKind: 'think-say',
      grade: 'good',
      at: 1_000,
    });
  }

  db.close();
}

/**
 * The rename, and the only migration so far that has had to **destroy a store**
 * to do its job.
 *
 * `subject` is the `progress` store's key path, and a key path is fixed when the
 * store is created — so version 5 reads every row out, deletes the store,
 * rebuilds it and writes them back. Everything below is a way of asking the one
 * question that matters: did anything fall out on the way?
 */
describe('upgrading a version-4 database', () => {
  let upgraded: AppDatabase | undefined;

  const open = async (): Promise<AppDatabase> => {
    upgraded = await openAppDatabase();
    return upgraded;
  };

  beforeEach(seedVersion4);
  afterEach(() => {
    upgraded?.close();
    upgraded = undefined;
  });

  it('keeps every progress row, under its new key', async () => {
    const storage = createIndexedDbStorage(await open());

    expect(await storage.progress.count()).toBe(2);
    expect(await storage.progress.get(REVIEWED)).toMatchObject({
      subject: REVIEWED,
      status: 'review',
      attempts: 2,
      correct: 2,
      streak: 2,
      dueAt: 5_000,
      packId: 'test-es',
    });
    // The row nobody has practised matters as much: a store rebuilt from
    // `by-status` or `by-due` rather than from `getAll` would drop it.
    expect(await storage.progress.get(UNSEEN)).toMatchObject({ subject: UNSEEN, attempts: 0 });
  });

  /**
   * Through the indexes rather than the store, for the reason version 2's block
   * gives: a row that never reached an index is still in `getAll()`, so reading
   * it that way would report a rebuild that had quietly lost every query the
   * app actually makes.
   */
  it('rebuilds the indexes the recreated store needs', async () => {
    const db = await open();

    expect(await db.getAllFromIndex('progress', 'by-pack', 'test-es')).toHaveLength(2);
    expect(await db.getAllFromIndex('progress', 'by-status', 'review')).toHaveLength(1);
    expect(
      await db.getAllFromIndex('progress', 'by-due', IDBKeyRange.upperBound(10_000)),
    ).toHaveLength(1);
  });

  it('keeps every attempt, and finds it under the new index', async () => {
    const storage = createIndexedDbStorage(await open());

    expect(await storage.attempts.count()).toBe(2);
    expect((await storage.attempts.all()).map((attempt) => attempt.subject)).toEqual([
      REVIEWED,
      UNSEEN,
    ]);
    // `forSubject` reads `by-subject`, which is built from the stored key path —
    // so a row rewritten without `subject` would be absent here while still
    // showing up in the count above. That gap is the whole risk.
    expect(await storage.attempts.forSubject(REVIEWED)).toHaveLength(1);
  });

  it('loses nothing else on the way past', async () => {
    const storage = createIndexedDbStorage(await open());

    expect((await storage.preferences.read()).targetLanguage).toBe(
      DEFAULT_PREFERENCES.targetLanguage,
    );
    expect(await storage.batches.all()).toEqual([]);
  });
});

/**
 * A version-3 database that has rows but **no stored settings**.
 *
 * The combination matters: version 4 returns as soon as it finds no settings to
 * split, and a version-change transaction commits the moment the microtask queue
 * drains with no request pending. So an early return there used to leave the
 * transaction dead before version 5 could open a store — and version 5 is the
 * one that renames the key every progress row is found by.
 *
 * Nothing about that looked wrong: the settings migrated, the database opened,
 * and the history quietly stayed in the old shape.
 */
async function seedVersion3WithRowsAndNoSettings(): Promise<void> {
  await deleteDB(APP.id);
  const db = await openDB(APP.id, 3, {
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

      database.createObjectStore('batches', { keyPath: 'id' });
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
    updatedAt: 1_000,
  });

  db.close();
}

describe('upgrading a version-3 database that has no settings', () => {
  let upgraded: AppDatabase | undefined;

  beforeEach(seedVersion3WithRowsAndNoSettings);
  afterEach(() => {
    upgraded?.close();
    upgraded = undefined;
  });

  it('still renames the key on every progress row', async () => {
    upgraded = await openAppDatabase();
    const storage = createIndexedDbStorage(upgraded);

    expect(await storage.progress.get(REVIEWED)).toMatchObject({ subject: REVIEWED });
  });
});

describe('upgrading a version-3 database', () => {
  let upgraded: AppDatabase | undefined;

  const open = async (): Promise<AppDatabase> => {
    upgraded = await openAppDatabase();
    return upgraded;
  };

  beforeEach(seedVersion3);
  afterEach(() => {
    upgraded?.close();
    upgraded = undefined;
  });

  it('moves the five course settings under the language they were chosen in', async () => {
    const storage = createIndexedDbStorage(await open());

    // French, because that is what the learner was studying — the one course
    // those values could possibly have been about.
    expect((await storage.courses.read())['fr']).toEqual({
      level: 'b1',
      focusTopics: ['food-drink', 'work'],
      focus: 'struggling',
      pronunciationLocale: 'fr-CA',
      voiceName: 'Amelie',
    });
  });

  it('leaves the device settings where they were', async () => {
    const storage = createIndexedDbStorage(await open());
    const preferences = await storage.preferences.read();

    expect(preferences.displayName).toBe('Ada');
    expect(preferences.targetLanguage).toBe('fr');
    expect(preferences.readingSize).toBe('large');
  });

  it('takes the moved fields out of the settings record', async () => {
    const db = await open();

    /*
     * Read raw rather than through the store, which is the only way to see this:
     * `readPreferences` drops unknown keys, so a `level` left behind in `meta`
     * would be invisible through the API and would still be there to be found by
     * an importer, an export, or the next person to read the record by hand.
     */
    const raw = (await db.get('meta', 'preferences')) as Record<string, unknown>;
    expect(Object.keys(raw)).not.toContain('level');
    expect(Object.keys(raw)).not.toContain('voiceName');
    expect(Object.keys(raw)).not.toContain('focusTopics');
  });

  /**
   * A record written before one of the five existed has no value for it, and the
   * migration must not invent one.
   *
   * Writing `undefined` into the course would shadow the default with a hole,
   * which is a different thing from never having chosen: `courseStateOf` answers
   * with the defaults for a course it has never seen, and that is the right
   * answer for a field nobody ever set.
   */
  it('does not invent a value for a field the old record never had', async () => {
    await deleteDB(APP.id);
    const seeded = await openDB(APP.id, 3, {
      upgrade(database) {
        database.createObjectStore('meta');
      },
    });
    await seeded.put('meta', { targetLanguage: 'es', level: 'a2' }, 'preferences');
    seeded.close();

    const db = await open();
    const storage = createIndexedDbStorage(db);

    // Raw, because this is a claim about what was *written*: reading through the
    // store fills every absent field with its default, which is the right answer
    // to give a caller and would hide a hole written into the record.
    const raw = (await db.get('meta', 'courses')) as Record<string, Record<string, unknown>>;
    expect(Object.keys(raw['es'] ?? {})).toEqual(['level']);

    // And through the API it reads as a course that has only ever set a level.
    const course = (await storage.courses.read())['es'];
    expect(course?.level).toBe('a2');
    expect(course?.voiceName).toBe(DEFAULT_COURSE_STATE.voiceName);
    expect(course?.focus).toBe(DEFAULT_COURSE_STATE.focus);
  });

  it('has nothing to split on a database with no settings yet', async () => {
    await deleteDB(APP.id);
    const seeded = await openDB(APP.id, 3, {
      upgrade(database) {
        database.createObjectStore('meta');
      },
    });
    seeded.close();

    const storage = createIndexedDbStorage(await open());

    expect(await storage.courses.read()).toEqual({});
    expect(await storage.preferences.read()).toEqual(DEFAULT_PREFERENCES);
  });
});
