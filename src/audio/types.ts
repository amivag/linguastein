/**
 * Audio and speech provider seams (spec §6, §22.1, Rule 8).
 *
 * The learning engine asks for "the audio for this item in this locale". How
 * that is produced — a pre-generated reviewed file, a device voice, a future
 * cloud TTS with a BYO key — is a provider concern. No vendor name appears
 * above this layer.
 */

import type { ItemId, LanguageTag, LearningItem } from '../domain/content';

export interface SpeechRequest {
  readonly text: string;
  readonly locale: LanguageTag;
  /** 1 = normal, 0.7 ≈ the "slow" control. */
  readonly rate?: number;
  readonly voice?: string | undefined;
}

/** A voice offered to the learner, described without any vendor's types. */
export interface TtsVoice {
  readonly name: string;
  readonly locale: LanguageTag;
  readonly isDefault: boolean;
}

/**
 * A character range within the text being spoken.
 *
 * Character offsets rather than a token id, because a provider knows the string
 * it was handed and nothing else — mapping them onto tokens is `deriveTokenSpans`'
 * job at render time (Rule 3), and keeping the seam in characters is what stops a
 * vendor's event shape from reaching the UI (Rule 5).
 */
export interface SpeechSpan {
  readonly start: number;
  readonly end: number;
}

export interface PlaybackHandle {
  stop(): void;
  /**
   * Holds the audio where it is, and picks it up again. Optional because a
   * source may not be able to: a caller asks {@link AudioService.canPause}
   * rather than offering a control that does nothing.
   */
  pause?(): void;
  resume?(): void;
  readonly done: Promise<void>;
  /**
   * Where in the text the voice has reached, word by word, for sources that can
   * say. Returns an unsubscribe. Absent — or simply silent — means the engine
   * does not report boundaries, which several do not: a caller must degrade to
   * "this phrase is playing" rather than assume the highlight will arrive.
   */
  onProgress?(listener: (span: SpeechSpan) => void): () => void;
}

/** Produces speech for arbitrary text. Optional: canonical audio comes first. */
export interface TtsProvider {
  readonly id: string;
  isAvailable(): boolean;
  speak(request: SpeechRequest): Promise<PlaybackHandle>;
  /** Resolves once the provider knows which voices it has. */
  ready?(): Promise<void>;
  /** Voices able to speak this language. Empty means: do not speak it. */
  voicesFor?(locale: LanguageTag): readonly TtsVoice[];
  /**
   * The voice a `speak` with these arguments would actually use, so the UI can
   * name it rather than promising an unspecified "best match".
   */
  voiceFor?(locale: LanguageTag, preferred?: string): TtsVoice | undefined;
  hasVoiceFor?(locale: LanguageTag): boolean;
}

export interface PlayOptions {
  readonly locale: LanguageTag;
  readonly rate?: number;
  /** Repeat count for the "loop ×3" control. */
  readonly repeat?: number;
  /** Learner-chosen voice name; falls back to the best automatic match. */
  readonly voice?: string | undefined;
}

export interface SequenceOptions extends PlayOptions {
  /**
   * Where to begin, as the item to begin at rather than as an index: a passage
   * hands over the sentences it is showing, and "start here" is a thing a
   * learner points at, not a number. An id that is not in the list — or none at
   * all — starts from the beginning.
   */
  readonly startAt?: ItemId | undefined;
}

/**
 * What is being spoken right now, or `null` between plays.
 *
 * One object for the whole app rather than a boolean per button: the service
 * plays one thing at a time and stops whatever was playing before, so playback
 * state kept per screen would leave a row in Browse lit while a different row is
 * actually speaking. Identity is deliberately loose — an id when an item started
 * it, otherwise the text — because half the callers speak a string that belongs
 * to no item (a response palette, a variation, a voice sample).
 */
export interface PlaybackState {
  /** The item speaking, when an item started this. */
  readonly itemId?: ItemId;
  /** The text being spoken, so {@link span} maps onto what is on screen. */
  readonly text: string;
  /** The word being spoken, where the engine reports word boundaries. */
  readonly span?: SpeechSpan;
  /** Position within the queue and its length: sentence 3 of 12 in a passage. */
  readonly index: number;
  readonly total: number;
  readonly paused: boolean;
}

