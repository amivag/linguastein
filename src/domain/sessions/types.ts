/**
 * A session is a plan, not a stored exercise list (spec §5).
 * It says *what* to practise, in what order, for how long — the exercise
 * engine then derives each interaction as the learner reaches it.
 */

import type { Course, ItemFilter, ItemId, LanguageTag } from '../content';
import type { ExerciseKind } from '../exercises/types';
import type { Timestamp } from '../progress/types';

export const SESSION_MODES = ['study', 'practice'] as const;
/** `study` browses freely; `practice` runs a generated, tracked set (spec §4.2). */
export type SessionMode = (typeof SESSION_MODES)[number];

export const ORDERINGS = ['sequential', 'random', 'smart'] as const;
export type Ordering = (typeof ORDERINGS)[number];

/**
 * Which of the things worth practising to reach for first.
 *
 * A bias, never a filter. A learner who says "the stuff I keep getting wrong"
 * has told you what to lead with, not what to refuse to show them — and a focus
 * that filtered would hand back an empty session on the good day when nothing
 * is struggling, which reads as a broken app rather than as praise.
 *
 * - `balanced`   — due, then weak, then a little new material (spec §5.2)
 * - `struggling` — the hardest first, worst first, and new material last
 * - `due`        — clear the review queue before anything else
 * - `fresh`      — new material first, and uncapped: it is what was asked for
 */
export const SESSION_FOCUSES = ['balanced', 'struggling', 'due', 'fresh'] as const;
export type SessionFocus = (typeof SESSION_FOCUSES)[number];

export const DEFAULT_SESSION_FOCUS: SessionFocus = 'balanced';

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
  /** Which items to lead with. Only meaningful under `smart` ordering. */
  readonly focus?: SessionFocus;
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
  /**
   * The course it was practised in.
   *
   * Progress records carry their item ids and so can be attributed to a course
   * after the fact; a session record holds counts and timestamps and cannot.
   * Without this field "recent sessions" is the one panel on a course-scoped
   * screen that shows another language's history, and no later migration can
   * work out which language a row belonged to.
   */
  readonly course: Course;
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
