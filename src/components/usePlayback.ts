/**
 * Reading — and driving — what the app is saying out loud.
 *
 * The audio service is the single source of "what is playing" (see
 * `audio-service.ts`), so these are subscriptions to it rather than state of
 * their own. Two details are deliberate:
 *
 * - **The services context is read directly, and may be absent.** `Transcript`
 *   and `TokenizedText` are presentational and several of their tests mount them
 *   with no providers at all, exactly as {@link useItemLanguage} describes. A
 *   hook that threw there would make the highlight a reason to change how those
 *   components are tested.
 * - **Each hook subscribes to the narrowest answer it needs.** A word boundary
 *   fires three or four times a second and every tokenised phrase on the screen
 *   is a subscriber; returning a token id — rather than the state object it came
 *   from — means React re-renders the one phrase whose word changed, and bails
 *   out on the ninety that did not.
 */

import { use, useCallback, useSyncExternalStore } from 'react';
import { usePronunciationLocale, useVoiceName } from '../app/course';
import { ServicesContext, useServices } from '../app/services-context';
import { isSpeaking, speakingToken, type PlaybackState } from '../audio';
import type { LearningItem, TokenId } from '../domain/content';

/** Subscribes to the audio service, tolerating its absence in a bare render. */
function usePlaybackValue<T>(select: (state: PlaybackState | null) => T): T {
  const value = use(ServicesContext);
  const audio = value?.services.audio;

  const subscribe = useCallback(
    (onChange: () => void) => audio?.subscribe(onChange) ?? (() => {}),
    [audio],
  );
  const snapshot = useCallback(() => select(audio?.playing() ?? null), [audio, select]);

  return useSyncExternalStore(subscribe, snapshot);
}

/** Everything that is known about what is speaking, or `null` for silence. */
export function usePlayback(): PlaybackState | null {
  return usePlaybackValue(identity);
}

const identity = (state: PlaybackState | null) => state;

/** Whether this item is the one being spoken. */
export function useIsSpeaking(item: LearningItem): boolean {
  return usePlaybackValue(useCallback((state) => isSpeaking(state, item), [item]));
}

/**
 * The token the voice has reached in this item, where the engine says. Mostly
 * `undefined`, and a caller must read it that way: several engines report no
 * word boundaries at all, and the line-level state is what carries "playing".
 */
export function useSpeakingToken(item: LearningItem): TokenId | undefined {
  return usePlaybackValue(useCallback((state) => speakingToken(state, item), [item]));
}

/**
 * A run of items — a passage, one side of a conversation — played end to end,
 * with the transport a learner needs to live inside one: hold it, drop it, take
 * one line out of it, or carry on from a line they picked.
 */
export interface Sequence {
  /** Nothing playing, this run playing, or this run held where it is. */
  readonly status: 'idle' | 'playing' | 'paused';
  /** Which item is speaking, counted from 1. `0` when this run is not. */
  readonly position: number;
  readonly total: number;
  /** Whether any of it can be heard on this device at all. */
  readonly available: boolean;
  /** Read the whole thing from the top. */
  play(): void;
  pause(): void;
  resume(): void;
  stop(): void;
  /**
   * What one line's own play button does, and it is three things: that line
   * alone when nothing is being read, **stop** while that line is the one
   * speaking, and "carry on from here" for any other line while something is.
   *
   * One control with a meaning that follows the state, rather than three
   * controls on every line of a twenty-line passage. `Transcript` names the
   * button for whichever meaning is live, so the difference is in the accessible
   * name and not only in the context.
   *
   * Stop is the one that had to be added rather than designed: the button
   * replaces its icon with moving bars while its line is read, and the control a
   * learner reaches for when a voice is talking is the one that started it.
   * Pressing it played the line again, which is the opposite of what a button
   * showing "this is speaking" offers.
   */
  listen(item: LearningItem): void;
}

export function useSequence(items: readonly LearningItem[]): Sequence {
  // `useServices` rather than the tolerant read above: a transport is a control,
  // and a control with nothing behind it has no honest shape to render.
  const { services } = useServices();
  const { audio } = services;
  const locale = usePronunciationLocale();
  const state = usePlayback();

  const voice = useVoiceName();
  const options = { locale, ...(voice ? { voice } : {}) };

  const mine = state !== null && items.some((item) => isSpeaking(state, item));
  // A queue is what makes a line's play button mean "from here" and what the
  // position readout counts against; one sentence played on its own is not one.
  const queued = mine && state.total > 1;

  return {
    status: mine ? (state.paused ? 'paused' : 'playing') : 'idle',
    position: queued ? state.index + 1 : 0,
    total: items.length,
    available: items.some((item) => audio.canPlay(item, locale)),
    play: () => void audio.playAll(items, options),
    pause: () => audio.pause(),
    resume: () => audio.resume(),
    stop: () => audio.stop(),
    listen: (item) => {
      /*
       * Speaking, so this is the stop button — see {@link Sequence.listen}.
       *
       * Only while it is actually speaking: held on this line, the bars are
       * still and "carry on from here" is both the honest offer and what the
       * name says, so the paused case falls through to the queue below.
       */
      if (state !== null && !state.paused && isSpeaking(state, item)) {
        audio.stop();
        return;
      }
      if (queued) void audio.playAll(items, { ...options, startAt: item.id });
      else void audio.play(item, options);
    },
  };
}
