/**
 * A short buzz under the thumb, where the device has a motor to make one.
 *
 * `navigator.vibrate` is the whole of it, behind a capability check: Android
 * browsers have it, iOS Safari does not, and there this is a no-op rather than an
 * error. Desktop Chromium defines `vibrate` with no motor behind it, so the check
 * also asks for a touch screen — the nearest thing the web exposes to "this is a
 * device held in a hand". An app asks {@link Haptics.isAvailable} before
 * offering the setting at all, so nobody is shown a switch that does nothing.
 *
 * Patterns are named for what they mean rather than spelled as durations at each
 * call site, so the vocabulary stays small and consistent across apps.
 */

/** The part of `Navigator` this module touches; injectable for tests. */
export interface VibratingNavigator {
  vibrate?(pattern: number | readonly number[]): boolean;
  readonly maxTouchPoints?: number;
}

/** What a pulse is saying. Kept deliberately short: a buzz is not a message. */
export type HapticPattern = 'confirm' | 'miss';

/*
 * Milliseconds. `confirm` is one light tap; `miss` is two softer ones, so the
 * two are told apart by rhythm rather than by strength, which many motors
 * cannot vary.
 */
const PATTERNS: Readonly<Record<HapticPattern, readonly number[]>> = {
  confirm: [12],
  miss: [8, 60, 8],
};

export interface Haptics {
  isAvailable(): boolean;
  /** Fires the pattern, or does nothing where the device cannot. Never throws. */
  pulse(pattern: HapticPattern): void;
}

export function createHaptics(
  target: VibratingNavigator | undefined = globalThis.navigator,
): Haptics {
  const available = typeof target?.vibrate === 'function' && (target.maxTouchPoints ?? 0) > 0;
  return {
    isAvailable: () => available,
    pulse(pattern) {
      if (!available) return;
      try {
        // Spread: `vibrate` is typed over a mutable array.
        target.vibrate?.([...PATTERNS[pattern]]);
      } catch {
        // A browser may refuse outside a user gesture; a missing buzz is no fault.
      }
    },
  };
}

/** For apps and tests that need the shape with nothing behind it. */
export const NO_HAPTICS: Haptics = { isAvailable: () => false, pulse: () => {} };
