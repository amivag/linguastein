/**
 * Persistence contracts (spec §23). Learner state is local-first: no account,
 * no backend. A future `SyncProvider` implements these same interfaces on top
 * of a remote store without the app noticing.
 */

import type { ItemId, LanguageTag, LevelScope } from '../domain/content';
import type { Attempt, ItemProgress } from '../domain/progress';
import type { SessionFocus, SessionRecord } from '../domain/sessions';
import type { ThemePreference } from '../styles/themes';

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
  readonly showRomanisationHints: boolean;
  readonly theme: ThemePreference;
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
  recent(limit: number): Promise<readonly SessionRecord[]>;
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
  readonly preferences: PreferencesStore;
  /** Wipes all learner data — used by "reset progress" and by tests. */
  clearAll(): Promise<void>;
}
