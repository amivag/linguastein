import { describe, expect, it, vi } from 'vitest';
import { createAudioService } from '../../src/audio';
import {
  NOOP_PLAYBACK,
  type SpeechRequest,
  type SpeechSpan,
  type TtsProvider,
} from '../../src/audio/types';
import type { ItemId } from '../../src/domain/content';
import { id, testRepository } from '../fixtures/pack';

const repository = testRepository();
const withAudio = repository.getItem(id<ItemId>('test-es:item:001'))!;
const withoutAudio = repository.getItem(id<ItemId>('test-es:item:002'))!;

function fakeTts(languages: readonly string[]) {
  const spoken: SpeechRequest[] = [];
  const provider: TtsProvider = {
    id: 'fake',
    isAvailable: () => true,
    hasVoiceFor: (locale) => languages.some((lang) => lang.startsWith(locale.slice(0, 2))),
    voicesFor: (locale) =>
      languages
        .filter((lang) => lang.startsWith(locale.slice(0, 2)))
        .map((lang) => ({ name: `voice-${lang}`, locale: lang, isDefault: false })),
    ready: () => Promise.resolve(),
    speak: (request) => {
      spoken.push(request);
      return Promise.resolve(NOOP_PLAYBACK);
    },
  };
  return { provider, spoken };
}

const service = (tts?: TtsProvider) =>
  createAudioService({
    repository,
    assetBaseUrl: 'https://example.test/packs/',
    ...(tts ? { tts } : {}),
    createElement: () =>
      ({ play: () => Promise.resolve(), pause: () => {}, currentTime: 0 }) as HTMLAudioElement,
  });

describe('AudioService', () => {
  it('prefers dataset audio over speech synthesis', async () => {
    const { provider, spoken } = fakeTts(['es-ES']);
    await service(provider).play(withAudio, { locale: 'es-ES' });
    expect(spoken).toEqual([]);
  });

  it('falls back to speech, passing the chosen voice through', async () => {
    const { provider, spoken } = fakeTts(['es-ES']);
    await service(provider).play(withoutAudio, {
      locale: 'es-MX',
      rate: 0.7,
      voice: 'voice-es-ES',
    });

    expect(spoken).toEqual([
      { text: 'Tengo que irme.', locale: 'es-MX', rate: 0.7, voice: 'voice-es-ES' },
    ]);
  });

  it('reports an item as unplayable when neither audio nor a voice exists', () => {
    const englishOnly = service(fakeTts(['en-US']).provider);

    expect(englishOnly.canSpeak('es-ES')).toBe(false);
    // Dataset audio still makes this item playable.
    expect(englishOnly.canPlay(withAudio, 'es-ES')).toBe(true);
    expect(englishOnly.canPlay(withoutAudio, 'es-ES')).toBe(false);
  });

  it('reports nothing playable without a provider at all', () => {
    expect(service().canSpeak('es-ES')).toBe(false);
    expect(service().voicesFor('es-ES')).toEqual([]);
  });

  it('repeats playback for the loop control', async () => {
    const { provider, spoken } = fakeTts(['es-ES']);
    const handle = await service(provider).play(withoutAudio, { locale: 'es-ES', repeat: 3 });
    await handle.done;
    expect(spoken).toHaveLength(3);
  });

  it('stops the previous playback before starting a new one', async () => {
    const stop = vi.fn();
    const provider: TtsProvider = {
      id: 'stoppable',
      isAvailable: () => true,
      hasVoiceFor: () => true,
      // Never resolves: an utterance that is still being spoken, which is the
      // only kind there is anything to interrupt. It used to resolve at once —
      // playback that had already finished — and passed only because nothing
      // cleared the handle when it ended.
      speak: () => Promise.resolve({ stop, done: new Promise<void>(() => {}) }),
    };

    const audio = service(provider);
    await audio.play(withoutAudio, { locale: 'es-ES' });
    await audio.play(withoutAudio, { locale: 'es-ES' });
    expect(stop).toHaveBeenCalledTimes(1);
  });
});

