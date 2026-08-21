/**
 * IndexedDB implementation of `LearnerStorage` (spec §23).
 *
 * Schema changes go in `upgrade` with an explicit version bump; learner data
 * is migrated, never dropped.
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { APP } from '../app/identity';
import type { ItemId } from '../domain/content';
import type { Attempt, ItemProgress } from '../domain/progress';
import type { SessionRecord } from '../domain/sessions';
import { DEFAULT_PREFERENCES, mergePreferences } from './preferences';
import type { LearnerStorage, Preferences } from './types';

const DB_NAME = APP.id;
const DB_VERSION = 1;
const PREFERENCES_KEY = 'preferences';

interface AppDatabase extends DBSchema {
  progress: {
    key: string;
    value: ItemProgress;
    indexes: { 'by-due': number; 'by-status': string };
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
  meta: {
    key: string;
    value: unknown;
  };
}

export async function openAppDatabase(): Promise<IDBPDatabase<AppDatabase>> {
  return openDB<AppDatabase>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
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
    },
  });
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
      async recent(limit) {
        const all = await db.getAllFromIndex('sessions', 'by-time');
        return all.reverse().slice(0, limit);
      },
      async clear() {
        await db.clear('sessions');
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
        db.clear('meta'),
      ]);
    },
  };
}
