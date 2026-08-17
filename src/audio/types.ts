/**
 * Audio and speech provider seams (spec §6, §22.1, Rule 8).
 *
 * The learning engine asks for "the audio for this item in this locale". How
 * that is produced — a pre-generated reviewed file, a device voice, a future
 * cloud TTS with a BYO key — is a provider concern. No vendor name appears
 * above this layer.
 */

import type { LanguageTag, LearningItem } from '../domain/content';

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

export interface PlaybackHandle {
  stop(): void;
  readonly done: Promise<void>;
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

/** What feature code uses. Resolves canonical audio, then falls back to TTS. */
export interface AudioService {
  play(item: LearningItem, options: PlayOptions): Promise<PlaybackHandle>;
  speak(request: SpeechRequest): Promise<PlaybackHandle>;
  stop(): void;
  /**
   * Whether this item can be heard: either the dataset ships audio for it, or
   * the device can speak the language.
   */
  canPlay(item: LearningItem, locale: LanguageTag): boolean;
  /** Whether the device can speak this language at all. */
  canSpeak(locale: LanguageTag): boolean;
  /** Voices available for the locale, for the settings picker. */
  voicesFor(locale: LanguageTag): readonly TtsVoice[];
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
 * Listens once and returns what it heard. Always optional: an exercise that
 * offers speech input must remain completable without it.
 */
export interface SpeechRecognitionProvider {
  readonly id: string;
  isAvailable(): boolean;
  supportsLanguage(locale: LanguageTag): boolean;
  listen(locale: LanguageTag): Promise<SpeechResult>;
  stop(): void;
}

export const NOOP_PLAYBACK: PlaybackHandle = { stop: () => {}, done: Promise.resolve() };
