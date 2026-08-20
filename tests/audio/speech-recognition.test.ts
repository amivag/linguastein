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
import { createWebSpeechRecognitionProvider, SPEECH_ABORTED } from '../../src/audio';

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
}

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
    createWebSpeechRecognitionProvider().listen('es-ES').catch(() => {});
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
});
