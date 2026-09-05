/**
 * Persistence contracts (spec §23). Learner state is local-first: no account,
 * no backend. A future `SyncProvider` implements these same interfaces on top
 * of a remote store without the app noticing.
 */

import type { BatchDefinition } from '../domain/batches';
import type { ItemId, LanguageTag, LevelScope, SpeakerGender } from '../domain/content';
import type { Attempt, ItemProgress } from '../domain/progress';
import type { SessionFocus, SessionRecord } from '../domain/sessions';
import type { PaletteId, ThemePreference } from '../styles/themes';
import type { ContrastLevel } from '../styles/contrast';
import type { Intensity } from '../styles/intensity';
import type { ReadingSize } from '../styles/reading-size';

export interface Preferences {
  /**
   * What the learner would like to be called. Empty means they have not said,
   * and nothing addresses them by name until they do.
   *
   * Stored beside the settings rather than in a record of its own because that
   * is what it is today: one string on one device, with no account behind it.
   * When there is an account (`docs/tasks/accounts-and-sync.md`) this is the
   * field that stops being local, which is why the User screen says so plainly
   * rather than implying a profile that does not exist.
   */
  readonly displayName: string;
  /**
   * The gender the learner speaks about themselves in, or empty for unsaid.
   *
   * Not a demographic: it is grammar. Spanish makes you commit to it in order to
   * say `Estoy cansado`, and a learner taught the other form is being taught to
   * say something untrue about themselves. Empty is a real answer and the
   * default — both forms are then offered, exactly as before this existed.
   *
   * It reaches content through `courseFilter`, never through a component: see
   * `SpeakerGender` in `domain/content/model.ts`.
   */
  readonly speakerGender: SpeakerGender | '';
  /**
   * Which course `/` reopens. The pointer, and nothing else.
   *
   * What is being learned *now* comes from the path — `/es/a1/browse` says so —
   * and this is only where the app looks when the address names no course. The
   * level that goes with it is per course and lives in {@link CourseState}: one
   * global level could not hold Spanish-at-A2 and French-at-A1 at the same time,
   * which is the whole of Stage A.
   */
  readonly targetLanguage: LanguageTag;
  readonly referenceLanguage: LanguageTag;
  readonly autoPlayAudio: boolean;
  /**
   * Whether a session shows how long it has been running. On by default: it
   * answers a question learners have and imposes nothing — there is no limit and
   * no penalty — but a visible clock is a distraction for some people, so it is
   * theirs to switch off.
   */
  readonly showTimer: boolean;
  readonly slowAudio: boolean;
  /*
   * `showRomanisationHints` was here, defaulted, and read by nothing. It is
   * gone rather than kept for a language that might want it, because this
   * record is about to become a file format (see docs/tasks/learner-profile.md
   * §7) and a dead field in an export is a field every future reader has to
   * decide what to do with.
   *
   * It also belonged somewhere else. Romanisation is a property of a *script*,
   * so the setting is per course rather than per device — romaji is not a
   * Spanish problem — and the place for it is the `CourseState` that task's
   * Stage A introduces. Add it there, when a pack needs it.
   */
  readonly theme: ThemePreference;
  /**
   * Which set of hues the chosen theme is drawn with.
   *
   * A separate axis from light/dark on purpose: a learner keeps their palette
   * when the OS flips to dark, and a palette added later needs no new
   * preference. See docs/theming.md.
   */
  readonly palette: PaletteId;
  /** How far apart the palette's neutrals sit. Never below WCAG AA. */
  readonly contrast: ContrastLevel;
  /**
   * How loud the palette's hues are. The mirror of `contrast`, which moves the
   * neutrals: a learner who wants the colour-coding quieter should not have to
   * give up legibility to get it, and vice versa.
   */
  readonly intensity: Intensity;
  /** Global type scale, deliberately independent of palette and contrast. */
  readonly readingSize: ReadingSize;
}

/**
 * What a learner has chosen *about one course*, keyed by its target language.
 *
 * These five lived in {@link Preferences} as single global values, which was
 * correct while there was one course and quietly wrong the moment a second pack
 * could load. Two of the five say so plainly: Spanish-at-A2 and French-at-A1
 * cannot both be true of one `level`, and a voice that can read Spanish cannot
 * read French — one global `voiceName` is how a French course came to be spoken
 * by a Spanish voice.
 *
 * Keyed by *language* rather than by course, because a level is a ceiling rather
 * than a chapter: moving from A1 to A2 does not start a new set of choices, it
 * widens the same one. `docs/tasks/learner-profile.md` §5.1.
 */
export interface CourseState {
  /**
   * How far up the course the learner is working, as a ceiling rather than a
   * partition: `a2` includes A1 content. Remembered so `/` can reopen the
   * course they left, which is the only reason it is stored — the URL is the
   * source of truth once a screen is open.
   */
  readonly level: LevelScope;
  /**
   * Categories the learner wants to practise, or empty for everything.
   *
   * A standing choice rather than a per-session one: "I am working on food and
   * travel" stays true across sessions, and having to re-pick it before every
   * Quick session is how a preference that exists goes unused. It is written
   * into the session link all the same, so a session remains fully described by
   * its URL.
   *
   * Per course because a topic slug is *pack vocabulary*: `food-drink` means
   * nothing to a French pack, and a stored list from another language is how a
   * session came to be planned over a category with no content in it.
   */
  readonly focusTopics: readonly string[];
  /**
   * Which items a session leads with. A bias, never a filter.
   *
   * The one of the five that could defensibly have stayed global — it biases the
   * planner's buckets rather than naming any content. It is here because it is
   * read beside `focusTopics` at every site, and a picker that writes one record
   * is simpler to reason about than one that writes two.
   */
  readonly focus: SessionFocus;
  /**
   * The accent this language is spoken in — `es-MX` — never a bare language.
   *
   * Read through `usePronunciationLocale`, which narrows it to the open course
   * at every read rather than trusting the write: a shared link or a reload
   * lands in a course without passing through the switcher that would have
   * corrected it.
   */
  readonly pronunciationLocale: LanguageTag;
  /** Chosen speech voice name; empty means "pick the best match automatically". */
  readonly voiceName: string;
}

