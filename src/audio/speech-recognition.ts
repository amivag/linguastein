/**
 * Speech input via the browser's built-in recogniser (spec §6.2).
 *
 * Free and native: no API key, no cost, nothing to host. Support is uneven —
 * Chrome, Edge and Safari have it, Firefox does not — so it is strictly an
 * assist. Every exercise that offers it still works by self-rating, and the
 * control simply does not appear where the browser cannot listen.
 *
 * Privacy note worth knowing: desktop Chrome sends audio to a Google service
 * for transcription, while Android and iOS recognise on-device. The app never
 * records, stores or transmits audio itself.
 */

import { baseLanguage, type LanguageTag } from '../domain/content';
import type { SpeechRecognitionProvider, SpeechResult } from './types';

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string; confidence: number }> & { isFinal: boolean }>;
}

type RecognitionConstructor = new () => SpeechRecognitionLike;

function constructor(): RecognitionConstructor | undefined {
  const scope = globalThis as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
}

export function createWebSpeechRecognitionProvider(): SpeechRecognitionProvider {
  let active: SpeechRecognitionLike | null = null;

  const stop = () => {
    active?.abort();
    active = null;
  };

  return {
    id: 'web-speech-recognition',

    isAvailable() {
      return constructor() !== undefined;
    },

    supportsLanguage(locale: LanguageTag) {
      // The API exposes no capability list, so this is best-effort: the
      // recogniser accepts a BCP 47 tag and may fall back on its own.
      return constructor() !== undefined && baseLanguage(locale).length > 0;
    },

    stop,

    listen(locale: LanguageTag): Promise<SpeechResult> {
      const Recognition = constructor();
      if (!Recognition) {
        return Promise.reject(new Error('speech recognition unavailable'));
      }

      stop();
      const recognition = new Recognition();
      active = recognition;
      recognition.lang = locale;
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 3;

      return new Promise<SpeechResult>((resolve, reject) => {
        let settled = false;

        recognition.onresult = (event) => {
          const alternatives = event.results[0];
          const best = alternatives?.[0];
          if (!best) return;
          settled = true;
          resolve({
            transcript: best.transcript.trim(),
            confidence: best.confidence,
            alternatives: Array.from({ length: alternatives.length }, (_, index) =>
              alternatives[index]!.transcript.trim(),
            ),
          });
        };

        recognition.onerror = (event) => {
          settled = true;
          reject(new Error(event.error));
        };

        recognition.onend = () => {
          active = null;
          // Ending without a result means the recogniser heard nothing usable.
          if (!settled) reject(new Error('no-speech'));
        };

        recognition.start();
      });
    },
  };
}
