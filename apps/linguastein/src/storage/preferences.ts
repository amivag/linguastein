import {
  type LanguageTag,
  type Level,
  DEFAULT_PRONUNCIATION_LOCALE,
  DEFAULT_REFERENCE_LANGUAGE,
  DEFAULT_TARGET_LANGUAGE,
} from '../domain/content';
import { DEFAULT_SESSION_FOCUS } from '../domain/sessions';
import { DEFAULT_CONTRAST } from '../styles/contrast';
import { DEFAULT_INTENSITY } from '../styles/intensity';
import { DEFAULT_PALETTE } from '../styles/themes';
import type { CourseState, CourseStates, Preferences } from './types';

export const DEFAULT_PREFERENCES: Preferences = {
  // Both empty, and both meaning "not said" rather than "not set yet". A
  // learner is never asked for either, and everything works without them.
  displayName: '',
  speakerGender: '',
  targetLanguage: DEFAULT_TARGET_LANGUAGE,
  referenceLanguage: DEFAULT_REFERENCE_LANGUAGE,
  autoPlayAudio: true,
  showTimer: true,
  slowAudio: false,
  theme: 'system',
  palette: DEFAULT_PALETTE,
  contrast: DEFAULT_CONTRAST,
  intensity: DEFAULT_INTENSITY,
  readingSize: 'small',
};

/**
 * What a course reads as before the learner has chosen anything in it.
 *
 * Not stored on first sight: a course with no record reads as this, and a record
 * appears the first time something in it is chosen. That is what keeps a fresh
 * install's `meta:courses` empty rather than pre-populated with a row per
 * language the packs happen to offer.
 */
export const DEFAULT_COURSE_STATE: CourseState = {
  // A new learner needs a coherent starting point, not every loaded item at
  // once. `resolveCourse` widens safely when a future language has no A1 pack.
  level: 'a1' satisfies Level,
  focusTopics: [],
  focus: DEFAULT_SESSION_FOCUS,
  /*
   * Spanish's accent as the default for *any* language, which looks wrong and is
   * the honest starting point: it is what a course reads as before anything has
   * narrowed it, and `usePronunciationLocale` narrows every read against the open
   * course. A German course therefore never sees this value — it resolves to
   * German's own accents through the packs — while a Spanish one starts where it
   * always did.
   */
  pronunciationLocale: DEFAULT_PRONUNCIATION_LOCALE,
  voiceName: '',
};

export function mergePreferences(current: Preferences, patch: Partial<Preferences>): Preferences {
  return { ...current, ...defined(patch) };
}

export function mergeCourseState(current: CourseState, patch: Partial<CourseState>): CourseState {
  return { ...current, ...defined(patch) };
}

/** The course's stored choices, or the defaults where it has none yet. */
export function courseStateOf(states: CourseStates, language: LanguageTag): CourseState {
  return states[language] ?? DEFAULT_COURSE_STATE;
}

/**
 * A patch with its `undefined` entries dropped.
 *
 * `{ ...current, ...patch }` would let an explicit `undefined` erase a value that
 * has a default, which is the difference between "leave this alone" and "unset
 * it" — and every caller here means the first.
 */
function defined<T extends object>(patch: Partial<T>): Partial<T> {
  return Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}