/**
 * Every course the learner has touched, by target language.
 *
 * A record rather than a list so a language is one lookup, and absent rather
 * than pre-populated: a course nobody has opened has no stored choices, and
 * {@link DEFAULT_COURSE_STATE} is what it reads as until it does.
 */
export type CourseStates = Readonly<Record<string, CourseState>>;

export interface ProgressStore {
  get(itemId: ItemId): Promise<ItemProgress | undefined>;
  /**
   * How many rows this store holds.
   *
   * Its own method rather than `(await all()).length`, because the User screen
   * reports the size of what is on the device and the attempt log is unbounded
   * and unpruned (`docs/tasks/learner-profile.md` §9.3). Reading every row to
   * count it would make the honest answer the expensive one, and IndexedDB
   * counts without materialising anything.
   */
  count(): Promise<number>;
  getMany(itemIds: readonly ItemId[]): Promise<ReadonlyMap<ItemId, ItemProgress>>;
  all(): Promise<readonly ItemProgress[]>;
  put(progress: ItemProgress): Promise<void>;
  /**
   * Many rows, one transaction.
   *
   * Not an optimisation of `put` in a loop but a different guarantee: an import
   * writes a year of history, and `put` per row is a transaction per row, so a
   * tab closed halfway leaves the store holding an arbitrary prefix of a file.
   * All three history stores carry one for the same reason — see
   * `docs/tasks/learner-profile.md` §7.3, which named the first two.
   */
  putMany(rows: readonly ItemProgress[]): Promise<void>;
  clear(): Promise<void>;
}

export interface AttemptStore {
  append(attempt: Attempt): Promise<void>;
  /** See {@link ProgressStore.putMany}. Idempotent: an attempt id is unique. */
  appendMany(attempts: readonly Attempt[]): Promise<void>;
  count(): Promise<number>;
  recent(limit: number): Promise<readonly Attempt[]>;
  forItem(itemId: ItemId, limit?: number): Promise<readonly Attempt[]>;
  /**
   * Every attempt, oldest first.
   *
   * `recent(Number.MAX_SAFE_INTEGER)` would answer the same question and reads
   * the whole table into memory to reverse it. The two callers that want the
   * *whole* log — an export, and a replay that rebuilds a projection — both want
   * it in the order it happened.
   */
  all(): Promise<readonly Attempt[]>;
  clear(): Promise<void>;
}

export interface SessionStore {
  put(record: SessionRecord): Promise<void>;
  /** See {@link ProgressStore.putMany}. */
  putMany(records: readonly SessionRecord[]): Promise<void>;
  /** Every session, for an export. `recent` is the paged read screens use. */
  all(): Promise<readonly SessionRecord[]>;
  count(): Promise<number>;
  /**
   * The newest sessions, optionally only those of one target language.
   *
   * Language rather than course: a level is a ceiling, so a session practised at
   * A1 is part of the history an A2 learner is looking at. Narrowing happens
   * here rather than after the call because filtering a page of five would
   * return fewer than five.
   */
  recent(limit: number, language?: LanguageTag): Promise<readonly SessionRecord[]>;
  clear(): Promise<void>;
}

/**
 * Batches the learner has assembled.
 *
 * The one store here holding something a learner *authored* rather than
 * something they did: the other three are history, and preferences are
 * settings. There is no `recent(limit)` because there is nothing to page —
 * a batch is a deliberate act, so there are a handful of them, and the
 * listing narrows by language in memory.
 */
export interface BatchStore {
  all(): Promise<readonly BatchDefinition[]>;
  put(batch: BatchDefinition): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

export interface PreferencesStore {
  read(): Promise<Preferences>;
  write(preferences: Partial<Preferences>): Promise<Preferences>;
}

/**
 * The per-course half of the settings, read whole and written one course at a
 * time.
 *
 * `read()` returns every course rather than the open one, because the app holds
 * them all in memory: `/` has to answer "which course, at which level" before
 * any course is open, and switching language must not await a read. `write`
 * takes the language it applies to for the same reason `updatePreferences` takes
 * a patch — the caller knows which course it is changing, and a store that
 * inferred it would have to be told what "current" means.
 */
export interface CourseStateStore {
  read(): Promise<CourseStates>;
  write(language: LanguageTag, patch: Partial<CourseState>): Promise<CourseStates>;
}

/** Everything the app persists, resolved once at the composition root. */
export interface LearnerStorage {
  readonly progress: ProgressStore;
  readonly attempts: AttemptStore;
  readonly sessions: SessionStore;
  readonly batches: BatchStore;
  readonly preferences: PreferencesStore;
  readonly courses: CourseStateStore;
  /**
   * Wipes all learner data, preferences and batches included. Settings uses this
   * for a clean local reset; its narrower "reset progress" action clears the
   * three history stores by hand so a learner can keep their voice and
   * appearance choices — and, deliberately, their batches: a batch is material
   * they chose, not evidence of what they did with it, so resetting progress
   * hands back the same sets to start again on.
   */
  clearAll(): Promise<void>;
}
