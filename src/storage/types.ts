/**
 * Persistence contracts (spec §23). Learner state is local-first: no account,
 * no backend. A future `SyncProvider` implements these same interfaces on top
 * of a remote store without the app noticing.
 */

import type { ItemId, LanguageTag } from '../domain/content';
import type { Attempt, ItemProgress } from '../domain/progress';
import type { SessionRecord } from '../domain/sessions';
import type { ThemePreference } from '../styles/themes';

export interface Preferences {
  readonly targetLanguage: LanguageTag;
  readonly referenceLanguage: LanguageTag;
  readonly pronunciationLocale: LanguageTag;
  /** Chosen speech voice name; empty means "pick the best match automatically". */
  readonly voiceName: string;
  readonly autoPlayAudio: boolean;
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
