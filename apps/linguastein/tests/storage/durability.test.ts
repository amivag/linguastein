/**
 * Saving evidence asks the browser to keep it (`@platform/web` makes the request;
 * its own tests pin how). This pins when: after the attempt has committed.
 */

import { resetDurableStorageRequest, type DurableStorageManager } from '@platform/web';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EntityId } from '../../src/domain/content';
import type { Attempt } from '../../src/domain/progress';
import { createMemoryStorage, saveAttempts } from '../../src/storage';

afterEach(() => {
  resetDurableStorageRequest();
  vi.unstubAllGlobals();
});

describe('saving evidence', () => {
  it('requests durable storage once the attempt has committed', async () => {
    const storage = {
      persisted: vi.fn(async () => false),
      persist: vi.fn(async () => true),
    } satisfies DurableStorageManager;
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
