import {
  type CefrLevel,
  DEFAULT_PRONUNCIATION_LOCALE,
  DEFAULT_REFERENCE_LANGUAGE,
  DEFAULT_TARGET_LANGUAGE,
} from '../domain/content';
import { DEFAULT_SESSION_FOCUS } from '../domain/sessions';
import { DEFAULT_CONTRAST } from '../styles/contrast';
import { DEFAULT_PALETTE } from '../styles/themes';
import type { Preferences } from './types';

export const DEFAULT_PREFERENCES: Preferences = {
  targetLanguage: DEFAULT_TARGET_LANGUAGE,
  // A new learner needs a coherent starting point, not every loaded item at
  // once. `resolveCourse` widens safely when a future language has no A1 pack.
  level: 'a1' satisfies CefrLevel,
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
  palette: DEFAULT_PALETTE,
  contrast: DEFAULT_CONTRAST,
  readingSize: 'small',
};

export function mergePreferences(current: Preferences, patch: Partial<Preferences>): Preferences {
  const defined = Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  ) as Partial<Preferences>;
  return { ...current, ...defined };
}
