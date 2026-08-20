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
import { SPEECH_ABORTED, type SpeechRecognitionProvider, type SpeechResult } from './types';

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

/**
 * How long one listen may stay open. The recogniser is supposed to end itself
 * once the speaker stops, but a noisy room can hold its endpointer open for as
 * long as the noise lasts, and a browser that stops firing events leaves it
 * open for good. Well past any single sentence, so this only ever catches a
 * listen that was never going to end on its own.
 */
const MAX_LISTEN_MS = 20_000;

/**
 * One listen in flight. Every way it can end — a result, an error, the
 * recogniser closing, the learner pressing stop, the watchdog giving up —
 * funnels through `settle`, and only the first of them counts.
 */
interface Listening {
  readonly recognition: SpeechRecognitionLike;
  readonly settle: (outcome: SpeechResult | Error) => void;
  timer: ReturnType<typeof setTimeout> | undefined;
}

function constructor(): RecognitionConstructor | undefined {
  const scope = globalThis as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
}

export function createWebSpeechRecognitionProvider(): SpeechRecognitionProvider {
  let current: Listening | null = null;

  /** Releases the slot and the watchdog once a listen is done with. */
  const close = (listening: Listening) => {
    clearTimeout(listening.timer);
    listening.timer = undefined;
    // An aborted recogniser fires `onend` after the next `listen` has already
    // claimed the slot. Only the listen that still holds it may clear it —
    // clearing it blindly loses the handle on the live recogniser, and `stop`
    // then has nothing to abort, which is how the microphone stays open with
    // no way to close it.
    if (current === listening) current = null;
  };

  const stop = () => {
    const listening = current;
    if (!listening) return;
    close(listening);
    listening.recognition.abort();
    // Settled here rather than left to `onend`, because a recogniser that has
    // stopped firing events is precisely the case a stop has to recover from.
    listening.settle(new Error(SPEECH_ABORTED));
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
      recognition.lang = locale;
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 3;

      return new Promise<SpeechResult>((resolve, reject) => {
        let settled = false;
        const listening: Listening = {
          recognition,
          settle: (outcome) => {
            if (settled) return;
            settled = true;
            if (outcome instanceof Error) reject(outcome);
            else resolve(outcome);
          },
          timer: undefined,
        };
        current = listening;

        listening.timer = setTimeout(() => {
          close(listening);
          recognition.abort();
          listening.settle(new Error('no-speech'));
        }, MAX_LISTEN_MS);

        recognition.onresult = (event) => {
          const alternatives = event.results[0];
          const best = alternatives?.[0];
          if (!best) return;
          listening.settle({
            transcript: best.transcript.trim(),
            confidence: best.confidence,
            alternatives: Array.from({ length: alternatives.length }, (_, index) =>
              alternatives[index]!.transcript.trim(),
            ),
          });
        };

        recognition.onerror = (event) => {
          listening.settle(new Error(event.error));
        };

        recognition.onend = () => {
          close(listening);
          // Ending without a result means the recogniser heard nothing usable.
          listening.settle(new Error('no-speech'));
        };

        recognition.start();
      });
    },
  };
}
