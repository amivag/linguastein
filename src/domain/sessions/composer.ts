/**
 * Choosing *how* each item is practised, not just which items.
 *
 * Two problems this solves.
 *
 * First, difficulty. Recognising `beer` among four options is far easier than
 * producing `cerveza` from nothing, and recognition reliably produces the
 * illusion of competence: it feels like knowing while training the weakest
 * form of recall. So an item climbs a ladder as its memory stabilises —
 * recognise it, then complete it, then produce it — and drops back down after
 * a lapse.
 *
 * Second, variety. Asking the engine for "the first supported exercise kind"
 * meant multiple choice for effectively every item, because every item
 * supports it. Interleaving retrieval modes is one of the better-evidenced
 * effects in the literature (and one of the least popular with learners,
 * because it feels harder — which is the point).
 */

import type { ItemId, LearningItem } from '../content';
import type { ExerciseKind } from '../exercises/types';
import type { ItemProgress } from '../progress/types';
import { shuffle, type Rng } from '../../utils/random';

export const RETRIEVAL_MODES = ['recognition', 'cued-recall', 'production', 'study'] as const;
export type RetrievalMode = (typeof RETRIEVAL_MODES)[number];

/** Exercise kinds that realise each mode, hardest-first within the mode. */
export const MODE_KINDS: Record<RetrievalMode, readonly ExerciseKind[]> = {
  recognition: ['multiple-choice', 'reveal'],
  'cued-recall': ['cloze-choice', 'tap-to-build', 'multiple-choice'],
  production: ['think-say', 'listen-repeat'],
  study: ['reveal', 'listen-repeat'],
};

/** Stability in days at which an item is ready for the next rung. */
const CUED_RECALL_AT = 1;
const PRODUCTION_AT = 7;

export interface SessionStep {
  readonly itemId: ItemId;
  /** Preference order handed to the exercise engine, best first. */
  readonly kinds: readonly ExerciseKind[];
  readonly mode: RetrievalMode;
}

export interface ComposeInput {
  readonly items: readonly LearningItem[];
  readonly progress: ReadonlyMap<ItemId, ItemProgress>;
  /** Kinds the session is allowed to use, from the preset. */
  readonly allowed: readonly ExerciseKind[];
  readonly rng: Rng;
  /** Study sessions browse rather than test, so they skip the ladder. */
  readonly study?: boolean;
  /** How many consecutive items may share an exercise kind. */
  readonly maxRun?: number;
}

/** Where an item sits on the recognition → production ladder. */
export function retrievalModeFor(progress: ItemProgress | undefined): RetrievalMode {
  if (!progress || progress.attempts === 0) return 'recognition';
  // A lapse drops the item back a rung: rebuild before testing production.
  if (progress.status === 'learning') return 'recognition';

  const stability = progress.stability ?? 0;
  if (stability >= PRODUCTION_AT && progress.difficulty < 0.6) return 'production';
  if (stability >= CUED_RECALL_AT) return 'cued-recall';
  return 'recognition';
}

export function composeSession(input: ComposeInput): readonly SessionStep[] {
  const { items, progress, allowed, rng, study = false, maxRun = 2 } = input;

  const steps = items.map((item) => {
    const mode = study ? 'study' : retrievalModeFor(progress.get(item.id));
    return { itemId: item.id, mode, kinds: kindsFor(mode, allowed, rng) };
  });

  return study ? steps : breakUpRuns(steps, maxRun);
}

/**
 * Preference order for a mode: the mode's own kinds first, then anything else
 * the preset allows, so an item that cannot support the ideal exercise still
 * gets practised rather than skipped.
 */
function kindsFor(
  mode: RetrievalMode,
  allowed: readonly ExerciseKind[],
  rng: Rng,
): readonly ExerciseKind[] {
  const preferred = MODE_KINDS[mode].filter((kind) => allowed.includes(kind));
  // Equally-suitable kinds are shuffled so a session does not settle into one.
  const rest = shuffle(
    allowed.filter((kind) => !preferred.includes(kind)),
    rng,
  );
  return [...preferred, ...rest];
}

/**
 * Nudges consecutive items off a shared first choice. It only reorders
 * preferences — never drops an item — so a thin pack still yields a session.
 */
function breakUpRuns(steps: readonly SessionStep[], maxRun: number): readonly SessionStep[] {
  const result: SessionStep[] = [];
  let run = 0;

  for (const step of steps) {
    const previous = result.at(-1);
    const same = previous?.kinds[0] !== undefined && previous.kinds[0] === step.kinds[0];
    run = same ? run + 1 : 0;

    if (run < maxRun) {
      result.push(step);
      continue;
    }

    const alternative = step.kinds.find((kind) => kind !== previous?.kinds[0]);
    if (!alternative) {
      result.push(step);
      continue;
    }

    result.push({
      ...step,
      kinds: [alternative, ...step.kinds.filter((kind) => kind !== alternative)],
    });
    run = 0;
  }

  return result.length === steps.length ? result : [...steps];
}

/** Summary used by tests and by the session screen's "what am I doing" label. */
export function modeCounts(steps: readonly SessionStep[]): Record<RetrievalMode, number> {
  const counts: Record<RetrievalMode, number> = {
    recognition: 0,
    'cued-recall': 0,
    production: 0,
    study: 0,
  };
  for (const step of steps) counts[step.mode]++;
  return counts;
}
