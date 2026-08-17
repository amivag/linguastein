import { describe, expect, it, vi } from 'vitest';
import { createAudioService } from '../../src/audio';
import { NOOP_PLAYBACK, type SpeechRequest, type TtsProvider } from '../../src/audio/types';
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
      speak: () => Promise.resolve({ stop, done: Promise.resolve() }),
    };

    const audio = service(provider);
    await audio.play(withoutAudio, { locale: 'es-ES' });
    await audio.play(withoutAudio, { locale: 'es-ES' });
    expect(stop).toHaveBeenCalledTimes(1);
  });
});
