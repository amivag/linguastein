/**
 * Resolves what to play for an item: reviewed canonical audio first, device
 * speech second, silence third. Also owns the playback controls the UI exposes
 * — normal, slow, replay, loop (spec §6.1).
 *
 * Silence is a legitimate outcome: if the dataset has no audio and the device
 * has no voice for the target language, the UI says so rather than reading
 * Spanish with an English voice.
 */

import type { ContentRepository, LanguageTag, LearningItem } from '../domain/content';
import {
  NOOP_PLAYBACK,
  type AudioService,
  type PlaybackHandle,
  type PlayOptions,
  type SpeechRequest,
  type TtsProvider,
  type TtsVoice,
} from './types';

export interface AudioServiceOptions {
  readonly repository: ContentRepository;
  /** Base URL that pack-relative audio paths resolve against. */
  readonly assetBaseUrl: string;
  readonly tts?: TtsProvider;
  /** Injectable for tests; defaults to the DOM `Audio` element. */
  readonly createElement?: (src: string) => HTMLAudioElement;
}

export function createAudioService(options: AudioServiceOptions): AudioService {
  const { repository, assetBaseUrl, tts } = options;
  const createElement = options.createElement ?? ((src: string) => new Audio(src));
  let current: PlaybackHandle | null = null;

  const stop = () => {
    current?.stop();
    current = null;
  };

  const canSpeak = (locale: LanguageTag): boolean => {
    if (!tts?.isAvailable()) return false;
    // A provider that cannot report its voices is trusted; ours can.
    return tts.hasVoiceFor?.(locale) ?? true;
  };

  const playFile = (src: string, rate: number): PlaybackHandle => {
    const element = createElement(src);
    element.playbackRate = rate;
    const done = new Promise<void>((resolve) => {
      element.onended = () => resolve();
      element.onerror = () => resolve();
    });
    void element.play().catch(() => undefined);
    return {
      stop: () => {
        element.pause();
        element.currentTime = 0;
      },
      done,
    };
  };

  const repeatedly = async (
    start: () => Promise<PlaybackHandle> | PlaybackHandle,
    times: number,
  ): Promise<PlaybackHandle> => {
    let handle = await start();
    current = handle;
    if (times <= 1) return handle;

    const done = (async () => {
      await handle.done;
      for (let i = 1; i < times; i++) {
        if (current === null) return;
        handle = await start();
        current = handle;
        await handle.done;
      }
    })();

    return { stop: () => stop(), done };
  };

  return {
    async play(item: LearningItem, playOptions: PlayOptions) {
      stop();
      const rate = playOptions.rate ?? 1;
      const repeat = Math.max(1, playOptions.repeat ?? 1);
      const audio = repository.audioOf(item, playOptions.locale);

      if (audio) {
        const src = new URL(audio.src, assetBaseUrl).toString();
        return repeatedly(() => playFile(src, rate), repeat);
      }
      if (tts?.isAvailable()) {
        return repeatedly(
          () =>
            tts.speak({
              text: item.text,
              locale: playOptions.locale,
              rate,
              voice: playOptions.voice,
            }),
          repeat,
        );
      }
      return NOOP_PLAYBACK;
    },

    async speak(request: SpeechRequest) {
      stop();
      if (!tts?.isAvailable()) return NOOP_PLAYBACK;
      const handle = await tts.speak(request);
      current = handle;
      return handle;
    },

    stop,

    canPlay(item: LearningItem, locale: LanguageTag) {
      return repository.audioOf(item, locale) !== undefined || canSpeak(locale);
    },

    canSpeak,

    voicesFor(locale: LanguageTag): readonly TtsVoice[] {
      return tts?.voicesFor?.(locale) ?? [];
    },

    voiceFor(locale: LanguageTag, preferred?: string): TtsVoice | undefined {
      return tts?.voiceFor?.(locale, preferred);
    },

    async ready() {
      await tts?.ready?.();
    },
  };
}

/** The "slow" control (spec §6.1). */
export const SLOW_RATE = 0.7;
