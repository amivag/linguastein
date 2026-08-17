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
  readonly voice?: string;
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
}

export interface PlayOptions {
  readonly locale: LanguageTag;
  readonly rate?: number;
  /** Repeat count for the "loop ×3" control. */
  readonly repeat?: number;
}

/** What feature code uses. Resolves canonical audio, then falls back to TTS. */
export interface AudioService {
  play(item: LearningItem, options: PlayOptions): Promise<PlaybackHandle>;
  speak(request: SpeechRequest): Promise<PlaybackHandle>;
  stop(): void;
  /** Whether anything at all can be heard right now. */
  isAvailable(locale: LanguageTag): boolean;
}

// Reserved for later; declared here so the shape of the seam is visible.

export interface SpeechRecognitionProvider {
  readonly id: string;
  isAvailable(): boolean;
  listen(locale: LanguageTag): Promise<{ transcript: string; confidence: number }>;
}

export const NOOP_PLAYBACK: PlaybackHandle = { stop: () => {}, done: Promise.resolve() };
