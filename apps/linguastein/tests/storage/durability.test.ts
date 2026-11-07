/**
 * Asking the browser to keep the learner's history.
 *
 * Without persistence the browser may clear storage under pressure, and on a
 * local-first app that is the only copy. These tests pin when and how the
 * request is made: after evidence exists, once per page load, never failing a save.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createMemoryStorage,
  requestDurableStorage,
  resetDurableStorageRequest,
  saveAttempts,
  type DurableStorageManager,
} from '../../src/storage';
import type { EntityId } from '../../src/domain/content';
import type { Attempt } from '../../src/domain/progress';

afterEach(() => {
  resetDurableStorageRequest();
  vi.unstubAllGlobals();
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

  it('asks once per page load, however many saves follow', async () => {
    const storage = manager(false, false);

    await requestDurableStorage(storage);
    await requestDurableStorage(storage);

    expect(storage.persist).toHaveBeenCalledTimes(1);
  });

  it('answers undefined where the browser has no such API or it throws', async () => {
    await expect(requestDurableStorage({})).resolves.toBeUndefined();
    resetDurableStorageRequest();
    await expect(
      requestDurableStorage({
        persist: () => Promise.reject(new Error('denied')),
      }),
    ).resolves.toBeUndefined();
  });
});

describe('saving evidence', () => {
  it('requests durable storage once the attempt has committed', async () => {
    const storage = manager(false, true);
    vi.stubGlobal('navigator', { storage });
    const attempt: Attempt = {
      id: 'attempt-1',
      subject: 'test-es:item:001' as EntityId,
      exerciseKind: 'multiple-choice',
      grade: 'good',
      at: 1_000,
    };

    await saveAttempts(createMemoryStorage(), [attempt]);
    await vi.waitFor(() => expect(storage.persist).toHaveBeenCalledTimes(1));
  });
});
