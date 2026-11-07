/**
 * Resolves what to play for an item — reviewed canonical audio first, device
 * speech second, silence third — and plays it. Also owns the playback controls
 * the UI exposes: normal, slow, replay, loop, and a queue (spec §6.1).
 *
 * Silence is a legitimate outcome: if the dataset has no audio and the device
 * has no voice for the target language, the UI says so rather than reading
 * Spanish with an English voice.
 *
 * ## Why the playing state lives here
 *
 * The service plays exactly one thing at a time and stops whatever was playing
 * before, so "is this playing?" is a fact about the service, not about a button.
 * Kept per screen it would go wrong the obvious way: a row in Browse left lit
 * while a different row is speaking, because nothing told the first one it had
 * been interrupted. `playing()` plus `subscribe` is the whole answer, and it is
 * shaped for `useSyncExternalStore` — one object identity per change, `null` for
 * silence.
 */

import type { ContentRepository, ItemId, LanguageTag, LearningItem } from '../domain/content';
import {
  NOOP_PLAYBACK,
  type AudioService,
  type PlaybackHandle,
  type PlaybackState,
  type PlayOptions,
  type SequenceOptions,
  type SpeechRequest,
  type SpeechSpan,
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

/** One thing to play, and how to start it. */
interface Track {
  readonly text: string;
  /** Absent when a caller spoke a bare string that belongs to no item. */
  readonly itemId?: ItemId;
  start(): Promise<PlaybackHandle> | PlaybackHandle;
}

export function createAudioService(options: AudioServiceOptions): AudioService {
  const { repository, assetBaseUrl, tts } = options;
  const createElement = options.createElement ?? ((src: string) => new Audio(src));

  let current: PlaybackHandle | null = null;
  let state: PlaybackState | null = null;
  let paused = false;
  /**
   * Which run of the player is the live one.
   *
   * `stop` — and every play, which stops first — retires the run before it, so a
   * queue waiting on its next sentence can tell it has been superseded. This was
   * `current === null` before there was a playing state, and that reading broke
   * as soon as there was one: publishing the end of a sentence clears `current`,
   * and the loop would have read that as "stopped" and abandoned the passage.
   */
  let generation = 0;
  const listeners = new Set<(state: PlaybackState | null) => void>();

  const publish = (next: PlaybackState | null) => {
    state = next;
    // Over a copy: a listener that unsubscribes when notified is ordinary React.
    for (const listener of [...listeners]) listener(next);
  };

  const stop = () => {
    generation++;
    paused = false;
    current?.stop();
    current = null;
    if (state !== null) publish(null);
  };

  const pause = () => {
    if (current === null || state === null || paused) return;
    current.pause?.();
    paused = true;
    publish({ ...state, paused: true });
  };

  const resume = () => {
    if (current === null || state === null || !paused) return;
    current.resume?.();
    paused = false;
    publish({ ...state, paused: false });
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
      // A file resumes where it was left; only `stop` rewinds it.
      pause: () => element.pause(),
      resume: () => void element.play().catch(() => undefined),
      done,
    };
  };

  /** How this item would be heard, or nothing if it cannot be. */
  const trackFor = (item: LearningItem, playOptions: PlayOptions): Track | undefined => {
    const rate = playOptions.rate ?? 1;
    const audio = repository.audioOf(item, playOptions.locale);

    if (audio) {
      const src = new URL(audio.src, assetBaseUrl).toString();
      return { text: item.text, itemId: item.id, start: () => playFile(src, rate) };
    }
    if (tts?.isAvailable()) {
      return {
        text: item.text,
        itemId: item.id,
        start: () =>
          tts.speak({
            text: item.text,
            locale: playOptions.locale,
            rate,
            voice: playOptions.voice,
          }),
      };
    }
    return undefined;
  };

  /**
   * Plays a queue and reports where it has got to.
   *
   * The first track starts before the returned promise resolves, so a caller
   * that awaits `play` knows sound has begun — the autoplay effect and several
   * tests depend on it — while the rest of the queue runs on behind `done`.
   */
  const run = async (
    tracks: readonly Track[],
    settings: { readonly from?: number; readonly repeat?: number },
  ): Promise<PlaybackHandle> => {
    stop();
    const mine = generation;
    const repeat = Math.max(1, settings.repeat ?? 1);
    const from = Math.min(Math.max(settings.from ?? 0, 0), Math.max(tracks.length - 1, 0));
    // The loop control repeats a sentence in place rather than the passage at
    // the end, so `repeat` expands here rather than wrapping the whole queue.
    const queue = tracks.flatMap((track, index) =>
      index < from ? [] : Array.from({ length: repeat }, () => ({ track, index })),
    );

    const begin = async (step: number): Promise<PlaybackHandle | null> => {
      const entry = queue[step];
      if (entry === undefined) return null;

      const handle = await entry.track.start();
      // Superseded while the provider was starting: this handle never becomes
      // current, and is stopped rather than left speaking over its replacement.
      if (mine !== generation) {
        handle.stop();
        return null;
      }

      current = handle;
      paused = false;
      const at = (span?: SpeechSpan): PlaybackState => ({
        ...(entry.track.itemId === undefined ? {} : { itemId: entry.track.itemId }),
        text: entry.track.text,
        ...(span === undefined ? {} : { span }),
        index: entry.index,
        total: tracks.length,
        paused,
      });

      publish(at());
      const off = handle.onProgress?.((span) => {
        if (mine === generation && current === handle) publish(at(span));
      });
      void handle.done.then(() => off?.());
      return handle;
    };

    const started = await begin(0);
    if (started === null) return NOOP_PLAYBACK;

    const done = (async () => {
      let handle = started;
      for (let step = 1; step < queue.length; step++) {
        await handle.done;
        if (mine !== generation) return;
        const next = await begin(step);
        if (next === null) return;
        handle = next;
      }
      await handle.done;
      if (mine !== generation) return;
      current = null;
      publish(null);
    })();

    return { stop, pause, resume, done };
  };

  return {
    async play(item: LearningItem, playOptions: PlayOptions) {
      const track = trackFor(item, playOptions);
      if (track === undefined) {
        stop();
        return NOOP_PLAYBACK;
      }
      return run([track], {
        ...(playOptions.repeat === undefined ? {} : { repeat: playOptions.repeat }),
      });
    },

    async playAll(items: readonly LearningItem[], playOptions: SequenceOptions) {
      const tracks = items
        .map((item) => trackFor(item, playOptions))
        .filter((track): track is Track => track !== undefined);
      // An id that is not in the queue — an unplayable sentence, a stale link —
      // starts from the top rather than refusing to play.
      const from = tracks.findIndex((track) => track.itemId === playOptions.startAt);
      return run(tracks, { from: Math.max(from, 0) });
    },

    async speak(request: SpeechRequest) {
      if (!tts?.isAvailable()) {
        stop();
        return NOOP_PLAYBACK;
      }
      return run([{ text: request.text, start: () => tts.speak(request) }], {});
    },

    stop,
    pause,
    resume,

    canPause() {
      return current !== null && current.pause !== undefined;
    },

    playing() {
      return state;
    },

    subscribe(listener: (state: PlaybackState | null) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

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
