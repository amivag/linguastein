/**
 * Composition root. Every concrete implementation — dataset source, storage,
 * TTS provider — is chosen exactly once, here. Feature code depends on
 * interfaces, so vendors and formats stay swappable (Rules 7 & 8).
 */

import {
  createAudioService,
  createWebMicrophoneLevels,
  createWebSpeechRecognitionProvider,
  createWebSpeechTtsProvider,
  type AudioService,
  type SpeechRecognitionProvider,
} from '../audio';
import { httpDatasetSource, loadCatalog, loadPacks } from '../data/loaders';
import type { ValidationIssue } from '../data/validation';
import type { BatchDefinition } from '../domain/batches';
import { ContentRepository } from '../domain/content';
import { ExerciseEngine } from '../domain/exercises';
import { createStorage } from '../storage';
import type { LearnerStorage, Preferences } from '../storage';

export interface AppServices {
  readonly repository: ContentRepository;
  readonly storage: LearnerStorage;
  readonly audio: AudioService;
  /** Optional speech input; absent where the browser cannot listen. */
  readonly speech: SpeechRecognitionProvider;
  readonly exercises: ExerciseEngine;
  readonly preferences: Preferences;
  /**
   * The learner's batches, read once at boot like `preferences` above.
   *
   * Read eagerly rather than per screen because `SessionScreen` builds its
   * config in a synchronous `useMemo` over the URL — that is deliberate, since
   * the query string is the only thing a session depends on — so a `?batch=`
   * that needed an `await` to resolve would mean rebuilding that screen around a
   * loading state. There are a handful of these records and they are tiny, which
   * is exactly the case where preferences' pattern beats progress's.
   */
  readonly batches: readonly BatchDefinition[];
  /** Non-fatal dataset problems, surfaced in Settings rather than swallowed. */
  readonly datasetIssues: readonly ValidationIssue[];
}

export interface CreateServicesOptions {
  /** Where packs are served from; relative to the app origin. */
  readonly datasetBaseUrl?: string;
}

export async function createServices(options: CreateServicesOptions = {}): Promise<AppServices> {
  const datasetBaseUrl = options.datasetBaseUrl ?? `${import.meta.env.BASE_URL}packs/`;
  const source = httpDatasetSource(datasetBaseUrl);

  const catalog = await loadCatalog(source);
  const { packs, issues } = await loadPacks(
    source,
    catalog.packs.map((entry) => entry.manifest),
  );

  const repository = ContentRepository.from(packs);
  const storage = await createStorage();
  const [preferences, batches] = await Promise.all([
    storage.preferences.read(),
    storage.batches.all(),
  ]);

  const audio = createAudioService({
    repository,
    assetBaseUrl: new URL(datasetBaseUrl, location.origin).toString(),
    tts: createWebSpeechTtsProvider(),
  });

  return {
    repository,
    storage,
    audio,
    /*
     * The microphone is handed to the recogniser rather than kept beside it:
     * one listen, one device, opened and released together. It is what makes
     * the browser ask for the permission — Android does not always ask on the
     * recogniser's behalf — and what the level meter reads while listening.
     */
    speech: createWebSpeechRecognitionProvider({ microphone: createWebMicrophoneLevels() }),
    exercises: new ExerciseEngine(),
    preferences,
    batches,
    datasetIssues: issues,
  };
}
