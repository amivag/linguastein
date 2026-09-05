/**
 * In-memory storage. Used by tests and as a graceful fallback when IndexedDB
 * is unavailable (private browsing, locked-down webviews) — practice still
 * works, it just does not survive a reload.
 */

import type { BatchDefinition } from '../domain/batches';
import type { ItemId } from '../domain/content';
import type { Attempt, ItemProgress } from '../domain/progress';
import type { SessionRecord } from '../domain/sessions';
import {
  courseStateOf,
  DEFAULT_PREFERENCES,
  mergeCourseState,
  mergePreferences,
} from './preferences';
import type { CourseStates, LearnerStorage, Preferences } from './types';

export function createMemoryStorage(
  initialPreferences: Preferences = DEFAULT_PREFERENCES,
  initialCourses: CourseStates = {},
): LearnerStorage {
  const progress = new Map<ItemId, ItemProgress>();
  let attempts: Attempt[] = [];
  let sessions: SessionRecord[] = [];
  const batches = new Map<string, BatchDefinition>();
  let preferences = initialPreferences;
  let courses = initialCourses;

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
      count: () => Promise.resolve(progress.size),
      put: (record) => {
        progress.set(record.itemId, record);
        return Promise.resolve();
      },
      putMany: (rows) => {
        for (const row of rows) progress.set(row.itemId, row);
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
      /*
       * Keyed by id, like the IndexedDB store's `put`: the contract is that
       * appending an attempt twice leaves one, which is what makes an import
       * safe to run again after it was interrupted. A bare push would make the
       * memory store the only one where a re-import doubles the log.
       */
      appendMany: (incoming) => {
        const byId = new Map(attempts.map((attempt) => [attempt.id, attempt]));
        for (const attempt of incoming) byId.set(attempt.id, attempt);
        attempts = [...byId.values()];
        return Promise.resolve();
      },
      count: () => Promise.resolve(attempts.length),
      recent: (limit) => Promise.resolve([...attempts].sort(byNewest).slice(0, limit)),
      forItem: (itemId, limit = 20) =>
        Promise.resolve(
          attempts
            .filter((attempt) => attempt.itemId === itemId)
            .sort(byNewest)
            .slice(0, limit),
        ),
      all: () => Promise.resolve([...attempts].sort((a, b) => a.at - b.at)),
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
      putMany: (records) => {
        const byId = new Map(sessions.map((record) => [record.id, record]));
        for (const record of records) byId.set(record.id, record);
        sessions = [...byId.values()];
        return Promise.resolve();
      },
      all: () => Promise.resolve([...sessions].sort((a, b) => a.startedAt - b.startedAt)),
      count: () => Promise.resolve(sessions.length),
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
    courses: {
      read: () => Promise.resolve(courses),
      write: (language, patch) => {
        courses = {
          ...courses,
          [language]: mergeCourseState(courseStateOf(courses, language), patch),
        };
        return Promise.resolve(courses);
      },
    },
    clearAll: () => {
      progress.clear();
      attempts = [];
      sessions = [];
      batches.clear();
      preferences = DEFAULT_PREFERENCES;
      courses = initialCourses;
      return Promise.resolve();
    },
  };
}

function byNewest(a: Attempt, b: Attempt): number {
  return b.at - a.at;
}
