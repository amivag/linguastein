import { createIndexedDbStorage, openAppDatabase } from './indexeddb-storage';
import { createMemoryStorage } from './memory-storage';
import type { LearnerStorage } from './types';

export * from './memory-storage';
export * from './preferences';
export * from './schemas';
export * from './types';
export { createIndexedDbStorage, openAppDatabase };

/**
 * Opens persistent storage, falling back to memory when IndexedDB is blocked.
 * Practice must never fail because a browser refuses to persist.
 */
export async function createStorage(): Promise<LearnerStorage> {
  if (typeof indexedDB === 'undefined') return createMemoryStorage();
  try {
    return createIndexedDbStorage(await openAppDatabase());
  } catch (error) {
    console.warn('IndexedDB unavailable, falling back to in-memory storage', error);
    return createMemoryStorage();
  }
}
