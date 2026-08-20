/**
 * The elapsed-time readout.
 *
 * No limit, no countdown, no penalty — so what has to hold is that it *reports*
 * and nothing more: it is switchable off, it does not announce itself every
 * second to a screen reader, and it freezes when the session ends rather than
 * running on under the results.
 */

import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionScreen } from '../../src/features/practice/SessionScreen';
import { SettingsScreen } from '../../src/features/settings/SettingsScreen';
import { formatDuration, spokenDuration } from '../../src/features/practice/duration';
import { DEFAULT_PREFERENCES, type Preferences } from '../../src/storage';
import { renderWithServices, testServices } from '../fixtures/services';

describe('formatDuration', () => {
  it('reads as a clock, and grows an hours field only when it needs one', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(7_000)).toBe('0:07');
    expect(formatDuration(247_000)).toBe('4:07');
    expect(formatDuration(3_847_000)).toBe('1:04:07');
  });

  it('never shows a negative reading, whatever the clocks did', () => {
    expect(formatDuration(-5_000)).toBe('0:00');
  });
});

describe('spokenDuration', () => {
  it('says the same thing in words, for the accessible name', () => {
    expect(spokenDuration(7_000)).toBe('7 seconds');
    expect(spokenDuration(61_000)).toBe('1 minute 1 second');
    expect(spokenDuration(247_000)).toBe('4 minutes 7 seconds');
  });
});

describe('during a session', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const start = (preferences: Partial<Preferences> = {}) =>
    renderWithServices(<SessionScreen />, {
      services: testServices({ preferences: { ...DEFAULT_PREFERENCES, ...preferences } }),
      route: '/session?preset=flashcards&size=items:2&order=sequential',
    });

  it('shows the time the session has been running', async () => {
    start();

    const timer = await screen.findByRole('timer');
    expect(timer).toHaveTextContent('0:00');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(timer).toHaveTextContent('0:05');
  });

  /**
   * A timer wired to a live region would interrupt a screen reader every
   * second. The name carries the reading for anyone who asks for it; the total
   * is announced once, on the summary, where it is actually news.
   */
  it('does not announce itself every second', async () => {
    start();

    const timer = await screen.findByRole('timer');
    expect(timer).not.toHaveAttribute('aria-live');
    expect(timer).toHaveAccessibleName(/Elapsed time/);
  });

  it('is absent when the learner has switched it off', async () => {
    start({ showTimer: false });

    await screen.findByRole('button', { name: 'Reveal' });
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
  });

  it('reports the total and the pace once the session is over', async () => {
    const user = userEvent.setup();
    start();

    for (let card = 0; card < 2; card++) {
      await user.click(await screen.findByRole('button', { name: 'Reveal' }));
      await user.click(screen.getByRole('button', { name: 'Good' }));
    }

    // Frozen: the clock stops with the session rather than running on under the
    // results screen.
    expect(await screen.findByText(/not scored/)).toBeInTheDocument();
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^Took /)).toBeInTheDocument();
    expect(screen.getByText(/per card/)).toBeInTheDocument();
  });
});

describe('the setting', () => {
  it('is offered, and says that nothing is being imposed', async () => {
    const user = userEvent.setup();
    const written: Partial<Preferences>[] = [];
    renderWithServices(<SettingsScreen />, {
      route: '/settings',
      updatePreferences: (patch) => written.push(patch),
    });

    const toggle = await screen.findByRole('checkbox', { name: 'Show elapsed time' });
    expect(toggle).toBeChecked();
    expect(screen.getByText(/no limit and no penalty/)).toBeInTheDocument();

    await user.click(toggle);
    expect(written).toEqual([{ showTimer: false }]);
  });
});
