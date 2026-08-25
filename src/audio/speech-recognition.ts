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
 *
 * ## Why the microphone is opened before the recogniser is started
 *
 * On Android — most reliably in an installed PWA, which is how this app is
 * meant to be used — starting the recogniser does not always ask for the
 * microphone permission. It ends instead, immediately and silently, which
 * reaches the learner as "nothing happens when I press Say it". Opening the
 * microphone through `getUserMedia` first *does* prompt, and once the origin
 * has the permission the recogniser has it too.
 *
 * The stream is then held for the length of the listen, because it is also what
 * the level meter reads. The cost is the synchronous start: `start()` now
 * happens a promise later than the press, which no engine requires. What it
 * buys is the permission prompt and the only feedback a learner gets while the
 * recogniser is making up its mind.
 */

import { baseLanguage, type LanguageTag } from '../domain/content';
import {
  SPEECH_ABORTED,
  SPEECH_INSECURE_CONTEXT,
  SPEECH_UNAVAILABLE,
  type ListenOptions,
  type MicrophoneHandle,
  type MicrophoneLevels,
  type SpeechRecognitionProvider,
  type SpeechResult,
} from './types';

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

/** One reading of one stretch of speech, best alternative first. */
type Alternatives = ArrayLike<{ transcript: string; confidence: number }> & { isFinal: boolean };

interface SpeechRecognitionEventLike {
  results: ArrayLike<Alternatives>;
}

type RecognitionConstructor = new () => SpeechRecognitionLike;

/**
 * How long one listen may stay open. The recogniser is supposed to end itself
 * once the speaker stops, but a noisy room can hold its endpointer open for as
 * long as the noise lasts, and a browser that stops firing events leaves it
 * open for good. Well past any single sentence, so this only ever catches a
 * listen that was never going to end on its own.
 *
 * It covers opening the microphone as well: a permission prompt nobody answers
 * is another way for a listen to never end.
 */
const MAX_LISTEN_MS = 20_000;

/**
 * One listen in flight. Every way it can end — a result, an error, the
 * recogniser closing, the learner pressing stop, the watchdog giving up —
 * funnels through `settle`, and only the first of them counts.
 */
interface Listening {
  /** Set once the microphone is open and the recogniser has been created. */
  recognition: SpeechRecognitionLike | undefined;
  microphone: MicrophoneHandle | undefined;
  readonly settle: (outcome: SpeechResult | Error) => void;
  /** Read by the microphone step, which must not start a listen that is over. */
  settled: boolean;
  timer: ReturnType<typeof setTimeout> | undefined;
  /**
   * The best reading so far, provisional included. Kept because a recogniser
   * that ends without committing has usually still heard something, and
   * throwing that away is how a sentence the learner did say becomes "I did not
   * hear anything".
   */
  heard: string;
}

function constructor(): RecognitionConstructor | undefined {
  const scope = globalThis as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
}

/**
 * What the event says, in two parts: the committed reading if there is one, and
 * everything heard so far including what is still provisional.
 *
 * Both halves are needed now that interim results are on. A listen shows the
 * provisional text as it arrives and settles only on a committed result — with
 * the provisional text as the fallback if the recogniser never commits one.
 */
function readResults(event: SpeechRecognitionEventLike): {
  committed: Alternatives | undefined;
  heard: string;
} {
  let committed: Alternatives | undefined;
  const parts: string[] = [];
  for (let index = 0; index < event.results.length; index += 1) {
    const result = event.results[index];
    const best = result?.[0];
    if (!result || !best) continue;
    parts.push(best.transcript.trim());
    if (result.isFinal) committed = result;
  }
  return { committed, heard: parts.join(' ').replace(/\s+/g, ' ').trim() };
}

export interface WebSpeechRecognitionOptions {
  /**
   * The microphone, opened for the length of a listen. Optional: without it the
   * recogniser is started directly — no level meter, and no permission prompt
   * on the browsers that need one before they will listen.
   */
  readonly microphone?: MicrophoneLevels | undefined;
}

