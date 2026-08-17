/**
 * Device speech synthesis: the free, offline-capable fallback used when a
 * dataset has no reviewed audio yet (spec §6, §25).
 *
 * Two things matter here for pronunciation quality:
 *
 * 1. `speechSynthesis.getVoices()` is empty until the browser has loaded its
 *    voice list, and it loads asynchronously. Speaking before then leaves the
 *    utterance on the browser default — which is why Spanish came out with an
 *    English accent. We wait for the list before speaking.
 * 2. We never speak target-language text with a voice from another language.
 *    Silence plus an honest "no Spanish voice installed" is better teaching
 *    than confidently wrong pronunciation.
 */

import { baseLanguage, type LanguageTag } from '../domain/content';
import {
  NOOP_PLAYBACK,
  type PlaybackHandle,
  type SpeechRequest,
  type TtsProvider,
  type TtsVoice,
} from './types';

/** How long to wait for the browser to populate its voice list. */
const VOICE_LOAD_TIMEOUT_MS = 2000;

export function createWebSpeechTtsProvider(): TtsProvider {
  let cached: SpeechSynthesisVoice[] = [];
  let loading: Promise<SpeechSynthesisVoice[]> | null = null;

  const synthesis = (): SpeechSynthesis | undefined => globalThis.speechSynthesis;

  const refresh = (): SpeechSynthesisVoice[] => {
    const voices = synthesis()?.getVoices() ?? [];
    if (voices.length > 0) cached = voices;
    return cached;
  };

  const load = (): Promise<SpeechSynthesisVoice[]> => {
    const speech = synthesis();
    if (!speech) return Promise.resolve([]);
    if (refresh().length > 0) return Promise.resolve(cached);
    if (loading) return loading;

    loading = new Promise<SpeechSynthesisVoice[]>((resolve) => {
      const finish = () => {
        speech.removeEventListener('voiceschanged', finish);
        clearTimeout(timer);
        loading = null;
        resolve(refresh());
      };
      // Safari sometimes never fires the event, so the timeout is the floor.
      const timer = setTimeout(finish, VOICE_LOAD_TIMEOUT_MS);
      speech.addEventListener('voiceschanged', finish);
    });

    return loading;
  };

  return {
    id: 'web-speech',

    isAvailable() {
      return typeof globalThis.speechSynthesis !== 'undefined';
    },

    async ready() {
      await load();
    },

    voicesFor(locale) {
      return refresh().filter(matchesLanguage(locale)).map(toTtsVoice);
    },

    hasVoiceFor(locale) {
      return refresh().some(matchesLanguage(locale));
    },

    async speak(request: SpeechRequest): Promise<PlaybackHandle> {
      const speech = synthesis();
      if (!speech) return NOOP_PLAYBACK;

      const voice = selectVoice(await load(), request.locale, request.voice);
      // No voice for this language: stay silent rather than mispronounce.
      if (!voice) return NOOP_PLAYBACK;

      const utterance = new SpeechSynthesisUtterance(request.text);
      utterance.voice = voice;
      // Keep lang aligned with the chosen voice so engines do not re-resolve it.
      utterance.lang = voice.lang;
      utterance.rate = request.rate ?? 1;

      const done = new Promise<void>((resolve) => {
        utterance.onend = () => resolve();
        // A failed utterance resolves too: audio is an enhancement, not a gate.
        utterance.onerror = () => resolve();
      });

      speech.cancel();
      speech.speak(utterance);

      return { stop: () => speech.cancel(), done };
    },
  };
}

/**
 * Picks the best voice for a locale, or `undefined` when the device has none
 * for that language. Exported for testing — voice selection is the whole
 * difference between usable and useless pronunciation.
 */
export function selectVoice(
  voices: readonly SpeechSynthesisVoice[],
  locale: LanguageTag,
  preferredName?: string,
): SpeechSynthesisVoice | undefined {
  const candidates = voices.filter(matchesLanguage(locale));
  if (candidates.length === 0) return undefined;

  // An explicit choice wins, as long as it still speaks the right language.
  if (preferredName) {
    const named = candidates.find((voice) => voice.name === preferredName);
    if (named) return named;
  }

  return [...candidates].sort((a, b) => score(b, locale) - score(a, locale) || compare(a, b))[0];
}

function score(voice: SpeechSynthesisVoice, locale: LanguageTag): number {
  let points = 0;
  if (normaliseTag(voice.lang) === normaliseTag(locale)) points += 100;
  if (voice.default) points += 5;
  return points;
}

/** Alphabetical tie-break keeps selection stable across calls and devices. */
function compare(a: SpeechSynthesisVoice, b: SpeechSynthesisVoice): number {
  return a.name.localeCompare(b.name);
}

function matchesLanguage(locale: LanguageTag) {
  const wanted = baseLanguage(normaliseTag(locale));
  return (voice: SpeechSynthesisVoice) => baseLanguage(normaliseTag(voice.lang)) === wanted;
}

/** Voice tags appear as `es_MX` on some platforms and `es-MX` on others. */
function normaliseTag(tag: string): string {
  return tag.replace('_', '-').toLowerCase();
}

function toTtsVoice(voice: SpeechSynthesisVoice): TtsVoice {
  return {
    name: voice.name,
    locale: voice.lang.replace('_', '-'),
    isDefault: voice.default,
  };
}