/** What feature code uses. Resolves canonical audio, then falls back to TTS. */
export interface AudioService {
  play(item: LearningItem, options: PlayOptions): Promise<PlaybackHandle>;
  /**
   * Plays several items in order — a passage read end to end, a conversation
   * heard through (spec §6.1).
   *
   * One item at a time rather than one utterance of joined text, which is what
   * this replaced. Joining loses every position: nothing can say which sentence
   * is speaking, nothing can start from the third one, and a long enough string
   * runs into the engine's own limits.
   */
  playAll(items: readonly LearningItem[], options: SequenceOptions): Promise<PlaybackHandle>;
  speak(request: SpeechRequest): Promise<PlaybackHandle>;
  stop(): void;
  /** Holds playback where it is; `resume` picks it up. Both are no-ops if idle. */
  pause(): void;
  resume(): void;
  /** Whether the source now playing can be held at all. False when nothing is. */
  canPause(): boolean;
  /**
   * What is speaking now. The same object identity until it changes, so it can
   * be read through `useSyncExternalStore` without re-rendering every frame.
   */
  playing(): PlaybackState | null;
  /** Notifies on every change to {@link playing}. Returns an unsubscribe. */
  subscribe(listener: (state: PlaybackState | null) => void): () => void;
  /**
   * Whether this item can be heard: either the dataset ships audio for it, or
   * the device can speak the language.
   */
  canPlay(item: LearningItem, locale: LanguageTag): boolean;
  /** Whether the device can speak this language at all. */
  canSpeak(locale: LanguageTag): boolean;
  /** Voices available for the locale, for the settings picker. */
  voicesFor(locale: LanguageTag): readonly TtsVoice[];
  /** Which of them would speak, given the learner's choice (or none). */
  voiceFor(locale: LanguageTag, preferred?: string): TtsVoice | undefined;
  /** Resolves once voice discovery has finished. */
  ready(): Promise<void>;
}

export interface SpeechResult {
  readonly transcript: string;
  /** 0–1 where the recogniser reports it; some engines always return 0. */
  readonly confidence: number;
  /** Other readings the recogniser considered, best first. */
  readonly alternatives?: readonly string[];
}

/**
 * Rejection reason for a listen the caller ended through `stop`. Distinct from
 * the recogniser's own reasons so a UI can tell "the learner changed their
 * mind" from "the microphone heard nothing", and stay quiet about the first.
 */
export const SPEECH_ABORTED = 'aborted';

/**
 * A page served over plain HTTP has no microphone: `getUserMedia` is not even
 * defined and the recogniser is refused. Its own reason, because the browser
 * reports it only to the console, and to a learner it is indistinguishable
 * from a permission they denied.
 */
export const SPEECH_INSECURE_CONTEXT = 'insecure-context';

/**
 * The browser has no recogniser to start — Firefox today, and any engine that
 * ships without the Web Speech API. Named rather than spelled out at each throw
 * site, so the copy that explains it cannot drift from the string that causes it.
 */
export const SPEECH_UNAVAILABLE = 'speech recognition unavailable';

/**
 * The microphone is held by something else — another tab, another app, a call.
 * Common enough on a phone to be worth saying out loud, and not one of the Web
 * Speech reasons, which fold it into `audio-capture`.
 */
export const MICROPHONE_BUSY = 'microphone-busy';

/** An open microphone, until it is closed. Closing releases the device. */
export interface MicrophoneHandle {
  close(): void;
}

/**
 * The microphone as a level, not a recording (spec §6.2).
 *
 * Two things come out of one seam here, and only one of them is the meter:
 *
 * - **Feedback.** Recognition is a black box — press, speak, and a transcript
 *   either appears or does not. A live level is the only thing that tells a
 *   learner the device is hearing them at all.
 * - **Permission.** Opening the microphone this way is what makes a browser
 *   *ask*. A recogniser's own request does not always prompt, and one started
 *   without the permission ends immediately, which looks exactly like a
 *   feature that does not work.
 *
 * Nothing is recorded. Samples are read from an analyser and dropped a frame
 * later; no buffer outlives the listen.
 */
export interface MicrophoneLevels {
  readonly id: string;
  isAvailable(): boolean;
  /**
   * Opens the microphone and reports loudness, 0–1, until the handle closes.
   * Rejects with a Web Speech reason (`not-allowed`, `audio-capture`) or
   * `MICROPHONE_BUSY`, so one vocabulary of causes reaches the UI.
   */
  open(onLevel: (level: number) => void): Promise<MicrophoneHandle>;
}

/** What a caller wants to be told *during* a listen, rather than after it. */
export interface ListenOptions {
  /** Microphone loudness, 0–1, for a level meter. */
  readonly onLevel?: ((level: number) => void) | undefined;
  /** What the recogniser has heard so far, before it commits to a reading. */
  readonly onPartial?: ((text: string) => void) | undefined;
}

/**
 * Listens once and returns what it heard. Always optional: an exercise that
 * offers speech input must remain completable without it.
 */
export interface SpeechRecognitionProvider {
  readonly id: string;
  isAvailable(): boolean;
  supportsLanguage(locale: LanguageTag): boolean;
  listen(locale: LanguageTag, options?: ListenOptions): Promise<SpeechResult>;
  /**
   * Ends a listen in flight, rejecting its promise with `SPEECH_ABORTED`.
   * Whatever offers a listen must also offer this: a recogniser only ends
   * itself when it decides the speaker has finished, and it does not always
   * decide.
   */
  stop(): void;
}

export const NOOP_PLAYBACK: PlaybackHandle = { stop: () => {}, done: Promise.resolve() };
