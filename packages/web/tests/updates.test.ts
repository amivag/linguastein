/** The update store: ready can be dismissed, required cannot be undone. */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isUpdateReady,
  markReloadRequired,
  markUpdateReady,
  resetUpdateState,
  subscribeToUpdates,
  updateState,
} from '../src/index.ts';

afterEach(() => {
  resetUpdateState();
});

describe('the update store', () => {
  it('starts quiet, so a first visit is not told it is out of date', () => {
    expect(isUpdateReady()).toBe(false);
    expect(updateState()).toBe('none');
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

  it('is not downgraded from required by a later update notice', () => {
    markReloadRequired();
    markUpdateReady();

    expect(updateState()).toBe('required');
  });
});
