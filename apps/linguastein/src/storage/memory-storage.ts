/** In-memory fallback with the same serialized, rollback-safe transaction contract. */
import type { BatchDefinition } from '../domain/batches';
import type { EntityId } from '../domain/content';
import type { Attempt, SubjectProgress } from '../domain/progress';
import type { SessionRecord } from '../domain/sessions';
import {
  courseStateOf,
  DEFAULT_PREFERENCES,
  mergeCourseState,
  mergePreferences,
} from './preferences';
import type { CourseStates, LearnerStores, LearnerStorage, Preferences } from './types';

interface MemoryState {
  progress: Map<EntityId, SubjectProgress>;
  attempts: Map<string, Attempt>;
  sessions: Map<string, SessionRecord>;
  batches: Map<string, BatchDefinition>;
  preferences: Preferences;
  courses: CourseStates;
}
type Run = <T>(operation: () => T) => Promise<T>;
function stores(state: () => MemoryState, run: Run): LearnerStores {
  return {
    progress: {
      get: (subject) => run(() => state().progress.get(subject)),
      getMany: (subjects) =>
        run(
          () =>
            new Map(
              subjects.flatMap((subject) => {
                const row = state().progress.get(subject);
                return row ? [[subject, row] as const] : [];
              }),
            ),
        ),
      all: () => run(() => [...state().progress.values()]),
      count: () => run(() => state().progress.size),
      put: (row) =>
        run(() => {
          state().progress.set(row.subject, row);
        }),
      putMany: (rows) =>
        run(() => {
          for (const row of rows) state().progress.set(row.subject, row);
        }),
      clear: () =>
        run(() => {
          state().progress.clear();
        }),
    },
    attempts: {
      get: (id) => run(() => state().attempts.get(id)),
      append: (row) =>
        run(() => {
          state().attempts.set(row.id, row);
        }),
      appendMany: (rows) =>
        run(() => {
          for (const row of rows) state().attempts.set(row.id, row);
        }),
      count: () => run(() => state().attempts.size),
      recent: (limit) => run(() => [...state().attempts.values()].sort(byNewest).slice(0, limit)),
      forSubject: (subject, limit = 20) =>
        run(() =>
          [...state().attempts.values()]
            .filter((row) => row.subject === subject)
            .sort(byNewest)
            .slice(0, limit),
        ),
      all: () => run(() => [...state().attempts.values()].sort((a, b) => a.at - b.at)),
      clear: () =>
        run(() => {
          state().attempts.clear();
        }),
    },
    sessions: {
      put: (row) =>
        run(() => {
          state().sessions.set(row.id, row);
        }),
      putMany: (rows) =>
        run(() => {
          for (const row of rows) state().sessions.set(row.id, row);
        }),
      all: () =>
        run(() => [...state().sessions.values()].sort((a, b) => a.startedAt - b.startedAt)),
      count: () => run(() => state().sessions.size),
      recent: (limit, language) =>
        run(() =>
          [...state().sessions.values()]
            .filter((row) => !language || row.course.language === language)
            .sort((a, b) => b.startedAt - a.startedAt)
            .slice(0, limit),
        ),
      clear: () =>
        run(() => {
          state().sessions.clear();
        }),
    },
    batches: {
      all: () => run(() => [...state().batches.values()]),
      put: (row) =>
        run(() => {
          state().batches.set(row.id, row);
        }),
      remove: (id) =>
        run(() => {
          state().batches.delete(id);
        }),
      clear: () =>
        run(() => {
          state().batches.clear();
        }),
    },
    preferences: {
      read: () => run(() => state().preferences),
      write: (patch) =>
        run(() => {
          const next = mergePreferences(state().preferences, patch);
          state().preferences = next;
          return next;
        }),
    },
    courses: {
      read: () => run(() => state().courses),
      write: (language, patch) =>
        run(() => {
          const next = {
            ...state().courses,
            [language]: mergeCourseState(courseStateOf(state().courses, language), patch),
          };
          state().courses = next;
          return next;
        }),
    },
  };
}
export function createMemoryStorage(
  initialPreferences: Preferences = DEFAULT_PREFERENCES,
  initialCourses: CourseStates = {},
): LearnerStorage {
  const empty = (): MemoryState => ({
    progress: new Map(),
    attempts: new Map(),
    sessions: new Map(),
    batches: new Map(),
    preferences: initialPreferences,
    courses: initialCourses,
  });
  let state = empty();
  let pending: Promise<unknown> = Promise.resolve();
  function enqueue<T>(operation: () => T | Promise<T>): Promise<T> {
    const result = pending.then(operation);
    pending = result.catch(() => {});
    return result;
  }
  return {
    ...stores(() => state, enqueue),
    transaction: (operation) =>
      enqueue(async () => {
        const snapshot: MemoryState = {
          ...state,
          progress: new Map(state.progress),
          attempts: new Map(state.attempts),
          sessions: new Map(state.sessions),
          batches: new Map(state.batches),
        };
        let active = true;
        const scoped = stores(
          () => snapshot,
          async (work) => {
            if (!active) throw new Error('Transaction is inactive');
            return work();
          },
        );
        try {
          const result = await operation(scoped);
          state = snapshot;
          return result;
        } finally {
          active = false;
        }
      }),
    clearAll: () =>
      enqueue(() => {
        state = { ...empty(), preferences: DEFAULT_PREFERENCES, courses: {} };
      }),
  };
}
function byNewest(a: Attempt, b: Attempt): number {
  return b.at - a.at;
}
