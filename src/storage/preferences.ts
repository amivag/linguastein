import {
  type Level,
  DEFAULT_PRONUNCIATION_LOCALE,
  DEFAULT_REFERENCE_LANGUAGE,
  DEFAULT_TARGET_LANGUAGE,
} from '../domain/content';
import { DEFAULT_SESSION_FOCUS } from '../domain/sessions';
import { DEFAULT_CONTRAST } from '../styles/contrast';
import { DEFAULT_INTENSITY } from '../styles/intensity';
import { DEFAULT_PALETTE } from '../styles/themes';
import type { Preferences } from './types';

export const DEFAULT_PREFERENCES: Preferences = {
  // Both empty, and both meaning "not said" rather than "not set yet". A
  // learner is never asked for either, and everything works without them.
  displayName: '',
  speakerGender: '',
  targetLanguage: DEFAULT_TARGET_LANGUAGE,
  // A new learner needs a coherent starting point, not every loaded item at
  // once. `resolveCourse` widens safely when a future language has no A1 pack.
  level: 'a1' satisfies Level,
  referenceLanguage: DEFAULT_REFERENCE_LANGUAGE,
  focusTopics: [],
  focus: DEFAULT_SESSION_FOCUS,
  pronunciationLocale: DEFAULT_PRONUNCIATION_LOCALE,
  voiceName: '',
  autoPlayAudio: true,
  showTimer: true,
  slowAudio: false,
  theme: 'system',
  palette: DEFAULT_PALETTE,
  contrast: DEFAULT_CONTRAST,
  intensity: DEFAULT_INTENSITY,
  readingSize: 'small',
};

export function mergePreferences(current: Preferences, patch: Partial<Preferences>): Preferences {
  const defined = Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  ) as Partial<Preferences>;
  return { ...current, ...defined };
}
