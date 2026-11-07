/**
 * Asks the browser to keep this origin's storage when the device runs low.
 *
 * Local-first means the device holds the only copy of a learner's history unless
 * they export it. Without this request, the browser may evict that copy to free
 * space.
 *
 * This runs after evidence is first saved, not at boot. Firefox shows a
 * permission prompt for it, and the prompt only makes sense once there is
 * something to keep. Chromium answers silently from engagement signals and can
 * grant on a later visit what it refused today, so this asks once per page load
 * rather than once ever.
 */

/** The part of `StorageManager` this module touches; injectable for tests. */
export interface DurableStorageManager {
  persisted?(): Promise<boolean>;
  persist?(): Promise<boolean>;
}

let request: Promise<boolean | undefined> | undefined;

/**
 * Whether storage is now persistent, or `undefined` where the browser cannot say.
 * Never rejects: durability is best effort, never a reason to fail a save.
 */
export function requestDurableStorage(
  manager: DurableStorageManager | undefined = globalThis.navigator?.storage,
): Promise<boolean | undefined> {
  request ??= ask(manager);
  return request;
}

async function ask(manager: DurableStorageManager | undefined): Promise<boolean | undefined> {
  if (!manager?.persist) return undefined;
  try {
    if (await manager.persisted?.()) return true;
    return await manager.persist();
  } catch {
    return undefined;
  }
}

/** Test-only reset: the request is per page load, so it outlives a test case. */
export function resetDurableStorageRequest(): void {
  request = undefined;
}
