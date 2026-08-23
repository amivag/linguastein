/**
 * A listen has to be endable.
 *
 * The recogniser ends one itself only once it judges the speaker to have
 * finished, and it does not always judge that — a noisy room holds its
 * endpointer open, and a browser can simply stop firing events. So `stop` is
 * load-bearing rather than a tidy-up, and these tests hold the two ways it
 * used to fail: losing the handle on the live recogniser, and never settling
 * the promise the UI is waiting on.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createWebSpeechRecognitionProvider,
  SPEECH_ABORTED,
  SPEECH_INSECURE_CONTEXT,
  type MicrophoneHandle,
  type MicrophoneLevels,
} from '../../src/audio';

/** Stands in for the browser's recogniser, with the events under test control. */
class FakeRecognition {
  static instances: FakeRecognition[] = [];

  lang = '';
  continuous = true;
  interimResults = true;
  maxAlternatives = 0;
  started = false;
  aborts = 0;
  onresult: ((event: unknown) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;

  constructor() {
    FakeRecognition.instances.push(this);
  }

  start() {
    this.started = true;
  }

  stop() {}

  abort() {
    this.aborts += 1;
  }

  /** What the browser sends for a single final result with alternatives. */
  hear(...transcripts: readonly string[]) {
    const alternatives = Object.assign(
      transcripts.map((transcript) => ({ transcript, confidence: 0.9 })),
      { isFinal: true },
    );
    this.onresult?.({ results: [alternatives] });
    this.onend?.();
  }

  /** A reading it has not committed to: what arrives while someone is talking. */
  hearing(transcript: string) {
    const alternatives = Object.assign([{ transcript, confidence: 0 }], { isFinal: false });
    this.onresult?.({ results: [alternatives] });
  }
}

/**
 * A microphone under test control. `pending` holds it open — the permission
 * prompt nobody has answered yet — and `error` is a device that will not open.
 */
function fakeMicrophone(options: { pending?: boolean; error?: Error } = {}) {
  const state = {
    opens: 0,
    closes: 0,
    report: undefined as ((level: number) => void) | undefined,
    finishOpening: () => {},
  };

  const levels: MicrophoneLevels = {
    id: 'fake-microphone',
    isAvailable: () => true,
    open: (onLevel) => {
      state.opens += 1;
      state.report = onLevel;
      if (options.error) return Promise.reject(options.error);
      const handle: MicrophoneHandle = {
        close: () => {
          state.closes += 1;
        },
      };
      if (!options.pending) return Promise.resolve(handle);
      return new Promise<MicrophoneHandle>((resolve) => {
        state.finishOpening = () => resolve(handle);
      });
    },
  };

  return { levels, state };
}

/** The recogniser exists only once the microphone is open, so tests wait for it. */
const started = () => vi.waitFor(() => expect(FakeRecognition.instances).toHaveLength(1));

const scope = globalThis as unknown as { SpeechRecognition?: unknown };

beforeEach(() => {
  FakeRecognition.instances = [];
  scope.SpeechRecognition = FakeRecognition;
});

afterEach(() => {
  delete scope.SpeechRecognition;
  vi.useRealTimers();
});

/** The recogniser the nth `listen` created. */
const nth = (index: number) => FakeRecognition.instances[index]!;

describe('web speech recognition', () => {
  it('resolves with the best reading and the alternatives behind it', async () => {
    const speech = createWebSpeechRecognitionProvider();
    const heard = speech.listen('es-ES');

    nth(0).hear(' tengo que trabajar ', 'ten go que trabajar');

    await expect(heard).resolves.toEqual({
      transcript: 'tengo que trabajar',
      confidence: 0.9,
      alternatives: ['tengo que trabajar', 'ten go que trabajar'],
    });
  });

  it('listens once per press rather than continuously', () => {
    createWebSpeechRecognitionProvider()
      .listen('es-ES')
      .catch(() => {});
    expect(nth(0).continuous).toBe(false);
    expect(nth(0).started).toBe(true);
  });

  it('stops on request, and says the stop was deliberate', async () => {
    const speech = createWebSpeechRecognitionProvider();
    const heard = speech.listen('es-ES');

    speech.stop();

    expect(nth(0).aborts).toBe(1);
    await expect(heard).rejects.toThrow(SPEECH_ABORTED);
  });

  it('settles a stop even from a recogniser that has gone quiet', async () => {
    const speech = createWebSpeechRecognitionProvider();
    // A recogniser that never fires `onend` again — the case where waiting for
    // the event to settle the promise leaves the UI listening for good.
    const heard = speech.listen('es-ES');
    nth(0).onend = null;

    speech.stop();

    await expect(heard).rejects.toThrow(SPEECH_ABORTED);
  });

  it('can still stop the live listen after an earlier one ends late', async () => {
    const speech = createWebSpeechRecognitionProvider();
    const first = speech.listen('es-ES');
    first.catch(() => {});
    const second = speech.listen('es-ES');

    // The aborted first recogniser reports its end after the second is already
    // listening. Clearing the slot on its behalf would lose the handle on the
    // second, and the microphone would stay open with nothing able to close it.
    nth(0).onend?.();
    speech.stop();

    expect(nth(1).aborts).toBe(1);
    await expect(second).rejects.toThrow(SPEECH_ABORTED);
  });

  it('gives up on a listen that never ends, rather than listening for ever', async () => {
    vi.useFakeTimers();
    const speech = createWebSpeechRecognitionProvider();
    const heard = speech.listen('es-ES');

    vi.advanceTimersByTime(60_000);

    expect(nth(0).aborts).toBe(1);
    await expect(heard).rejects.toThrow('no-speech');
  });

  it('leaves nothing listening once a result has been returned', async () => {
    const speech = createWebSpeechRecognitionProvider();
    const heard = speech.listen('es-ES');
    nth(0).hear('hola');
    await heard;

    // Nothing is in flight, so a stop has nothing to abort.
    speech.stop();
    expect(nth(0).aborts).toBe(0);
  });

  it('says what it is hearing before it has decided what it heard', async () => {
    const speech = createWebSpeechRecognitionProvider();
    const partials: string[] = [];
    const heard = speech.listen('es-ES', { onPartial: (text) => partials.push(text) });

    nth(0).hearing('tengo');
    nth(0).hearing('tengo que');

    // Reported, and not settled: the recogniser is still deciding.
    expect(partials).toEqual(['tengo', 'tengo que']);
    nth(0).hear('tengo que trabajar');
    await expect(heard).resolves.toMatchObject({ transcript: 'tengo que trabajar' });
  });

  it('returns what it heard when the recogniser ends without committing to it', async () => {
    const speech = createWebSpeechRecognitionProvider();
    const heard = speech.listen('es-ES');

    // Android ends this way often enough to matter: words arrive, then the
    // session closes with no final result. Reporting silence there tells a
    // learner who said the sentence correctly that nothing was heard.
    nth(0).hearing('tengo que trabajar');
    nth(0).onend?.();

    await expect(heard).resolves.toMatchObject({ transcript: 'tengo que trabajar' });
  });

  it('prefers what it heard to a report of silence', async () => {
    const speech = createWebSpeechRecognitionProvider();
    const heard = speech.listen('es-ES');

    nth(0).hearing('hola');
    nth(0).onerror?.({ error: 'no-speech' });

    await expect(heard).resolves.toMatchObject({ transcript: 'hola' });
  });

  it('still reports silence as silence when nothing was heard at all', async () => {
    const speech = createWebSpeechRecognitionProvider();
    const heard = speech.listen('es-ES');

    nth(0).onerror?.({ error: 'no-speech' });

    await expect(heard).rejects.toThrow('no-speech');
  });

  it('names a plain-HTTP page as the cause rather than blaming the microphone', async () => {
    // jsdom defines no `isSecureContext`, which is why the provider treats only
    // an explicit `false` as insecure — an absent flag is not a verdict.
    Object.defineProperty(globalThis, 'isSecureContext', { value: false, configurable: true });
    try {
      const speech = createWebSpeechRecognitionProvider();
      await expect(speech.listen('es-ES')).rejects.toThrow(SPEECH_INSECURE_CONTEXT);
      expect(FakeRecognition.instances).toHaveLength(0);
    } finally {
      Reflect.deleteProperty(globalThis, 'isSecureContext');
    }
  });
});

/**
 * The microphone goes first, and that ordering is the fix for the bug this
 * feature had on Android: a recogniser started without the permission ends at
 * once, silently, and asking for the microphone through `getUserMedia` is what
 * makes the browser prompt for it.
 */
describe('the microphone in front of the recogniser', () => {
  it('opens the microphone before starting, and gives it back afterwards', async () => {
    const microphone = fakeMicrophone();
    const speech = createWebSpeechRecognitionProvider({ microphone: microphone.levels });
    const heard = speech.listen('es-ES');

    // The whole point of going first: nothing is listening yet.
    expect(microphone.state.opens).toBe(1);
    expect(FakeRecognition.instances).toHaveLength(0);

    await started();
    nth(0).hear('hola');

    await expect(heard).resolves.toMatchObject({ transcript: 'hola' });
    // Released on the result, not on some later event a browser may not send:
    // a stream left open holds the recording indicator on and the device away
    // from the next listen.
    expect(microphone.state.closes).toBe(1);
  });

  it('passes the level through to whoever asked for one', async () => {
    const microphone = fakeMicrophone();
    const speech = createWebSpeechRecognitionProvider({ microphone: microphone.levels });
    const levels: number[] = [];
    const heard = speech.listen('es-ES', { onLevel: (level) => levels.push(level) });
    await started();

    microphone.state.report?.(0.4);
    microphone.state.report?.(0.1);

    expect(levels).toEqual([0.4, 0.1]);
    nth(0).hear('hola');
    await heard;
  });

  it('never starts listening for a listen that was stopped while the prompt was up', async () => {
    const microphone = fakeMicrophone({ pending: true });
    const speech = createWebSpeechRecognitionProvider({ microphone: microphone.levels });
    const heard = speech.listen('es-ES');

    speech.stop();
    // The permission is granted a moment after the learner gave up. Both halves
    // matter: nothing starts listening, and the device is handed straight back.
    microphone.state.finishOpening();

    await expect(heard).rejects.toThrow(SPEECH_ABORTED);
    await vi.waitFor(() => expect(microphone.state.closes).toBe(1));
    expect(FakeRecognition.instances).toHaveLength(0);
  });

  it('fails the listen with the reason the microphone gave', async () => {
    const microphone = fakeMicrophone({ error: new Error('not-allowed') });
    const speech = createWebSpeechRecognitionProvider({ microphone: microphone.levels });

    // A denied microphone is a denied listen: starting the recogniser anyway
    // would trade a reason the UI can explain for a silent, unexplained end.
    await expect(speech.listen('es-ES')).rejects.toThrow('not-allowed');
    expect(FakeRecognition.instances).toHaveLength(0);
  });

  it('listens anyway where there is no microphone to meter', async () => {
    const absent: MicrophoneLevels = {
      id: 'absent',
      isAvailable: () => false,
      open: () => Promise.reject(new Error('audio-capture')),
    };
    const speech = createWebSpeechRecognitionProvider({ microphone: absent });
    const heard = speech.listen('es-ES');

    // Synchronously, as before there was a meter: a browser without
    // `getUserMedia` must still get its listen.
    expect(FakeRecognition.instances).toHaveLength(1);
    nth(0).hear('hola');
    await expect(heard).resolves.toMatchObject({ transcript: 'hola' });
  });
});
