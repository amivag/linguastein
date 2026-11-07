import { createIndexedDbStorage, openAppDatabase, type DatabaseEvents } from './indexeddb-storage';
import { createMemoryStorage } from './memory-storage';
import type { LearnerStorage } from './types';

export * from './memory-storage';
export * from './preferences';
export * from './schemas';
export * from './types';
export * from './save-attempts';
export { createIndexedDbStorage, openAppDatabase, type DatabaseEvents };

/**
 * Opens persistent storage, falling back to memory when IndexedDB is blocked.
 * Practice must never fail because a browser refuses to persist.
 *
 * "Blocked" in that sentence means refused, not waiting. An upgrade waiting on
 * another tab stays pending and reports through `events.onBlocked`, because
 * falling back to memory there would quietly discard everything practised next.
 */
export async function createStorage(events: DatabaseEvents = {}): Promise<LearnerStorage> {
  if (typeof indexedDB === 'undefined') return createMemoryStorage();
  try {
    return createIndexedDbStorage(await openAppDatabase(events));
  } catch (error) {
    console.warn('IndexedDB unavailable, falling back to in-memory storage', error);
    return createMemoryStorage();
  }
}
