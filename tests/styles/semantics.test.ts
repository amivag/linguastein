/**
 * The grammatical hue assignments.
 *
 * These are hand-chosen rather than derived, so unlike `kinds.test.ts` there is
 * no distribution to check — every assertion here is one of the *reasons* the
 * assignment is what it is, written so that a future edit which happens to break
 * one has to argue with it rather than merely pass. The two that matter most are
 * that gender and part of speech never collide (a noun wears both at once) and
 * that the preterite and the imperfect stay far apart (the confusion this colour
 * exists to help with).
 */

import { describe, expect, it } from 'vitest';
import { MOODS, POS_TAGS, STUDYABLE_POS, TENSES } from '../../src/domain/content';
import { KIND_HUE_COUNT } from '../../src/styles/kinds';
import { genderHue, genderLabel, posHue, tenseHue } from '../../src/styles/semantics';

const GENDERS = ['masculine', 'feminine', 'neuter'] as const;

/** Steps around a twelve-hue wheel, the short way. */
function wheelDistance(a: number, b: number): number {
  const direct = Math.abs(a - b);
  return Math.min(direct, KIND_HUE_COUNT - direct);
}

describe('every assignment names a hue the palettes declare', () => {
  it.each([
    ['gender', GENDERS.map((gender) => genderHue(gender))],
    ['part of speech', POS_TAGS.map((pos) => posHue(pos))],
    ['tense', TENSES.map((tense) => tenseHue(tense))],
    ['mood', MOODS.map((mood) => tenseHue('present', mood))],
  ])('%s', (_label, hues) => {
    for (const hue of hues) {
      if (hue === undefined) continue;
      expect(hue).toBeGreaterThanOrEqual(1);
      expect(hue).toBeLessThanOrEqual(KIND_HUE_COUNT);
      expect(Number.isInteger(hue)).toBe(true);
    }
  });
});

describe('genderHue', () => {
  it('gives all three genders a hue of their own', () => {
    const hues = GENDERS.map((gender) => genderHue(gender));
    expect(new Set(hues).size).toBe(GENDERS.length);
  });

  it('keeps masculine and feminine far apart on the wheel', () => {
    /*
     * The pair carrying the most weight in the app: it is on every noun, and a
     * learner is meant to read it at a glance without checking the article. Two
     * neighbouring hues would technically pass the contrast test — each clears
     * the card it sits on — and still fail at the only job they have, which is
     * being told apart from each other.
     */
    const masculine = genderHue('masculine')!;
    const feminine = genderHue('feminine')!;
    expect(wheelDistance(masculine, feminine)).toBeGreaterThanOrEqual(4);
  });

  it('has no colour for a word without gender', () => {
    // A verb is not neuter. Absence has to stay distinguishable from the neuter
    // that Spanish really does have, which is why this is `undefined` and not a
    // fourth hue.
    expect(genderHue(undefined)).toBeUndefined();
  });

  it('names an article for every gender it colours', () => {
    // The colour-is-never-the-only-signal rule, as a test: a gender that had a
    // hue and no label would be a colour-only signal on a word card.
    for (const gender of GENDERS) {
      expect(genderHue(gender)).toBeDefined();
      expect(genderLabel(gender)).toBeTruthy();
    }
    expect(genderLabel(undefined)).toBeUndefined();
  });
});

describe('posHue', () => {
  it('colours exactly the classes a learner studies as a set', () => {
    for (const pos of STUDYABLE_POS) expect(posHue(pos)).toBeDefined();

    const closed = POS_TAGS.filter((pos) => !(STUDYABLE_POS as readonly string[]).includes(pos));
    for (const pos of closed) expect(posHue(pos)).toBeUndefined();
  });

  it('gives each open class a hue of its own', () => {
    const hues = STUDYABLE_POS.map((pos) => posHue(pos));
    expect(new Set(hues).size).toBe(STUDYABLE_POS.length);
  });

  it('shares no hue with gender', () => {
    /*
     * The one collision that would actually mislead, and the reason both maps are
     * hand-written. A noun carries a part of speech *and* a gender at the same
     * time, so the same hue appearing twice on one card for two unrelated reasons
     * is worse than no colour at all.
     */
    const genders = new Set(GENDERS.map((gender) => genderHue(gender)));
    for (const pos of STUDYABLE_POS) {
      expect(genders.has(posHue(pos))).toBe(false);
    }
  });

  it('puts nouns and verbs at opposite ends', () => {
    // The two classes that co-occur most and do most of the work in a sentence.
    expect(wheelDistance(posHue('NOUN')!, posHue('VERB')!)).toBeGreaterThanOrEqual(4);
  });
});

describe('tenseHue', () => {
  it('keeps the preterite and the imperfect on opposite sides of the wheel', () => {
    /*
     * The assignment this whole system is most useful for. Both are "the past" in
     * English, learners confuse them for years, and adjacent hues would be
     * teaching the confusion rather than the distinction.
     */
    const preterite = tenseHue('preterite')!;
    const imperfect = tenseHue('imperfect')!;
    expect(wheelDistance(preterite, imperfect)).toBeGreaterThanOrEqual(4);
  });

  it('gives every tense a hue', () => {
    for (const tense of TENSES) expect(tenseHue(tense)).toBeDefined();
  });

  it('lets a marked mood override the tense', () => {
    // A learner calls this form "the subjunctive", not "the present", so the
    // colour has to agree with the name.
    expect(tenseHue('present', 'subjunctive')).toBe(tenseHue('imperfect', 'subjunctive'));
    expect(tenseHue('present', 'subjunctive')).not.toBe(tenseHue('present'));
  });

  it('leaves the indicative unmarked', () => {
    // The default mood carries no colour, which is what makes the marked ones
    // legible as marked.
    expect(tenseHue('present', 'indicative')).toBe(tenseHue('present'));
    expect(tenseHue(undefined, 'indicative')).toBeUndefined();
    expect(tenseHue(undefined)).toBeUndefined();
  });

  it('agrees with itself about the conditional', () => {
    // It is a mood and a tense in this model. A conjugation table asks one way
    // and a grammar skill the other; they must not come out different colours.
    expect(tenseHue('conditional')).toBe(tenseHue(undefined, 'conditional'));
  });
});
