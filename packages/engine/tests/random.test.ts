/** Seeded randomness: the property every reproducible session rests on. */
import { describe, expect, it } from 'vitest';
import { pick, randomInt, sample, seededRng, shuffle, systemRng, token } from '../src';

describe('seededRng', () => {
  it('repeats exactly for the same seed, and differs for another', () => {
    const run = (seed: number) => Array.from({ length: 5 }, seededRng(seed).next);

    expect(run(7)).toEqual(run(7));
    expect(run(7)).not.toEqual(run(8));
  });

  it('stays in [0, 1)', () => {
    const rng = seededRng(1);
    for (let i = 0; i < 1000; i += 1) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('has an unseeded counterpart with the same contract', () => {
    const value = systemRng.next();
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1);
  });
});

describe('the helpers built on it', () => {
  it('draws integers below the bound', () => {
    const rng = seededRng(3);
    for (let i = 0; i < 200; i += 1) expect(randomInt(rng, 4)).toBeLessThan(4);
  });

  it('makes tokens of the asked length from a fixed alphabet, reproducibly', () => {
    expect(token(seededRng(5))).toMatch(/^[0-9a-z]{6}$/);
    expect(token(seededRng(5), 10)).toHaveLength(10);
    expect(token(seededRng(5))).toBe(token(seededRng(5)));
  });

  it('shuffles into a permutation without touching the input', () => {
    const input = [1, 2, 3, 4, 5, 6];
    const shuffled = shuffle(input, seededRng(9));

    expect(input).toEqual([1, 2, 3, 4, 5, 6]);
    expect([...shuffled].sort()).toEqual(input);
    expect(shuffle(input, seededRng(9))).toEqual(shuffled);
  });

  it('samples without repeats, capped at what there is', () => {
    const drawn = sample(['a', 'b', 'c', 'd'], 3, seededRng(2));

    expect(new Set(drawn).size).toBe(3);
    expect(sample(['a', 'b'], 5, seededRng(2))).toHaveLength(2);
  });

  it('picks one value, or nothing from nothing', () => {
    expect(['x', 'y', 'z']).toContain(pick(['x', 'y', 'z'], seededRng(4)));
    expect(pick([], seededRng(4))).toBeUndefined();
  });
});
