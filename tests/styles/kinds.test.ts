/**
 * The categorical hue assignment.
 *
 * Three of these are contracts the interface depends on rather than facts about
 * FNV-1a: a hue has to be in range, it has to be the same on every device, and
 * it has to *spread* — the whole value of colouring thirty-five categories is
 * lost if a third of them come out the same. The fourth guards the thing a future
 * refactor is most likely to break by accident, which is that the hue follows the
 * id and not the position.
 */

import { describe, expect, it } from 'vitest';
import { kindHue, KIND_HUE_COUNT } from '../../src/styles/kinds';

/** Ids shaped like the real ones: a namespace, a facet and a short slug. */
const TOPICS = [
  'food',
  'body',
  'travel',
  'numbers',
  'colours',
  'family',
  'weather',
  'clothes',
  'house',
  'work',
  'sport',
  'animals',
].map((slug) => `core-es:topic:${slug}`);

describe('kindHue', () => {
  it('only ever names a hue the palettes declare', () => {
    for (const id of TOPICS) {
      const hue = kindHue(id);
      expect(hue).toBeGreaterThanOrEqual(1);
      expect(hue).toBeLessThanOrEqual(KIND_HUE_COUNT);
      expect(Number.isInteger(hue)).toBe(true);
    }
  });

  it('gives the same id the same hue every time', () => {
    // The property a learner actually relies on: Body is the same colour today,
    // tomorrow, and on their other device. A `Math.random()` slipped in here
    // would pass every other test in this file.
    expect(kindHue('core-es:topic:body')).toBe(kindHue('core-es:topic:body'));
    expect(TOPICS.map(kindHue)).toEqual(TOPICS.map(kindHue));
  });

  it('separates ids that differ only in their last characters', () => {
    // The reason this is a hash and not a sum of char codes: these three would
    // collide under any additive scheme, and they are exactly the shape the real
    // topic ids have.
    const hues = ['core-es:topic:food', 'core-es:topic:foot', 'core-es:topic:fool'].map(kindHue);
    expect(new Set(hues).size).toBeGreaterThan(1);
  });

  it('spreads a realistic set of categories across the whole range', () => {
    // Not "perfectly even" — a hash over twelve items will not be, and asserting
    // that would be asserting the implementation. What matters is that no hue is
    // carrying half the list and that most of the palette gets used.
    const used = new Map<number, number>();
    for (const id of TOPICS) used.set(kindHue(id), (used.get(kindHue(id)) ?? 0) + 1);

    expect(used.size).toBeGreaterThanOrEqual(KIND_HUE_COUNT - 1);
    expect(Math.max(...used.values())).toBeLessThanOrEqual(4);
  });

  it('does not depend on where the id sits in a list', () => {
    // The bug this rules out is the tempting refactor: colouring by index. It
    // reads identically on screen until the pack grows a row, at which point
    // every category below it changes colour.
    const forwards = TOPICS.map(kindHue);
    const backwards = [...TOPICS].reverse().map(kindHue).reverse();
    expect(backwards).toEqual(forwards);
  });

  it('handles an empty id rather than throwing', () => {
    // Nothing should pass one, but a missing translation or a malformed pack
    // should degrade to a colour rather than to a blank screen.
    expect(kindHue('')).toBeGreaterThanOrEqual(1);
    expect(kindHue('')).toBeLessThanOrEqual(KIND_HUE_COUNT);
  });
});
