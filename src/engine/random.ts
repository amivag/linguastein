/**
 * Randomness is injected, never imported ambiently, so session planning and
 * exercise generation stay deterministic under test.
 */

export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
}

export const systemRng: Rng = { next: () => Math.random() };

/** Small, fast, seedable PRNG (mulberry32). Same seed → same session. */
export function seededRng(seed: number): Rng {
  let state = seed >>> 0;
  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

export function randomInt(rng: Rng, maxExclusive: number): number {
  return Math.floor(rng.next() * maxExclusive);
}

const TOKEN_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

/**
 * A short opaque id fragment, e.g. `k3f9a1`.
 *
 * For the part of a record id that has to be *unique* rather than meaningful.
 * A clock is not enough on its own — two attempts on one item inside the same
 * millisecond produced the same id and the second silently replaced the first —
 * and a counter is unique only within one device, which is no use to anything
 * that later merges two of them.
 *
 * Takes an `Rng` like everything else here, so a seeded session still produces
 * the same ids twice and a test can assert on them.
 */
export function token(rng: Rng, length = 6): string {
  let out = '';
  for (let i = 0; i < length; i++)
    out += TOKEN_ALPHABET.charAt(randomInt(rng, TOKEN_ALPHABET.length));
  return out;
}

/** Fisher–Yates; returns a new array and never mutates the input. */
export function shuffle<T>(values: readonly T[], rng: Rng): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(rng, i + 1);
    [result[i], result[j]] = [result[j] as T, result[i] as T];
  }
  return result;
}

export function sample<T>(values: readonly T[], count: number, rng: Rng): T[] {
  return shuffle(values, rng).slice(0, count);
}

export function pick<T>(values: readonly T[], rng: Rng): T | undefined {
  return values.length === 0 ? undefined : values[randomInt(rng, values.length)];
}
