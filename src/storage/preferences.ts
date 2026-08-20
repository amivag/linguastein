import {
  DEFAULT_PRONUNCIATION_LOCALE,
  DEFAULT_REFERENCE_LANGUAGE,
  DEFAULT_TARGET_LANGUAGE,
  LEVEL_SCOPE_ALL,
} from '../domain/content';
import { DEFAULT_SESSION_FOCUS } from '../domain/sessions';
import type { Preferences } from './types';

export const DEFAULT_PREFERENCES: Preferences = {
  targetLanguage: DEFAULT_TARGET_LANGUAGE,
  // The widest scope, not the lowest level: narrowing is something a learner
  // opts into, and a default of `a1` would hide half the pack from a first
  // session without ever having said so.
  level: LEVEL_SCOPE_ALL,
  referenceLanguage: DEFAULT_REFERENCE_LANGUAGE,
  focusTopics: [],
  focus: DEFAULT_SESSION_FOCUS,
  pronunciationLocale: DEFAULT_PRONUNCIATION_LOCALE,
  voiceName: '',
  autoPlayAudio: true,
  showTimer: true,
  slowAudio: false,
  showRomanisationHints: false,
  theme: 'system',
};

export function mergePreferences(current: Preferences, patch: Partial<Preferences>): Preferences {
  const defined = Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  ) as Partial<Preferences>;
  return { ...current, ...defined };
}
