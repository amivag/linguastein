/**
 * Offering a downloaded update without hijacking the page.
 *
 * The behaviour being pinned is the restraint: `vite-plugin-pwa`'s `autoUpdate`
 * mode reloads the page itself when a new worker activates, which can land
 * mid-answer and — because a session lives in its URL — drops the learner back at
 * its start. `main.tsx` passes `onNeedReload` to suppress that, so these tests
 * guard that nothing reloads until the learner asks for it.
 */

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UpdateBanner } from '../../src/components/UpdateBanner';
import { HomeScreen } from '../../src/features/home/HomeScreen';
import {
  isUpdateReady,
  markUpdateReady,
  resetUpdateState,
  subscribeToUpdates,
} from '../../src/app/updates';
import { renderWithServices } from '../fixtures/services';

/** The worker reporting a new build, from outside React. */
const announceUpdate = () => act(() => markUpdateReady());

afterEach(() => {
  resetUpdateState();
});

describe('the update store', () => {
  it('starts quiet, so a first visit is not told it is out of date', () => {
    expect(isUpdateReady()).toBe(false);
  });

  it('notifies subscribers once, however many times the worker reports', () => {
    const listener = vi.fn();
    subscribeToUpdates(listener);

    markUpdateReady();
    markUpdateReady();

    expect(isUpdateReady()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('stops notifying after unsubscribe', () => {
    const listener = vi.fn();
    subscribeToUpdates(listener)();

    markUpdateReady();

    expect(listener).not.toHaveBeenCalled();
  });
});

describe('the update banner', () => {
  it('shows nothing until there is an update', () => {
    render(<UpdateBanner />);

    expect(screen.queryByText('A new version is ready.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reload' })).not.toBeInTheDocument();
  });

  it('announces the update without stealing focus', () => {
    const active = document.activeElement;
    render(<UpdateBanner />);
    announceUpdate();

    // `role="status"` is announced politely; a dialog would interrupt.
    expect(screen.getByRole('status')).toHaveTextContent('A new version is ready.');
    expect(document.activeElement).toBe(active);
  });

  it('reloads only when asked', async () => {
    const user = userEvent.setup();
    const onReload = vi.fn();
    render(<UpdateBanner onReload={onReload} />);
    announceUpdate();

    expect(onReload).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Reload' }));
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it('can be dismissed, and does not reload when it is', async () => {
    const user = userEvent.setup();
    const onReload = vi.fn();
    render(<UpdateBanner onReload={onReload} />);
    announceUpdate();

    await user.click(screen.getByRole('button', { name: 'Later' }));

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(onReload).not.toHaveBeenCalled();
  });
});

describe('the shell', () => {
  it('surfaces the update on a normal screen', async () => {
    renderWithServices(<HomeScreen />);
    await screen.findByRole('heading', { level: 1 });

    expect(screen.queryByRole('button', { name: 'Reload' })).not.toBeInTheDocument();

    announceUpdate();

    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
  });
});
