/**
 * Learner state is local by design — there is no server copy to restore from.
 * Both reset scopes therefore need a confirmation, and they must differ in the
 * one way their labels promise: progress-only keeps preferences; full reset
 * restores a clean install.
 */

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsScreen } from '../../src/features/settings/SettingsScreen';
import type { ItemId } from '../../src/domain/content';
import { newItemProgress } from '../../src/domain/progress';
import { createMemoryStorage, DEFAULT_PREFERENCES, type Preferences } from '../../src/storage';
import { READING_SIZE_STORAGE_KEY } from '../../src/styles/reading-size';
import { THEME_STORAGE_KEY } from '../../src/styles/themes';
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
    course: { language: 'es', level: 'all' },
    startedAt: 1_700_000_000_000,
    endedAt: 1_700_000_060_000,
    planned: 1,
    completed: 1,
    correct: 1,
  });
  return storage;
}

async function renderSettings(updatePreferences?: (patch: Partial<Preferences>) => void) {
  const storage = await storageWithHistory();
  const view = renderWithServices(<SettingsScreen />, {
    services: testServices({ storage }),
    route: '/settings',
    ...(updatePreferences ? { updatePreferences } : {}),
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
  beforeEach(() => localStorage.clear());

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
    await user.click(screen.getByRole('button', { name: 'Erase learning history' }));

    expect(await stored(storage)).toEqual({ progress: 0, attempts: 0, sessions: 0 });
    expect(await screen.findByText('Learning history cleared.')).toBeInTheDocument();
  });

  it('keeps preferences, which are not history', async () => {
    const user = userEvent.setup();
    const { storage } = await renderSettings();
    await storage.preferences.write({ voiceName: 'Paulina' });

    await user.click(screen.getByRole('button', { name: 'Reset progress' }));
    await user.click(screen.getByRole('button', { name: 'Erase learning history' }));

    await screen.findByText('Learning history cleared.');
    expect((await storage.preferences.read()).voiceName).toBe('Paulina');
  });

  it('clears history, preferences and pre-paint caches in a full local reset', async () => {
    const user = userEvent.setup();
    const updatePreferences = vi.fn();
    const { storage } = await renderSettings(updatePreferences);
    await storage.preferences.write({
      targetLanguage: 'fr',
      level: 'all',
      voiceName: 'Paulina',
      theme: 'dark',
      readingSize: 'large',
    });
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    localStorage.setItem(READING_SIZE_STORAGE_KEY, 'large');

    await user.click(screen.getByRole('button', { name: 'Reset all local data' }));

    expect(await stored(storage)).toEqual({ progress: 1, attempts: 1, sessions: 1 });
    expect(screen.getByRole('alert')).toHaveTextContent('every app setting');

    await user.click(screen.getByRole('button', { name: 'Erase all local data' }));

    expect(await stored(storage)).toEqual({ progress: 0, attempts: 0, sessions: 0 });
    expect(await storage.preferences.read()).toEqual(DEFAULT_PREFERENCES);
    expect(updatePreferences).toHaveBeenCalledWith(DEFAULT_PREFERENCES);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(READING_SIZE_STORAGE_KEY)).toBeNull();
    expect(await screen.findByText('All local data reset to app defaults.')).toBeInTheDocument();
  });

  it('leaves all local data intact when a full reset is cancelled', async () => {
    const user = userEvent.setup();
    const { storage } = await renderSettings();
    await storage.preferences.write({ voiceName: 'Paulina' });

    await user.click(screen.getByRole('button', { name: 'Reset all local data' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(await stored(storage)).toEqual({ progress: 1, attempts: 1, sessions: 1 });
    expect((await storage.preferences.read()).voiceName).toBe('Paulina');
  });
});
