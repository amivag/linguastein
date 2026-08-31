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
import {
  httpDatasetSource,
  loadCatalog,
  loadPacks,
  loadTranslationUnit,
  translationUnitFor,
  type LoadedTranslations,
} from '../data/loaders';
import type { ValidationIssue } from '../data/validation';
import type { BatchDefinition } from '../domain/batches';
import { ContentRepository, DEFAULT_REFERENCE_LANGUAGE, parseCoursePath } from '../domain/content';
import { createContentLoading, type ContentLoading } from './content';
import { createOfflinePacks, type OfflinePacks } from './offline';
import { standaloneLetters } from '../languages/runtime';
import { ExerciseEngine } from '../domain/exercises';
import { courseStateOf, createStorage } from '../storage';
import type { CourseStates, LearnerStorage, Preferences } from '../storage';

export interface AppServices {
  readonly repository: ContentRepository;
  /**
   * The rest of the pack, for when the learner wants it.
   *
   * The repository holds what this course reads; this is how it grows
   * (`docs/tasks/shard-loading.md`).
   */
  readonly content: ContentLoading;
  /**
   * What this device is keeping, and the control for changing it.
   *
   * The pair to `content` above and deliberately not the same thing: that one is
   * what the repository holds, this one is what survives a flight-mode
   * (`docs/tasks/language-matrix.md` §5).
   */
  readonly offline: OfflinePacks;
  readonly storage: LearnerStorage;
  readonly audio: AudioService;
  /** Optional speech input; absent where the browser cannot listen. */
  readonly speech: SpeechRecognitionProvider;
  readonly exercises: ExerciseEngine;
  readonly preferences: Preferences;
  /**
   * Every course's own choices, as they stood at boot.
   *
   * Beside `preferences` rather than inside it, because the five fields here are
   * properties of a course rather than of the device
   * (`docs/tasks/learner-profile.md` §5.1). Read whole: `/` has to answer "which
   * course, at which level" before any course is open.
   */
  readonly courses: CourseStates;
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
  const [preferences, courses, batches] = await Promise.all([
    storage.preferences.read(),
    storage.courses.read(),
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
    { upTo: level ?? courseStateOf(courses, preferences.targetLanguage).level },
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

  /*
   * The meanings, in one language rather than in all of them.
   *
   * Translations left the pack and became their own addressed, independently
   * versioned unit (`docs/tasks/language-matrix.md` §3), which is what makes
   * this a choice at all: the pack no longer carries every reference language it
   * has ever been explained in, so boot fetches the one the learner reads and
   * `content.ensureReference` fetches another if they change their mind.
   *
   * English as the fallback, not as an addition. `referenceLanguageChain` ends
   * there, so a learner whose language nothing has been translated into yet sees
   * English rather than bare Spanish — and fetching both when the preference
   * *is* supplied would download a language nothing will read.
   */
  const published = (language: string) =>
    catalog.translations?.some((entry) => entry.language === language) ?? false;
  const references = published(preferences.referenceLanguage)
    ? [preferences.referenceLanguage]
    : [DEFAULT_REFERENCE_LANGUAGE];

  const units: LoadedTranslations[] = [];
  for (const language of references) {
    for (const entry of loaded) {
      const path = translationUnitFor(catalog, entry.pack.manifest.id, language);
      if (!path) continue;
      const unit = await loadTranslationUnit(source, path);
      repository.addTranslations(unit.translations);
      units.push(unit);
    }
  }

  const content = createContentLoading({
    source,
    repository,
    loaded,
    catalog,
    translations: units,
  });
  const assetBaseUrl = new URL(datasetBaseUrl, location.origin).toString();
  const offline = createOfflinePacks({
    packs: loaded,
    // Asked each time rather than handed over, so a reference language chosen
    // after boot is priced with the pack it explains.
    translations: () => content.translationUnits(),
    baseUrl: assetBaseUrl,
  });

  const audio = createAudioService({
    repository,
    assetBaseUrl,
    tts: createWebSpeechTtsProvider(),
  });

  return {
    repository,
    content,
    offline,
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
    courses,
    batches,
    datasetIssues: [...issues, ...units.flatMap((unit) => unit.issues)],
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
