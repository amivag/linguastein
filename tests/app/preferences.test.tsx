/**
 * Saving a setting, twice in a row.
 *
 * A settings store reads the stored record, merges the patch and puts it back.
 * Two calls that overlap therefore both read the same starting point and the
 * second put wins — silently discarding the first. Nothing hit that while every
 * preference was a lone switch; picking three practice categories in a row hits
 * it every time.
 *
 * The categories now live in `meta:courses` rather than `meta:preferences`
 * (`docs/tasks/learner-profile.md` §5.1), and the race moved with them intact:
 * one record holds every course, so `CourseStateStore.write` has exactly the
 * read-merge-put shape that made this necessary. Slowing *that* store is what
 * keeps this test pointed at the thing it was written for.
 *
 * `App` owns the fix, so this exercises the real component rather than a
 * screen's stub: the change is applied locally at once, and both stores' writes
 * are chained on one queue so they cannot interleave.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../src/app/App';
import * as services from '../../src/app/services';
import { NOTHING_TO_LOAD } from '../../src/app/content';
import { NO_OFFLINE_PACKS } from '../../src/app/offline';
import { createMemoryStorage, DEFAULT_PREFERENCES } from '../../src/storage';
import { ExerciseEngine } from '../../src/domain/exercises';
import { testRepository } from '../fixtures/pack';
import { silentAudio } from '../fixtures/services';

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
  const inner = storage.courses.write.bind(storage.courses);
  let delay = WRITE_LATENCY_MS;
  return {
    ...storage,
    courses: {
      read: storage.courses.read.bind(storage.courses),
      write: (...args: Parameters<typeof inner>) => {
        const wait = delay;
        delay = Math.max(0, delay - WRITE_LATENCY_MS / 2);
        // The read happens when the timer fires, not when write is called —
        // which is what makes two overlapping writes read the same record.
        return new Promise<Awaited<ReturnType<typeof inner>>>((resolve) => {
          setTimeout(() => void inner(...args).then(resolve), wait);
        });
      },
    },
  };
}

async function bootApp() {
  const storage = slowStorage();
  vi.spyOn(services, 'createServices').mockResolvedValue({
    repository: testRepository(),
    content: NOTHING_TO_LOAD,
    offline: NO_OFFLINE_PACKS,
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
    courses: {},
    batches: [],
    datasetIssues: [],
  });

  render(<App />);
  await screen.findByRole('heading', { level: 1, name: /Español · A1/ });
  return storage;
}

const tile = (name: RegExp) => screen.getByRole('button', { name });

/*
 * These two are among the slowest tests in the suite: 900ms of deliberately
 * injected write latency, plus real pointer events into a modal sheet. The
 * budget that makes them survive a parallel run is `testTimeout` in
 * `vite.config.ts`, set once for every test rather than per file. The `waitFor`
 * windows below are separate — they bound the assertion, not the test.
 */

describe('changing several preferences in a row', () => {
  it('keeps every one of them, not just the last to be written', async () => {
    const user = userEvent.setup();
    const storage = await bootApp();

    await user.click(screen.getByRole('button', { name: /Change what to practise/ }));
    await user.click(tile(/^Food and drink/));
    await user.click(tile(/^Work/));

    // Both, in the order they were picked.
    await waitFor(
      async () => {
        expect((await storage.courses.read())['es']?.focusTopics).toEqual(['food-drink', 'work']);
      },
      { timeout: 8000 },
    );
  });

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

  it('keeps changes to different settings from clobbering each other', async () => {
    const user = userEvent.setup();
    const storage = await bootApp();

    await user.click(screen.getByRole('button', { name: /Change what to practise/ }));
    await user.click(tile(/^Work/));
    await user.click(screen.getByRole('button', { name: /^Shaky items/ }));

    await waitFor(
      async () => {
        const stored = (await storage.courses.read())['es'];
        expect(stored?.focusTopics).toEqual(['work']);
        expect(stored?.focus).toBe('struggling');
      },
      { timeout: 8000 },
    );
  });
});
