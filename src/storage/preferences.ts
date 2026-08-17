import {
  DEFAULT_PRONUNCIATION_LOCALE,
  DEFAULT_REFERENCE_LANGUAGE,
  DEFAULT_TARGET_LANGUAGE,
} from '../domain/content';
import type { Preferences } from './types';

export const DEFAULT_PREFERENCES: Preferences = {
  targetLanguage: DEFAULT_TARGET_LANGUAGE,
  referenceLanguage: DEFAULT_REFERENCE_LANGUAGE,
  pronunciationLocale: DEFAULT_PRONUNCIATION_LOCALE,
  voiceName: '',
  autoPlayAudio: true,
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
