/**
 * "Reset progress" is the only irreversible action in the app, and learner state
 * is local by design — there is no server copy to restore from. So it is worth
 * pinning both halves: that one tap cannot trigger it, and that when it does run
 * it clears the three learner stores and leaves preferences alone.
 */

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { SettingsScreen } from '../../src/features/settings/SettingsScreen';
import type { ItemId } from '../../src/domain/content';
import { newItemProgress } from '../../src/domain/progress';
import { createMemoryStorage } from '../../src/storage';
import { id } from '../fixtures/pack';
import { renderWithServices, testServices } from '../fixtures/services';

const ITEM = id<ItemId>('test-es:item:001');

/** Storage with something in every store worth losing. */
async function storageWithHistory() {
  const storage = createMemoryStorage();
  await storage.progress.put({ ...newItemProgress(ITEM), attempts: 3 });
  await storage.attempts.append({
    id: 'attempt-1',
    itemId: ITEM,
    exerciseKind: 'reveal',
    grade: 'good',
    at: 1_700_000_000_000,
  });
  await storage.sessions.put({
    id: 'session-1',
    startedAt: 1_700_000_000_000,
    endedAt: 1_700_000_060_000,
    planned: 1,
    completed: 1,
    correct: 1,
  });
  return storage;
}

async function renderSettings() {
  const storage = await storageWithHistory();
  const view = renderWithServices(<SettingsScreen />, {
    services: testServices({ storage }),
    route: '/settings',
  });
  return { ...view, storage };
}

/** What the three learner stores hold, as one snapshot. */
async function stored(storage: Awaited<ReturnType<typeof storageWithHistory>>) {
  return {
    progress: (await storage.progress.all()).length,
    attempts: (await storage.attempts.recent(10)).length,
    sessions: (await storage.sessions.recent(10)).length,
  };
}

describe('reset progress', () => {
  it('does not erase anything on the first tap', async () => {
    const user = userEvent.setup();
    const { storage } = await renderSettings();

    await user.click(screen.getByRole('button', { name: 'Reset progress' }));

    expect(await stored(storage)).toEqual({ progress: 1, attempts: 1, sessions: 1 });
    // It asks instead, and says what will be lost.
    expect(screen.getByRole('alert')).toHaveTextContent('cannot be undone');
  });

  it('leaves everything in place when the confirmation is cancelled', async () => {
    const user = userEvent.setup();
    const { storage } = await renderSettings();

    await user.click(screen.getByRole('button', { name: 'Reset progress' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(await stored(storage)).toEqual({ progress: 1, attempts: 1, sessions: 1 });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    // Back to the resting label, not the "cleared" one.
    expect(screen.getByRole('button', { name: 'Reset progress' })).toBeInTheDocument();
  });

  it('clears progress, attempts and sessions once confirmed', async () => {
    const user = userEvent.setup();
    const { storage } = await renderSettings();

    await user.click(screen.getByRole('button', { name: 'Reset progress' }));
    await user.click(screen.getByRole('button', { name: 'Erase everything' }));

    expect(await stored(storage)).toEqual({ progress: 0, attempts: 0, sessions: 0 });
    expect(await screen.findByRole('button', { name: /Progress cleared/ })).toBeInTheDocument();
  });

  it('keeps preferences, which are not history', async () => {
    const user = userEvent.setup();
    const { storage } = await renderSettings();
    await storage.preferences.write({ voiceName: 'Paulina' });

    await user.click(screen.getByRole('button', { name: 'Reset progress' }));
    await user.click(screen.getByRole('button', { name: 'Erase everything' }));

    await screen.findByRole('button', { name: /Progress cleared/ });
    expect((await storage.preferences.read()).voiceName).toBe('Paulina');
  });
});
