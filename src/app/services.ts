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
import { ContentRepository, parseCoursePath } from '../domain/content';
import { createContentLoading, type ContentLoading } from './content';
import { standaloneLetters } from '../languages/runtime';
import { ExerciseEngine } from '../domain/exercises';
import { createStorage } from '../storage';
import type { LearnerStorage, Preferences } from '../storage';

export interface AppServices {
  readonly repository: ContentRepository;
  /**
   * The rest of the pack, for when the learner wants it.
   *
   * The repository holds what this course reads; this is how it grows
   * (`docs/tasks/shard-loading.md`).
   */
  readonly content: ContentLoading;
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
  /**
   * The address the app is opening at, defaulting to the browser's.
   *
   * Read here, before the router exists, because the level in the path decides
   * which shards to fetch and the whole saving is in not fetching the others.
   * Injectable so the decision is testable without navigating a document.
   */
  readonly path?: string;
}

export async function createServices(options: CreateServicesOptions = {}): Promise<AppServices> {
  const datasetBaseUrl = options.datasetBaseUrl ?? `${import.meta.env.BASE_URL}packs/`;
  const source = httpDatasetSource(datasetBaseUrl);

  /*
   * The catalog and the learner's own storage in parallel, because the pack
   * fetch below now waits on both: the catalog for what to fetch, and the
   * preference for how much of it when the address does not say.
   */
  const [catalog, storage] = await Promise.all([loadCatalog(source), createStorage()]);
  const [preferences, batches] = await Promise.all([
    storage.preferences.read(),
    storage.batches.all(),
  ]);

  /*
   * How far up the levels to fetch: what the address asks for, or where the
   * learner left off.
   *
   * The preference is not a guess at the second one — `/` has no course of its
   * own and redirects to exactly this pair, so a learner opening the app from
   * their home screen lands on that course a moment later. Reading it here is
   * what keeps the commonest entry point from downloading the whole pack to show
   * an A1 screen. Neither says a level the packs have to offer; a ceiling nothing
   * declares widens to the whole pack rather than to nothing (`shardLevelsFor`).
   */
  const { level } = parseCoursePath(appPath(options.path ?? location.pathname));
  const { loaded, issues } = await loadPacks(
    source,
    catalog.packs.map((entry) => entry.manifest),
    { upTo: level ?? preferences.level },
  );

  /*
   * The one place the engine is told a language's letter rules, per rule 5 and
   * `docs/tasks/language-matrix.md` §6. `Ñ` used to be a literal inside
   * `alphabet.ts`, which is the language-neutral half of the domain.
   */
  const repository = ContentRepository.from(
    loaded.map((entry) => entry.pack),
    { standaloneLetters },
  );
  const content = createContentLoading({ source, repository, loaded });

  const audio = createAudioService({
    repository,
    assetBaseUrl: new URL(datasetBaseUrl, location.origin).toString(),
    tts: createWebSpeechTtsProvider(),
  });

  return {
    repository,
    content,
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

/**
 * A browser path with the app's base stripped off, so `/es/a1` reads the same
 * whether the app is served from the root or from a subdirectory.
 *
 * `BrowserRouter`'s `basename` does this for every screen; boot runs before the
 * router, so it does it once here. `BASE_URL` always ends in a slash, which is
 * the one carried through.
 */
function appPath(pathname: string): string {
  const base = import.meta.env.BASE_URL;
  return pathname.startsWith(base) ? `/${pathname.slice(base.length)}` : pathname;
}
