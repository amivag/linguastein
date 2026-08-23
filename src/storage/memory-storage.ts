/**
 * In-memory storage. Used by tests and as a graceful fallback when IndexedDB
 * is unavailable (private browsing, locked-down webviews) — practice still
 * works, it just does not survive a reload.
 */

import type { BatchDefinition } from '../domain/batches';
import type { ItemId } from '../domain/content';
import type { Attempt, ItemProgress } from '../domain/progress';
import type { SessionRecord } from '../domain/sessions';
import { DEFAULT_PREFERENCES, mergePreferences } from './preferences';
import type { LearnerStorage, Preferences } from './types';

export function createMemoryStorage(
  initialPreferences: Preferences = DEFAULT_PREFERENCES,
): LearnerStorage {
  const progress = new Map<ItemId, ItemProgress>();
  let attempts: Attempt[] = [];
  let sessions: SessionRecord[] = [];
  const batches = new Map<string, BatchDefinition>();
  let preferences = initialPreferences;

  return {
    progress: {
      get: (itemId) => Promise.resolve(progress.get(itemId)),
      getMany: (itemIds) =>
        Promise.resolve(
          new Map(
            itemIds
              .map((id) => [id, progress.get(id)] as const)
              .filter((entry): entry is readonly [ItemId, ItemProgress] => entry[1] !== undefined),
          ),
        ),
      all: () => Promise.resolve([...progress.values()]),
      put: (record) => {
        progress.set(record.itemId, record);
        return Promise.resolve();
      },
      clear: () => {
        progress.clear();
        return Promise.resolve();
      },
    },
    attempts: {
      append: (attempt) => {
        attempts.push(attempt);
        return Promise.resolve();
      },
      recent: (limit) => Promise.resolve([...attempts].sort(byNewest).slice(0, limit)),
      forItem: (itemId, limit = 20) =>
        Promise.resolve(
          attempts
            .filter((attempt) => attempt.itemId === itemId)
            .sort(byNewest)
            .slice(0, limit),
        ),
      clear: () => {
        attempts = [];
        return Promise.resolve();
      },
    },
    sessions: {
      put: (record) => {
        sessions = [record, ...sessions.filter((existing) => existing.id !== record.id)];
        return Promise.resolve();
      },
      recent: (limit, language) =>
        Promise.resolve(
          [...sessions]
            // Narrowed before the limit, exactly as the cursor-based
            // implementation does it, or the two disagree about what a page is.
            .filter((record) => !language || record.course.language === language)
            .sort((a, b) => b.startedAt - a.startedAt)
            .slice(0, limit),
        ),
      clear: () => {
        sessions = [];
        return Promise.resolve();
      },
    },
    batches: {
      all: () => Promise.resolve([...batches.values()]),
      put: (batch) => {
        batches.set(batch.id, batch);
        return Promise.resolve();
      },
      remove: (id) => {
        batches.delete(id);
        return Promise.resolve();
      },
      clear: () => {
        batches.clear();
        return Promise.resolve();
      },
    },
    preferences: {
      read: () => Promise.resolve(preferences),
      write: (patch) => {
        preferences = mergePreferences(preferences, patch);
        return Promise.resolve(preferences);
      },
    },
    clearAll: () => {
      progress.clear();
      attempts = [];
      sessions = [];
      batches.clear();
      preferences = DEFAULT_PREFERENCES;
      return Promise.resolve();
    },
  };
}

function byNewest(a: Attempt, b: Attempt): number {
  return b.at - a.at;
}
