/**
 * Saving a preference, twice in a row.
 *
 * `PreferencesStore.write` reads the stored record, merges the patch and puts it
 * back. Two calls that overlap therefore both read the same starting point and
 * the second put wins — silently discarding the first. Nothing hit that while
 * every preference was a lone switch; picking three practice categories in a
 * row hits it every time.
 *
 * `App` owns the fix, so this exercises the real component rather than a
 * screen's stub: the change is applied locally at once, and the writes are
 * chained so they cannot interleave inside the store.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../src/app/App';
import * as services from '../../src/app/services';
import { createMemoryStorage, DEFAULT_PREFERENCES } from '../../src/storage';
import { ExerciseEngine } from '../../src/domain/exercises';
import { NOOP_PLAYBACK, type AudioService } from '../../src/audio';
import { testRepository } from '../fixtures/pack';

const silentAudio: AudioService = {
  play: () => Promise.resolve(NOOP_PLAYBACK),
  speak: () => Promise.resolve(NOOP_PLAYBACK),
  stop: () => {},
  canPlay: () => true,
  canSpeak: () => true,
  voicesFor: () => [],
  voiceFor: () => undefined,
  ready: () => Promise.resolve(),
};

/**
 * Storage that takes its time, and takes less of it each call — so a second
 * change made while the first is still in flight settles *before* it.
 *
 * The latency has to be long enough to outlast a click: user-event spends real
 * milliseconds dispatching pointer events, and a 30ms write completed in the gap
 * between two clicks, which hid the very race this file is about.
 */
const WRITE_LATENCY_MS = 600;

function slowStorage() {
  const storage = createMemoryStorage();
  const inner = storage.preferences.write.bind(storage.preferences);
  let delay = WRITE_LATENCY_MS;
  return {
    ...storage,
    preferences: {
      read: storage.preferences.read.bind(storage.preferences),
      write: (patch: Parameters<typeof inner>[0]) => {
        const wait = delay;
        delay = Math.max(0, delay - WRITE_LATENCY_MS / 2);
        // The read happens when the timer fires, not when write is called —
        // which is what makes two overlapping writes read the same record.
        return new Promise<Awaited<ReturnType<typeof inner>>>((resolve) => {
          setTimeout(() => void inner(patch).then(resolve), wait);
        });
      },
    },
  };
}

async function bootApp() {
  const storage = slowStorage();
  vi.spyOn(services, 'createServices').mockResolvedValue({
    repository: testRepository(),
    storage,
    audio: silentAudio,
    speech: {
      id: 'none',
      isAvailable: () => false,
      supportsLanguage: () => false,
      listen: () => Promise.reject(new Error('unavailable')),
      stop: () => {},
    },
    exercises: new ExerciseEngine(),
    preferences: DEFAULT_PREFERENCES,
    datasetIssues: [],
  });

  render(<App />);
  await screen.findByRole('heading', { level: 1, name: 'Español' });
  return storage;
}

const tile = (name: RegExp) => screen.getByRole('button', { name });

/**
 * Longer than vitest's 5s default, and deliberately.
 *
 * Two of these tests inject 900ms of write latency on purpose, then drive real
 * pointer events through a modal sheet to reach the tiles — `user-event` spends
 * real milliseconds doing that, and the picker became a focus-trapped dialog
 * rather than an inline panel, which added more. Against the default budget the
 * first test failed intermittently at ~5.1s inside a 66-file parallel run: not a
 * race in the code, just a test whose honest wall-clock had grown past the
 * ceiling. The injected latency is what gives the race a chance to happen, so
 * shortening *that* to fit would quietly stop testing anything.
 */
const SLOW_TEST_MS = 20_000;

describe('changing several preferences in a row', () => {
  it(
    'keeps every one of them, not just the last to be written',
    async () => {
      const user = userEvent.setup();
      const storage = await bootApp();

      await user.click(screen.getByRole('button', { name: /Change what to practise/ }));
      await user.click(tile(/^Food and drink/));
      await user.click(tile(/^Work/));

      // Both, in the order they were picked.
      await waitFor(
        async () => {
          expect((await storage.preferences.read()).focusTopics).toEqual(['food-drink', 'work']);
        },
        { timeout: 8000 },
      );
    },
    SLOW_TEST_MS,
  );

  it('shows the change before the write has landed', async () => {
    const user = userEvent.setup();
    await bootApp();

    await user.click(screen.getByRole('button', { name: /Change what to practise/ }));
    await user.click(tile(/^Food and drink/));

    // Applied locally, so the next tap computes from this value rather than
    // from the one it replaced — and the tile does not sit unmarked for the
    // half-second the write takes.
    expect(screen.getByRole('button', { name: /Change what to practise/ })).toHaveAccessibleName(
      /Food and drink/,
    );
  });

  it(
    'keeps changes to different preferences from clobbering each other',
    async () => {
      const user = userEvent.setup();
      const storage = await bootApp();

      await user.click(screen.getByRole('button', { name: /Change what to practise/ }));
      await user.click(tile(/^Work/));
      await user.click(screen.getByRole('button', { name: /^Shaky items/ }));

      await waitFor(
        async () => {
          const stored = await storage.preferences.read();
          expect(stored.focusTopics).toEqual(['work']);
          expect(stored.focus).toBe('struggling');
        },
        { timeout: 8000 },
      );
    },
    SLOW_TEST_MS,
  );
});
