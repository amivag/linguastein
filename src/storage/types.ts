/**
 * Persistence contracts (spec §23). Learner state is local-first: no account,
 * no backend. A future `SyncProvider` implements these same interfaces on top
 * of a remote store without the app noticing.
 */

import type { BatchDefinition } from '../domain/batches';
import type { ItemId, LanguageTag, LevelScope } from '../domain/content';
import type { Attempt, ItemProgress } from '../domain/progress';
import type { SessionFocus, SessionRecord } from '../domain/sessions';
import type { PaletteId, ThemePreference } from '../styles/themes';
import type { ContrastLevel } from '../styles/contrast';
import type { Intensity } from '../styles/intensity';
import type { ReadingSize } from '../styles/reading-size';

export interface Preferences {
  /** What is being learned. With the level below it, this is the current course. */
  readonly targetLanguage: LanguageTag;
  /**
   * How far up the course the learner is working, as a ceiling rather than a
   * partition: `a2` includes A1 content. Remembered so `/` can reopen the
   * course they left, which is the only reason it is stored — the URL is the
   * source of truth once a screen is open.
   */
  readonly level: LevelScope;
  readonly referenceLanguage: LanguageTag;
  /**
   * Categories the learner wants to practise, or empty for everything.
   *
   * A standing choice rather than a per-session one: "I am working on food and
   * travel" stays true across sessions, and having to re-pick it before every
   * Quick session is how a preference that exists goes unused. It is written
   * into the session link all the same, so a session remains fully described by
   * its URL.
   */
  readonly focusTopics: readonly string[];
  /** Which items a session leads with. A bias, never a filter. */
  readonly focus: SessionFocus;
  readonly pronunciationLocale: LanguageTag;
  /** Chosen speech voice name; empty means "pick the best match automatically". */
  readonly voiceName: string;
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

export interface ProgressStore {
  get(itemId: ItemId): Promise<ItemProgress | undefined>;
  getMany(itemIds: readonly ItemId[]): Promise<ReadonlyMap<ItemId, ItemProgress>>;
  all(): Promise<readonly ItemProgress[]>;
  put(progress: ItemProgress): Promise<void>;
  clear(): Promise<void>;
}

export interface AttemptStore {
  append(attempt: Attempt): Promise<void>;
  recent(limit: number): Promise<readonly Attempt[]>;
  forItem(itemId: ItemId, limit?: number): Promise<readonly Attempt[]>;
  clear(): Promise<void>;
}

export interface SessionStore {
  put(record: SessionRecord): Promise<void>;
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

/** Everything the app persists, resolved once at the composition root. */
export interface LearnerStorage {
  readonly progress: ProgressStore;
  readonly attempts: AttemptStore;
  readonly sessions: SessionStore;
  readonly batches: BatchStore;
  readonly preferences: PreferencesStore;
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
