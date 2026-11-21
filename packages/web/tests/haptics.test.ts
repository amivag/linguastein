/**
 * Haptics: a buzz where there is a motor, silence where there is not, and never
 * an error either way.
 */

import { describe, expect, it, vi } from 'vitest';
import { createHaptics, NO_HAPTICS, type VibratingNavigator } from '../src/index.ts';

describe('createHaptics', () => {
  it('vibrates with a distinct pattern per meaning', () => {
    const vibrate = vi.fn(() => true);
    const haptics = createHaptics({ vibrate, maxTouchPoints: 5 });

    expect(haptics.isAvailable()).toBe(true);
    haptics.pulse('confirm');
    haptics.pulse('miss');

    expect(vibrate).toHaveBeenCalledTimes(2);
    const [confirm, miss] = vibrate.mock.calls.map((call) => (call as unknown[])[0]);
    expect(confirm).not.toEqual(miss);
  });

  it('is unavailable and silent where the device has no vibrate', () => {
    const haptics = createHaptics({});
    expect(haptics.isAvailable()).toBe(false);
    expect(() => haptics.pulse('confirm')).not.toThrow();
  });

  it('is unavailable on a desktop that defines vibrate with no motor behind it', () => {
    const vibrate = vi.fn(() => true);
    const haptics = createHaptics({ vibrate, maxTouchPoints: 0 });
    expect(haptics.isAvailable()).toBe(false);
    haptics.pulse('confirm');
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('is unavailable without a navigator at all', () => {
    expect(createHaptics(undefined).isAvailable()).toBe(false);
  });

  it('swallows a browser that refuses', () => {
    const target: VibratingNavigator = {
      maxTouchPoints: 1,
      vibrate: () => {
        throw new Error('not allowed');
      },
    };
    expect(() => createHaptics(target).pulse('miss')).not.toThrow();
  });

  it('offers a null implementation', () => {
    expect(NO_HAPTICS.isAvailable()).toBe(false);
    expect(() => NO_HAPTICS.pulse('confirm')).not.toThrow();
  });
});
