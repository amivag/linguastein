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
import {
  GRADED_MODES,
  MODE_KINDS,
  RETRIEVAL_MODES,
  rungOf,
  type GradedMode,
  type RetrievalMode,
} from '../exercises/modes';
import type { ExerciseKind } from '../exercises/types';
import type { SubjectProgress } from '../progress/types';
import { shuffle, type Rng } from '../../utils/random';

/*
 * The mode vocabulary moved to `exercises/modes.ts` on 2026-09-14. It is a
 * statement about exercise kinds rather than about sessions, and `progress/` has
 * to read it — `SubjectProgress.evidence` is keyed by mode, and progress
 * importing sessions would be a cycle. Re-exported here because this is where
 * every existing caller looks for it.
 */
export { GRADED_MODES, MODE_KINDS, RETRIEVAL_MODES, type GradedMode, type RetrievalMode };

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
  readonly progress: ReadonlyMap<ItemId, SubjectProgress>;
  /** Kinds the session is allowed to use, from the preset. */
  readonly allowed: readonly ExerciseKind[];
  readonly rng: Rng;
  /** Study sessions browse rather than test, so they skip the ladder. */
  readonly study?: boolean;
  /** How many consecutive items may share an exercise kind. */
  readonly maxRun?: number;
}

/**
 * Where an item sits on the recognition → production ladder.
 *
 * Two questions, deliberately answered separately. **What has the memory
 * earned**, from stability and difficulty — and **what has the learner actually
 * shown**, from the evidence per mode. Stability alone was the whole answer
 * until 2026-09-14, and it folds every exercise kind into one number: an item
 * answered ten times as a four-way multiple choice crossed `PRODUCTION_AT` and
 * was offered as production having never once been produced. Recognition
 * inflating the ladder meant to gate it is the bug
 * `docs/tasks/retrieval-evidence.md` exists to close.
 */
export function retrievalModeFor(progress: SubjectProgress | undefined): RetrievalMode {
  if (!progress || progress.attempts === 0) return 'recognition';
  // A lapse drops the item back a rung: rebuild before testing production.
  if (progress.status === 'learning') return 'recognition';

  const stability = progress.stability ?? 0;
  const earned: GradedMode =
    stability >= PRODUCTION_AT && progress.difficulty < 0.6
      ? 'production'
      : stability >= CUED_RECALL_AT
        ? 'cued-recall'
        : 'recognition';

  return gateByEvidence(earned, progress.evidence);
}

/**
 * The highest rung at or below `earned` whose prerequisite has been met.
 *
 * A rung is offered only once the rung below it has been passed at least once,
 * so producing has to be earned by having completed, and completing by having
 * recognised. In practice that descends at most one step — an item with no
 * correct answer anywhere is already held at `recognition` by
 * `status === 'learning'` above — but the rule is the descent rather than the
 * single step, and writing it as one step would be a special case standing in
 * for a general one.
 *
 * **An absent map is "unknown", not "never".** Rows written before evidence
 * existed keep behaving exactly as they did; nobody's ladder resets on upgrade.
 * A learner who only ever runs a recognition-only preset does stay at
 * recognition, and that is the true statement about what they have shown rather
 * than a stall to be worked around — saying so on screen is Stage C.
 */
function gateByEvidence(earned: GradedMode, evidence: SubjectProgress['evidence']): GradedMode {
  if (!evidence) return earned;

  let mode = earned;
  for (let rung = rungOf(earned); rung > 0; rung--) {
    const below = GRADED_MODES[rung - 1];
    if (below === undefined || (evidence[below]?.correct ?? 0) > 0) break;
    mode = below;
  }
  return mode;
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
