/**
 * Device speech synthesis: the free, offline-capable fallback used when a
 * dataset has no reviewed audio yet. Canonical pre-generated audio always wins
 * where it exists (spec §6, §25).
 */

import { baseLanguage, type LanguageTag } from '../domain/content';
import { NOOP_PLAYBACK, type PlaybackHandle, type SpeechRequest, type TtsProvider } from './types';

export function createWebSpeechTtsProvider(): TtsProvider {
  return {
    id: 'web-speech',

    isAvailable() {
      return typeof globalThis.speechSynthesis !== 'undefined';
    },

    speak(request: SpeechRequest): Promise<PlaybackHandle> {
      const synthesis = globalThis.speechSynthesis;
      if (!synthesis) return Promise.resolve(NOOP_PLAYBACK);

      const utterance = new SpeechSynthesisUtterance(request.text);
      utterance.lang = request.locale;
      utterance.rate = request.rate ?? 1;

      const voice = pickVoice(synthesis.getVoices(), request.locale, request.voice);
      if (voice) utterance.voice = voice;

      const done = new Promise<void>((resolve) => {
        utterance.onend = () => resolve();
        // A failed utterance resolves too: audio is an enhancement, not a gate.
        utterance.onerror = () => resolve();
      });

      synthesis.cancel();
      synthesis.speak(utterance);

      return Promise.resolve({
        stop: () => synthesis.cancel(),
        done,
      });
    },
  };
}

function pickVoice(
  voices: readonly SpeechSynthesisVoice[],
  locale: LanguageTag,
  preferredName?: string,
): SpeechSynthesisVoice | undefined {
  if (preferredName) {
    const named = voices.find((voice) => voice.name === preferredName);
    if (named) return named;
  }
  return (
    voices.find((voice) => voice.lang.replace('_', '-') === locale) ??
    voices.find((voice) => baseLanguage(voice.lang.replace('_', '-')) === baseLanguage(locale))
  );
}
