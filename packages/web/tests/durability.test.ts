/**
 * Asking the browser to keep an app's data.
 *
 * Without persistence the browser may clear storage under pressure, and in a
 * local-first app that is the only copy. Pinned: once per page load, never
 * failing whatever asked.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  requestDurableStorage,
  resetDurableStorageRequest,
  type DurableStorageManager,
} from '../src/index.ts';

afterEach(() => {
  resetDurableStorageRequest();
});

function manager(persisted: boolean, granted: boolean) {
  return {
    persisted: vi.fn(async () => persisted),
    persist: vi.fn(async () => granted),
  } satisfies DurableStorageManager;
}

describe('requestDurableStorage', () => {
  it('asks when storage is not yet persistent', async () => {
    const storage = manager(false, true);

    await expect(requestDurableStorage(storage)).resolves.toBe(true);
    expect(storage.persist).toHaveBeenCalledTimes(1);
  });

  it('does not ask again when storage is already persistent', async () => {
    const storage = manager(true, true);

    await expect(requestDurableStorage(storage)).resolves.toBe(true);
    expect(storage.persist).not.toHaveBeenCalled();
  });

  it('asks once per page load, however many callers follow', async () => {
    const storage = manager(false, false);

    await requestDurableStorage(storage);
    await requestDurableStorage(storage);

    expect(storage.persist).toHaveBeenCalledTimes(1);
  });

  it('answers undefined where the browser has no such API or it throws', async () => {
    await expect(requestDurableStorage({})).resolves.toBeUndefined();
    resetDurableStorageRequest();
    await expect(
      requestDurableStorage({ persist: () => Promise.reject(new Error('denied')) }),
    ).resolves.toBeUndefined();
  });
});
