/**
 * AI provider seam (spec §18, Rule 7).
 *
 * AI is layered *on top of* the learning engine: core practice must keep
 * working with no AI available, no API key and no network. Nothing here is
 * implemented against a vendor — this file defines the shape a future tutor
 * plugs into, and `learner-context.ts` produces the structured input it should
 * receive instead of a bare "teach me Spanish".
 */

import type { CefrLevel, ItemId, LanguageTag, LexemeId, SkillId } from '../domain/content';

/** What the learner can already do, in a form an AI can act on (spec §18). */
export interface LearnerContext {
  readonly targetLanguage: LanguageTag;
  readonly referenceLanguage: LanguageTag;
  readonly level: CefrLevel;
  /** Lemmas the learner handles reliably. */
  readonly known: readonly string[];
  /** Lemmas and patterns they get wrong or hesitate over. */
  readonly weak: readonly WeakPoint[];
  readonly topics: readonly string[];
  /** Cap on unfamiliar vocabulary in generated material. */
  readonly maxNewWords: number;
  readonly totals: {
    readonly seen: number;
    readonly mastered: number;
    readonly due: number;
  };
}

export interface WeakPoint {
  readonly label: string;
  readonly kind: 'lexeme' | 'skill' | 'item';
  readonly ref: LexemeId | SkillId | ItemId;
  /** 0–1, higher is weaker. */
  readonly difficulty: number;
}

export const AI_TASKS = [
  'explain',
  'more-examples',
  'mini-dialogue',
  'roleplay',
  'correct',
  'pronunciation-tips',
] as const;
export type AiTask = (typeof AI_TASKS)[number];

export interface AiRequest {
  readonly task: AiTask;
  readonly context: LearnerContext;
  /** The item, phrase or question the task is about. */
  readonly subject?: string;
  readonly instructions?: string;
}

export interface AiSuggestion {
  readonly text: string;
  /** Target-language material the app may turn into private practice items. */
  readonly examples?: readonly string[];
}

/**
 * A tutor implementation. Everything it returns is private, generated content:
 * usable immediately for that learner, never promoted into canonical data
 * without review (spec §18.1, §21).
 */
export interface AiTutorProvider {
  readonly id: string;
  isAvailable(): boolean;
  suggest(request: AiRequest): Promise<AiSuggestion>;
}

/** Provenance every AI-produced record must carry. */
export const AI_PROVENANCE = {
  source: 'generated',
  review: 'unreviewed',
} as const;
