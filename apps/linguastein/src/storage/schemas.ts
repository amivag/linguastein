/**
 * A validation boundary for learner state, which had none.
 *
 * Content gets one — `src/data/validation` refuses a malformed record before it
 * reaches the repository — and the settings a learner's own device hands back got
 * `mergePreferences(DEFAULT_PREFERENCES, stored)`, which trusts whatever is in
 * `meta`. A retired theme id or a value written by a newer build passed straight
 * through into `data-theme`, and a `level` of `null` reached `resolveCourse`.
 *
 * Stage C is what makes the asymmetry load-bearing rather than untidy
 * (`docs/tasks/learner-profile.md` §5.5): an exported file is something a person
 * can edit, so it is untrusted input by definition. The schemas go in here, now,
 * while there is one small record to check and no importer yet.
 *
 * **The rule is repair, never reject.** An unknown key is dropped, a bad value is
 * replaced by its default, and the result is a usable record with a `console.warn`
 * beside it. Practice must never fail because a preference is malformed — the same
 * rule `createStorage()` already follows when IndexedDB is refused, and the reason
 * is the same: a learner who cannot open the app cannot fix the setting that
 * stopped them.
 */

import { z } from 'zod';
import { LEVEL_SCOPE_ALL, SPEAKER_GENDERS } from '../domain/content';
import { SESSION_FOCUSES } from '../domain/sessions';
import { CONTRAST_LEVELS } from '../styles/contrast';
import { INTENSITIES } from '../styles/intensity';
import { PALETTES } from '../styles/themes';
import { DEFAULT_COURSE_STATE, DEFAULT_PREFERENCES } from './preferences';
import type { CourseState, CourseStates, Preferences } from './types';

/**
 * A BCP 47-ish tag, checked for shape rather than against a list.
 *
 * Deliberately not an enum. A pack names its own accents and a reference
 * language arrives as its own unit, so the set of legal tags is a property of
 * what is installed rather than of this file — the same reason `slugs()` does not
 * police topics. What is worth refusing is a string that cannot be a tag at all,
 * because that is the one that reaches a speech engine.
 */
const languageTag = z.string().regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/);

/** A level id, or the sentinel for "no ceiling". The ladder is the pack's. */
const levelScope = z.union([z.literal(LEVEL_SCOPE_ALL), z.string().min(1)]);

const preferencesShape = {
  displayName: z.string(),
  // Empty is a real answer — 'not said' — so it is a legal value, not a gap.
  speakerGender: z.union([z.enum(SPEAKER_GENDERS), z.literal('')]),
  targetLanguage: languageTag,
  referenceLanguage: languageTag,
  autoPlayAudio: z.boolean(),
  showTimer: z.boolean(),
  slowAudio: z.boolean(),
  theme: z.enum(['light', 'dark', 'system']),
  palette: z.enum(PALETTES),
  contrast: z.enum(CONTRAST_LEVELS),
  intensity: z.enum(INTENSITIES),
  readingSize: z.enum(['small', 'medium', 'large']),
} satisfies Record<string, z.ZodType>;

const courseStateShape = {
  level: levelScope,
  /*
   * A topic slug is pack vocabulary, so the shape is all that can be checked
   * here. Whether a slug names anything is a question for the course, and
   * `reachableTopics` is where it is asked — at the writer, per §4.3, rather than
   * at the parser.
   */
  focusTopics: z.array(z.string().min(1)),
  focus: z.enum(SESSION_FOCUSES),
  pronunciationLocale: languageTag,
  voiceName: z.string(),
} satisfies Record<string, z.ZodType>;

/**
 * Every field checked on its own, so one bad value costs one field.
 *
 * Parsing the whole record and falling back to the defaults on failure would be
 * shorter and much worse: a learner whose stored palette named a theme that has
 * since been retired would lose their reading size, their voice and their
 * display name along with it. Repair is per key, which also makes the warning
 * specific enough to act on.
 */
function repair<T extends object>(
  shape: Readonly<Record<string, z.ZodType>>,
  defaults: T,
  stored: unknown,
  label: string,
): T {
  if (stored === null || typeof stored !== 'object') return defaults;

  const record = stored as Record<string, unknown>;
  const repaired: Record<string, unknown> = { ...(defaults as Record<string, unknown>) };
  const dropped: string[] = [];

  for (const [key, value] of Object.entries(record)) {
    const field = shape[key];
    // An unknown key is dropped in silence: it is what a field removed by a
    // later build looks like from an older one, and `showRomanisationHints` is
    // the proof that happens. Reporting it would train a reader to ignore this.
    if (!field) continue;

    const parsed = field.safeParse(value);
    if (parsed.success) repaired[key] = parsed.data;
    else dropped.push(key);
  }

  if (dropped.length > 0) {
    console.warn(
      `${label}: ignored ${dropped.join(', ')} — value(s) this build cannot read, ` +
        'replaced by the default',
    );
  }
  return repaired as T;
}

export function readPreferences(stored: unknown): Preferences {
  return repair(preferencesShape, DEFAULT_PREFERENCES, stored, 'stored preferences');
}

export function readCourseState(stored: unknown, label: string): CourseState {
  return repair(courseStateShape, DEFAULT_COURSE_STATE, stored, label);
}

/**
 * The whole `meta:courses` record, one course at a time.
 *
 * A key that is not a language tag is dropped rather than repaired, because
 * there is no default for "which course this was" — unlike a field, a bad key
 * names nothing to fall back to.
 */
export function readCourseStates(stored: unknown): CourseStates {
  if (stored === null || typeof stored !== 'object') return {};

  const states: Record<string, CourseState> = {};
  for (const [language, value] of Object.entries(stored as Record<string, unknown>)) {
    if (!languageTag.safeParse(language).success) {
      console.warn(`stored courses: ignored "${language}" — not a language tag`);
      continue;
    }
    states[language] = readCourseState(value, `stored course ${language}`);
  }
  return states;
}
