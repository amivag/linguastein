/**
 * Composition root. Every concrete implementation — dataset source, storage,
 * TTS provider — is chosen exactly once, here. Feature code depends on
 * interfaces, so vendors and formats stay swappable (Rules 7 & 8).
 */

import { createAudioService, createWebSpeechTtsProvider, type AudioService } from '../audio';
import { httpDatasetSource, loadCatalog, loadPacks } from '../data/loaders';
import type { ValidationIssue } from '../data/validation';
import { ContentRepository } from '../domain/content';
import { ExerciseEngine } from '../domain/exercises';
import { createStorage } from '../storage';
import type { LearnerStorage, Preferences } from '../storage';

export interface AppServices {
  readonly repository: ContentRepository;
  readonly storage: LearnerStorage;
  readonly audio: AudioService;
  readonly exercises: ExerciseEngine;
  readonly preferences: Preferences;
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
  const preferences = await storage.preferences.read();

  const audio = createAudioService({
    repository,
    assetBaseUrl: new URL(datasetBaseUrl, location.origin).toString(),
    tts: createWebSpeechTtsProvider(),
  });

  return {
    repository,
    storage,
    audio,
    exercises: new ExerciseEngine(),
    preferences,
    datasetIssues: issues,
  };
}
