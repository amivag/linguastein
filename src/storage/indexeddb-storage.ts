/**
 * IndexedDB implementation of `LearnerStorage` (spec §23).
 *
 * Schema changes go in `upgrade` with an explicit version bump; learner data
 * is migrated, never dropped.
 */

import {
  openDB,
  type DBSchema,
  type IDBPDatabase,
  type IDBPTransaction,
  type StoreNames,
} from 'idb';
import { APP } from '../app/identity';
import type { BatchDefinition } from '../domain/batches';
import { LEVEL_SCOPE_ALL, packIdOf, type Course, type ItemId } from '../domain/content';
import type { Attempt, ItemProgress, Timestamp } from '../domain/progress';
import type { SessionRecord } from '../domain/sessions';
import { DEFAULT_PREFERENCES, mergePreferences } from './preferences';
import type { LearnerStorage, Preferences } from './types';

const DB_NAME = APP.id;
const DB_VERSION = 3;
const PREFERENCES_KEY = 'preferences';

interface AppDatabase extends DBSchema {
  progress: {
    key: string;
    value: ItemProgress;
    indexes: { 'by-due': number; 'by-status': string; 'by-pack': string };
  };
  attempts: {
    key: string;
    value: Attempt;
    indexes: { 'by-item': string; 'by-time': number };
  };
  sessions: {
    key: string;
    value: SessionRecord;
    indexes: { 'by-time': number };
  };
  /**
   * Deliberately unindexed. A batch is a deliberate act rather than a log entry,
   * so there are a handful of them and `getAll` is the honest read — and an
   * index whose key path a record lacks silently excludes that record, which is
   * the trap version 2's migration exists to document. No index, no trap.
   */
  batches: {
    key: string;
    value: BatchDefinition;
  };
  meta: {
    key: string;
    value: unknown;
  };
}

/**
 * The records as they were before version 2, which is what a migration actually
 * reads: a progress row had no `updatedAt` and no `packId`, and a session row
 * carried no course. Spelled out rather than cast away, so the compiler checks
 * the migration against the shape it is really handling.
 */
type LegacyProgress = Omit<ItemProgress, 'updatedAt'> & { readonly updatedAt?: Timestamp };
type LegacySession = Omit<SessionRecord, 'course'> & { readonly course?: Course };

type UpgradeTransaction = IDBPTransaction<AppDatabase, StoreNames<AppDatabase>[], 'versionchange'>;

export async function openAppDatabase(): Promise<IDBPDatabase<AppDatabase>> {
  return openDB<AppDatabase>(DB_NAME, DB_VERSION, {
    async upgrade(db, oldVersion, _newVersion, tx) {
      if (oldVersion < 1) {
        const progress = db.createObjectStore('progress', { keyPath: 'itemId' });
        progress.createIndex('by-due', 'dueAt');
        progress.createIndex('by-status', 'status');

        const attempts = db.createObjectStore('attempts', { keyPath: 'id' });
        attempts.createIndex('by-item', 'itemId');
        attempts.createIndex('by-time', 'at');

        const sessions = db.createObjectStore('sessions', { keyPath: 'id' });
        sessions.createIndex('by-time', 'startedAt');

        db.createObjectStore('meta');
      }

      if (oldVersion < 2) await upgradeToV2(tx, oldVersion);

      /*
       * Version 3: somewhere to keep the sets a learner assembles.
       *
       * A dozen characters against version 2's careful rewrite, and the
       * difference is worth naming rather than leaving as a happy accident: this
       * version *adds* a store, so there is no existing record to bring up to a
       * new shape and therefore nothing to backfill. Version 2 had to backfill
       * because a row missing its new key path drops out of the index built on
       * it. Neither claim is general — check which kind a future bump is before
       * copying either one.
       */
      if (oldVersion < 3) db.createObjectStore('batches', { keyPath: 'id' });
    },
  });
}

/**
 * Version 2: a progress row learns which pack it belongs to and when it was last
 * written, and a session row learns which course it was.
 *
 * The backfill is the point of it, and it runs inside the version-change
 * transaction rather than after it. An IndexedDB index is built from a stored key
 * path and nothing else, so a record missing that path is *absent* from the index
 * — a row left without `packId` would disappear from every per-pack query, which
 * reads exactly like lost history. Either the bump and the backfill both happen
 * or neither does.
 */
