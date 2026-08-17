/**
 * A session is a plan, not a stored exercise list (spec §5).
 * It says *what* to practise, in what order, for how long — the exercise
 * engine then derives each interaction as the learner reaches it.
 */

import type { ItemFilter, ItemId, LanguageTag } from '../content';
import type { ExerciseKind } from '../exercises/types';
import type { Timestamp } from '../progress/types';

export const SESSION_MODES = ['study', 'practice'] as const;
/** `study` browses freely; `practice` runs a generated, tracked set (spec §4.2). */
export type SessionMode = (typeof SESSION_MODES)[number];

export const ORDERINGS = ['sequential', 'random', 'smart'] as const;
export type Ordering = (typeof ORDERINGS)[number];

export type SessionSize =
  | { readonly kind: 'items'; readonly count: number }
  | { readonly kind: 'time'; readonly minutes: number }
  | { readonly kind: 'all' };

export interface SessionConfig {
  readonly mode: SessionMode;
  readonly filter: ItemFilter;
  readonly size: SessionSize;
  readonly ordering: Ordering;
  /** Preference order; the first kind an item supports is used. */
  readonly exerciseKinds: readonly ExerciseKind[];
  readonly referenceLanguage: LanguageTag;
  readonly pronunciationLocale: LanguageTag;
  /** Practice only items that are due for review. */
  readonly dueOnly?: boolean;
  /** Cap on unseen items mixed into a smart session. */
  readonly maxNewItems?: number;
  /** Set for reproducible sessions (tests, shared links). */
  readonly seed?: number;
}

export interface SessionPlan {
  readonly id: string;
  readonly config: SessionConfig;
  readonly itemIds: readonly ItemId[];
  readonly createdAt: Timestamp;
  /** Soft target for time-based sessions; the UI stops when it elapses. */
  readonly targetDurationMs?: number;
}

export interface SessionRecord {
  readonly id: string;
  readonly startedAt: Timestamp;
  readonly endedAt?: Timestamp;
  readonly planned: number;
  readonly completed: number;
  readonly correct: number;
}

export const DEFAULT_ITEM_COUNTS = [5, 10, 20] as const;
export const DEFAULT_SESSION_MINUTES = [2, 5, 10, 20] as const;

/** Rough pacing estimate used to size time-based sessions. */
export const ESTIMATED_MS_PER_ITEM = 12_000;
