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
import { newProgress } from '../../src/domain/progress';
import {
  createMemoryStorage,
  DEFAULT_COURSE_STATE,
  DEFAULT_PREFERENCES,
  type CourseState,
  type Preferences,
} from '../../src/storage';
import { READING_SIZE_STORAGE_KEY } from '../../src/styles/reading-size';
import { THEME_STORAGE_KEY } from '../../src/styles/themes';
import { id } from '../fixtures/pack';
import { renderWithServices, testServices } from '../fixtures/services';

const ITEM = id<ItemId>('test-es:item:001');

/** Storage with something in every store worth losing. */
async function storageWithHistory() {
  const storage = createMemoryStorage();
  await storage.progress.put({ ...newProgress(ITEM), attempts: 3 });
  await storage.attempts.append({
    id: 'attempt-1',
    subject: ITEM,
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

const BATCH = {
  id: 'batch-1',
  label: 'Food nouns',
  course: { language: 'es', level: 'a1' },
  itemIds: [ITEM],
  createdAt: 1_700_000_000_000,
} as const;

async function renderSettings(
  updatePreferences?: (patch: Partial<Preferences>) => void,
  removeBatch?: (id: string) => void,
  updateCourse?: (language: string, patch: Partial<CourseState>) => void,
) {
  const storage = await storageWithHistory();
  await storage.batches.put(BATCH);
  const view = renderWithServices(<SettingsScreen />, {
    services: testServices({ storage, batches: [BATCH] }),
    // The reset controls live in the About section; the tab is part of the URL.
    route: '/settings?tab=about',
    ...(updatePreferences ? { updatePreferences } : {}),
    ...(removeBatch ? { removeBatch } : {}),
    ...(updateCourse ? { updateCourse } : {}),
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
    await storage.preferences.write({ referenceLanguage: 'de' });
    // Both halves of the settings, because they are two records now and only
    // one of them was ever checked: a reset that kept the device preferences
    // and quietly wiped every course's level, categories and voice would pass
    // the assertion above and still be the bug this test exists to catch.
    await storage.courses.write('es', { voiceName: 'Paulina' });

    await user.click(screen.getByRole('button', { name: 'Reset progress' }));
    await user.click(screen.getByRole('button', { name: 'Erase learning history' }));

    await screen.findByText('Learning history cleared.');
    expect((await storage.preferences.read()).referenceLanguage).toBe('de');
    expect((await storage.courses.read())['es']?.voiceName).toBe('Paulina');
  });

  /**
   * A batch is material the learner chose, not evidence of what they did with
   * it — so clearing the evidence hands the same sets back to start again on.
   * Erasing them here would make "reset progress" destroy work nobody asked it
   * to touch, and there is nowhere to restore it from.
   */
  it('keeps batches, which are not history either', async () => {
    const user = userEvent.setup();
    const { storage } = await renderSettings();

    await user.click(screen.getByRole('button', { name: 'Reset progress' }));
    await user.click(screen.getByRole('button', { name: 'Erase learning history' }));

    await screen.findByText('Learning history cleared.');
    expect(await storage.batches.all()).toEqual([BATCH]);
  });

  it('clears history, preferences and pre-paint caches in a full local reset', async () => {
    const user = userEvent.setup();
    const updatePreferences = vi.fn();
    const removeBatch = vi.fn();
    const updateCourse = vi.fn();
    const { storage } = await renderSettings(updatePreferences, removeBatch, updateCourse);
    await storage.preferences.write({
      targetLanguage: 'fr',
      theme: 'dark',
      readingSize: 'large',
    });
    await storage.courses.write('fr', { level: 'all', voiceName: 'Paulina' });
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    localStorage.setItem(READING_SIZE_STORAGE_KEY, 'large');

    await user.click(screen.getByRole('button', { name: 'Reset all local data' }));

    expect(await stored(storage)).toEqual({ progress: 1, attempts: 1, sessions: 1 });
    expect(screen.getByRole('alert')).toHaveTextContent('every app setting');

    await user.click(screen.getByRole('button', { name: 'Erase all local data' }));

    expect(await stored(storage)).toEqual({ progress: 0, attempts: 0, sessions: 0 });
    expect(await storage.preferences.read()).toEqual(DEFAULT_PREFERENCES);
    expect(await storage.courses.read()).toEqual({});
    expect(await storage.batches.all()).toEqual([]);
    expect(updatePreferences).toHaveBeenCalledWith(DEFAULT_PREFERENCES);
    // And the live course state, for the reason the live preferences do: the
    // reset navigates to the default course a line later, and a screen still
    // holding French at `all` would disagree with the address it lands on.
    expect(updateCourse).toHaveBeenCalledWith(
      DEFAULT_PREFERENCES.targetLanguage,
      DEFAULT_COURSE_STATE,
    );
    // The live list has to catch up too, exactly as preferences do: without this
    // a full reset would leave every batch on screen until a reload.
    expect(removeBatch).toHaveBeenCalledWith(BATCH.id);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(READING_SIZE_STORAGE_KEY)).toBeNull();
    /*
     * The confirmation, and it has to survive the navigation that follows it.
     * This assertion used to pass on a race: the reset navigated to `/es/a1`,
     * which drops `?tab=about`, so the section holding the message unmounted —
     * and whether anyone saw it depended on which render won. Asserting it after
     * the navigation has settled is what makes it a test of the behaviour rather
     * than of the timing.
     */
    expect(await screen.findByText('All local data reset to app defaults.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'About', level: 2 })).toBeInTheDocument();
  });

  it('leaves all local data intact when a full reset is cancelled', async () => {
    const user = userEvent.setup();
    const { storage } = await renderSettings();
    await storage.courses.write('es', { voiceName: 'Paulina' });

    await user.click(screen.getByRole('button', { name: 'Reset all local data' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(await stored(storage)).toEqual({ progress: 1, attempts: 1, sessions: 1 });
    expect((await storage.courses.read())['es']?.voiceName).toBe('Paulina');
  });
});