async function upgradeToV2(tx: UpgradeTransaction, oldVersion: number): Promise<void> {
  const progress = tx.objectStore('progress');
  if (!progress.indexNames.contains('by-pack')) progress.createIndex('by-pack', 'packId');

  // A database the branch above created a moment ago has nothing to backfill.
  if (oldVersion < 1) return;

  for (const record of (await progress.getAll()) as readonly LegacyProgress[]) {
    const packId = packIdOf(record.itemId);
    await progress.put({
      ...record,
      ...(packId ? { packId } : {}),
      // The row's own last review is the only evidence of when it was written.
      // Deliberately not `Date.now()`: stamping every old row as "just now" would
      // make a merge prefer whichever device happened to migrate last.
      updatedAt: record.updatedAt ?? record.lastReviewedAt ?? 0,
    });
  }

  const sessions = tx.objectStore('sessions');
  const stored = (await tx.objectStore('meta').get(PREFERENCES_KEY)) as
    Partial<Preferences> | undefined;
  // Which course a past session was practised in is recorded nowhere, so the
  // learner's own stored language is the best evidence available — and `all` is
  // not a claim that the session was unnarrowed, it is the absence of one.
  const course: Course = {
    language: stored?.targetLanguage ?? DEFAULT_PREFERENCES.targetLanguage,
    level: LEVEL_SCOPE_ALL,
  };

  for (const record of (await sessions.getAll()) as readonly LegacySession[]) {
    if (record.course) continue;
    await sessions.put({ ...record, course });
  }
}

export function createIndexedDbStorage(db: IDBPDatabase<AppDatabase>): LearnerStorage {
  return {
    progress: {
      async get(itemId) {
        return db.get('progress', itemId);
      },
      async getMany(itemIds) {
        const entries = await Promise.all(
          itemIds.map(async (id) => [id, await db.get('progress', id)] as const),
        );
        return new Map(
          entries.filter(
            (entry): entry is readonly [ItemId, ItemProgress] => entry[1] !== undefined,
          ),
        );
      },
      async all() {
        return db.getAll('progress');
      },
      async put(progress) {
        await db.put('progress', progress);
      },
      async clear() {
        await db.clear('progress');
      },
    },
    attempts: {
      async append(attempt) {
        await db.put('attempts', attempt);
      },
      async recent(limit) {
        const all = await db.getAllFromIndex('attempts', 'by-time');
        return all.reverse().slice(0, limit);
      },
      async forItem(itemId, limit = 20) {
        const all = await db.getAllFromIndex('attempts', 'by-item', itemId);
        return all.sort((a, b) => b.at - a.at).slice(0, limit);
      },
      async clear() {
        await db.clear('attempts');
      },
    },
    sessions: {
      async put(record) {
        await db.put('sessions', record);
      },
      async recent(limit, language) {
        // A cursor walked back from the newest, rather than every row read and
        // reversed: narrowing by language has to happen *before* the limit or a
        // page of five comes back short, and reading the whole table to hand
        // back five rows is a cost that grows with every session ever practised.
        const records: SessionRecord[] = [];
        let cursor = await db
          .transaction('sessions')
          .store.index('by-time')
          .openCursor(null, 'prev');

        while (cursor && records.length < limit) {
          if (!language || cursor.value.course.language === language) records.push(cursor.value);
          cursor = await cursor.continue();
        }

        return records;
      },
      async clear() {
        await db.clear('sessions');
      },
    },
    batches: {
      async all() {
        return db.getAll('batches');
      },
      async put(batch) {
        await db.put('batches', batch);
      },
      async remove(id) {
        await db.delete('batches', id);
      },
      async clear() {
        await db.clear('batches');
      },
    },
    preferences: {
      async read() {
        const stored = (await db.get('meta', PREFERENCES_KEY)) as Partial<Preferences> | undefined;
        return stored ? mergePreferences(DEFAULT_PREFERENCES, stored) : DEFAULT_PREFERENCES;
      },
      async write(patch) {
        const current = (await db.get('meta', PREFERENCES_KEY)) as Partial<Preferences> | undefined;
        const next = mergePreferences(mergePreferences(DEFAULT_PREFERENCES, current ?? {}), patch);
        await db.put('meta', next, PREFERENCES_KEY);
        return next;
      },
    },
    async clearAll() {
      await Promise.all([
        db.clear('progress'),
        db.clear('attempts'),
        db.clear('sessions'),
        db.clear('batches'),
        db.clear('meta'),
      ]);
    },
  };
}
