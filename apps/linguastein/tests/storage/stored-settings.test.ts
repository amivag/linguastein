/**
 * What comes back out of `meta` is untrusted input.
 *
 * It was not treated as any: `mergePreferences(DEFAULT_PREFERENCES, stored)`
 * passed whatever was there straight through, so a palette id retired by a later
 * build reached `data-theme` and a `level` of `null` reached `resolveCourse`.
 * Nothing had written such a record yet, which is exactly why this was cheap to
 * add now — Stage C turns this record into a file a person can edit
 * (`docs/tasks/learner-profile.md` §5.5), and an importer with no boundary
 * behind it is a boundary in the wrong place.
 *
 * **The rule under test is repair, never reject.** Every case below asserts that
 * something usable came back, because a learner who cannot open the app cannot
 * fix the setting that stopped them.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_COURSE_STATE,
  DEFAULT_PREFERENCES,
  readCourseStates,
  readPreferences,
} from '../../src/storage';

afterEach(() => vi.restoreAllMocks());

/** Silences the warning and hands back what was warned about. */
function warnings(): string[] {
  const said: string[] = [];
  vi.spyOn(console, 'warn').mockImplementation((message: unknown) => {
    said.push(String(message));
  });
  return said;
}

describe('reading the stored preferences', () => {
  it('keeps what it can read', () => {
    const stored = readPreferences({ displayName: 'Ada', readingSize: 'large' });

    expect(stored.displayName).toBe('Ada');
    expect(stored.readingSize).toBe('large');
    // Everything unmentioned is the default rather than absent.
    expect(stored.theme).toBe(DEFAULT_PREFERENCES.theme);
  });

  it('replaces a value this build cannot read, and says which', () => {
    const said = warnings();
    const stored = readPreferences({ palette: 'ultraviolet', displayName: 'Ada' });

    expect(stored.palette).toBe(DEFAULT_PREFERENCES.palette);
    expect(said.join(' ')).toContain('palette');
  });

  /**
   * The reason repair is per field rather than per record.
   *
   * Parsing the whole thing and falling back to the defaults on failure would be
   * shorter, and would mean a learner whose stored palette named a retired theme
   * lost their name, their reading size and their reference language with it.
   */
  it('costs one field, not the record', () => {
    warnings();
    const stored = readPreferences({
      palette: 'ultraviolet',
      displayName: 'Ada',
      readingSize: 'large',
      referenceLanguage: 'de',
    });

    expect(stored.palette).toBe(DEFAULT_PREFERENCES.palette);
    expect(stored.displayName).toBe('Ada');
    expect(stored.readingSize).toBe('large');
    expect(stored.referenceLanguage).toBe('de');
  });

  /**
   * A key this build does not know is dropped in silence, and the silence is
   * deliberate: it is what a field removed by a later build looks like from an
   * older one, and `showRomanisationHints` is the proof that happens. Warning
   * about it would train a reader to ignore this channel.
   */
  it('drops a key it does not know, without complaining', () => {
    const said = warnings();
    const stored = readPreferences({ showRomanisationHints: true, displayName: 'Ada' });

    expect(stored).not.toHaveProperty('showRomanisationHints');
    expect(stored.displayName).toBe('Ada');
    expect(said).toEqual([]);
  });

  it('answers with the defaults for a record that is not one', () => {
    expect(readPreferences(null)).toEqual(DEFAULT_PREFERENCES);
    expect(readPreferences('nonsense')).toEqual(DEFAULT_PREFERENCES);
    expect(readPreferences(undefined)).toEqual(DEFAULT_PREFERENCES);
  });
});

describe('reading the stored courses', () => {
  it('repairs each course on its own', () => {
    warnings();
    const stored = readCourseStates({
      es: { level: 'a2', voiceName: 'Paulina' },
      fr: { level: 42, voiceName: 'Amelie' },
    });

    expect(stored['es']?.level).toBe('a2');
    // French's level was unreadable; French's voice was not, and Spanish is
    // untouched either way.
    expect(stored['fr']?.level).toBe(DEFAULT_COURSE_STATE.level);
    expect(stored['fr']?.voiceName).toBe('Amelie');
    expect(stored['es']?.voiceName).toBe('Paulina');
  });

  /**
   * A key that is not a language tag is dropped rather than repaired.
   *
   * Unlike a field, a bad key names nothing to fall back to: there is no default
   * for "which course this was", so keeping the values under a repaired name
   * would be inventing a course the learner never opened.
   */
  it('drops a course whose key is not a language', () => {
    const said = warnings();
    const stored = readCourseStates({ es: { level: 'a2' }, 'not a language': { level: 'b1' } });

    expect(Object.keys(stored)).toEqual(['es']);
    expect(said.join(' ')).toContain('not a language');
  });

  it('reads an empty record as no courses rather than as a failure', () => {
    expect(readCourseStates({})).toEqual({});
    expect(readCourseStates(undefined)).toEqual({});
  });
});