export function createWebSpeechRecognitionProvider(
  options: WebSpeechRecognitionOptions = {},
): SpeechRecognitionProvider {
  const { microphone } = options;
  let current: Listening | null = null;

  /** Releases the slot, the watchdog and the microphone once a listen is done. */
  const close = (listening: Listening) => {
    clearTimeout(listening.timer);
    listening.timer = undefined;
    listening.microphone?.close();
    listening.microphone = undefined;
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
    // `recognition` is undefined while the microphone is still opening. The
    // settle below is what ends that listen: the microphone step checks
    // `settled` before it starts anything.
    listening.recognition?.abort();
    // Settled here rather than left to `onend`, because a recogniser that has
    // stopped firing events is precisely the case a stop has to recover from.
    listening.settle(new Error(SPEECH_ABORTED));
  };

  /** Creates the recogniser, wires every way a listen can end, and starts it. */
  const startListening = (
    listening: Listening,
    locale: LanguageTag,
    listenOptions: ListenOptions,
  ) => {
    const Recognition = constructor();
    if (!Recognition) {
      close(listening);
      listening.settle(new Error(SPEECH_UNAVAILABLE));
      return;
    }

    const recognition = new Recognition();
    listening.recognition = recognition;
    recognition.lang = locale;
    recognition.continuous = false;
    // On, so the UI can show what is being heard while it is being heard. The
    // handler below commits only on a final result, so this changes what a
    // listen reports on the way, not when it ends.
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;

    /** Ends the listen with the provisional text, or as silence if there is none. */
    const settleWithWhatWasHeard = () => {
      if (listening.heard) listening.settle({ transcript: listening.heard, confidence: 0 });
      else listening.settle(new Error('no-speech'));
    };

    recognition.onresult = (event) => {
      const { committed, heard } = readResults(event);
      if (heard && heard !== listening.heard) {
        listening.heard = heard;
        listenOptions.onPartial?.(heard);
      }
      // Provisional: shown, not settled. The recogniser is still deciding.
      if (!committed) return;
      const best = committed[0];
      if (!best) return;
      close(listening);
      listening.settle({
        transcript: best.transcript.trim(),
        confidence: best.confidence,
        alternatives: Array.from({ length: committed.length }, (_, index) =>
          committed[index]!.transcript.trim(),
        ),
      });
    };

    recognition.onerror = (event) => {
      close(listening);
      // A recogniser can report silence having already reported words. Android
      // ends this way often enough that taking it at its word would discard a
      // sentence the learner did say.
      if (event.error === 'no-speech') settleWithWhatWasHeard();
      else listening.settle(new Error(event.error));
    };

    recognition.onend = () => {
      close(listening);
      settleWithWhatWasHeard();
    };

    recognition.start();
  };

  /** Opens the microphone, then starts — see the note at the top of the file. */
  const openThenListen = async (
    listening: Listening,
    locale: LanguageTag,
    listenOptions: ListenOptions,
    levels: MicrophoneLevels,
  ) => {
    let handle: MicrophoneHandle;
    try {
      handle = await levels.open((level) => listenOptions.onLevel?.(level));
    } catch (error) {
      close(listening);
      listening.settle(error instanceof Error ? error : new Error('audio-capture'));
      return;
    }

    // The learner may have pressed stop — or the watchdog may have fired —
    // while the permission prompt was up. Starting now would hold a microphone
    // nothing is waiting on.
    if (listening.settled) {
      handle.close();
      return;
    }

    listening.microphone = handle;
    startListening(listening, locale, listenOptions);
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

    listen(locale: LanguageTag, listenOptions: ListenOptions = {}): Promise<SpeechResult> {
      if (!constructor()) {
        return Promise.reject(new Error(SPEECH_UNAVAILABLE));
      }
      // Checked before anything is opened, because over plain HTTP there is
      // nothing to open and the browser reports that only to its console.
      if (globalThis.isSecureContext === false) {
        return Promise.reject(new Error(SPEECH_INSECURE_CONTEXT));
      }

      stop();

      return new Promise<SpeechResult>((resolve, reject) => {
        const listening: Listening = {
          recognition: undefined,
          microphone: undefined,
          settle: (outcome) => {
            if (listening.settled) return;
            listening.settled = true;
            if (outcome instanceof Error) reject(outcome);
            else resolve(outcome);
          },
          settled: false,
          timer: undefined,
          heard: '',
        };
        current = listening;

        listening.timer = setTimeout(() => {
          close(listening);
          listening.recognition?.abort();
          listening.settle(new Error('no-speech'));
        }, MAX_LISTEN_MS);

        // Available, not merely configured: a browser with no `getUserMedia`
        // must still get a listen rather than an error about a meter.
        if (microphone?.isAvailable()) {
          void openThenListen(listening, locale, listenOptions, microphone);
        } else {
          startListening(listening, locale, listenOptions);
        }
      });
    },
  };
}