/**
 * A voice under the test's control: it says what it was asked for, and stays
 * speaking until the test says otherwise. Everything about a queue — order,
 * position, holding it, starting in the middle — needs a sentence that does not
 * end on its own.
 */
function scriptedTts() {
  const spoken: string[] = [];
  const progress: ((span: SpeechSpan) => void)[] = [];
  let end: (() => void) | undefined;

  const provider: TtsProvider = {
    id: 'scripted',
    isAvailable: () => true,
    hasVoiceFor: () => true,
    speak: (request) => {
      spoken.push(request.text);
      const done = new Promise<void>((resolve) => {
        end = resolve;
      });
      return Promise.resolve({
        stop: () => end?.(),
        pause: () => {},
        resume: () => {},
        onProgress: (listener) => {
          progress.push(listener);
          return () => {};
        },
        done,
      });
    },
  };

  return {
    provider,
    spoken,
    /** The sentence now speaking reaches its end. */
    finish: () => end?.(),
    /** The engine reports a word boundary. */
    boundary: (span: SpeechSpan) => {
      for (const listener of progress) listener(span);
    },
  };
}

describe('a queue of items', () => {
  const first = repository.getItem(id<ItemId>('test-es:item:002'))!;
  const second = repository.getItem(id<ItemId>('test-es:item:003'))!;

  it('reads one sentence at a time, in order, and says where it is', async () => {
    const { provider, spoken, finish } = scriptedTts();
    const audio = service(provider);

    await audio.playAll([first, second], { locale: 'es-ES' });

    expect(spoken).toEqual([first.text]);
    expect(audio.playing()).toMatchObject({
      itemId: first.id,
      text: first.text,
      index: 0,
      total: 2,
      paused: false,
    });

    finish();
    await vi.waitFor(() => expect(spoken).toEqual([first.text, second.text]));
    expect(audio.playing()).toMatchObject({ itemId: second.id, index: 1, total: 2 });

    finish();
    // The queue is done: silence, and nothing left claiming to be playing.
    await vi.waitFor(() => expect(audio.playing()).toBeNull());
  });

  it('starts at the sentence a learner picked, and carries on from there', async () => {
    const { provider, spoken, finish } = scriptedTts();
    const audio = service(provider);

    await audio.playAll([first, second], { locale: 'es-ES', startAt: second.id });

    expect(spoken).toEqual([second.text]);
    finish();
    // The end of the queue, not a wrap back round to the top.
    await vi.waitFor(() => expect(audio.playing()).toBeNull());
    expect(spoken).toEqual([second.text]);
  });

  it('holds where it is, and picks up from there', async () => {
    const { provider } = scriptedTts();
    const audio = service(provider);
    await audio.playAll([first, second], { locale: 'es-ES' });

    audio.pause();
    expect(audio.playing()).toMatchObject({ itemId: first.id, paused: true });

    audio.resume();
    expect(audio.playing()).toMatchObject({ itemId: first.id, paused: false });
  });

  it('reports the word the voice has reached, where the engine says', async () => {
    const { provider, boundary } = scriptedTts();
    const audio = service(provider);
    await audio.playAll([first, second], { locale: 'es-ES' });

    boundary({ start: 6, end: 9 });
    expect(audio.playing()?.span).toEqual({ start: 6, end: 9 });
  });

  it('tells subscribers, and stops telling them once they leave', async () => {
    const { provider } = scriptedTts();
    const audio = service(provider);
    const heard: (string | null)[] = [];
    const unsubscribe = audio.subscribe((state) => heard.push(state?.text ?? null));

    await audio.play(first, { locale: 'es-ES' });
    audio.stop();
    unsubscribe();
    await audio.play(second, { locale: 'es-ES' });

    expect(heard).toEqual([first.text, null]);
  });
});
