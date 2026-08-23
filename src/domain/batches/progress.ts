/**
 * How far a learner has got with a batch — derived, never stored.
 *
 * The rule this inherits from missions is that progress records point at item
 * ids and nothing else, so "have I absorbed this set?" is *computed* from the
 * attempt log every time it is asked. A batch that recorded its own completion
 * could claim mastery the evidence no longer supports.
 *
 * The bar itself is the interesting part, and §4.3 of the task brief is why it
 * is per item rather than per word: `mastery.ts` calls a lexeme strong after six
 * *distinct items* use it, which is well argued for a word — but 588 of the 763
 * lexemes this pack's sentences use appear in fewer than six sentences, so a
 * batch judged that way would read permanently unfinished through no fault of
 * the learner. Do not mix the two definitions on one screen.
 */

import type { ItemId } from '../content';
import type { ExerciseKind } from '../exercises/types';
import { isDue, type Attempt, type ItemProgress, type Timestamp } from '../progress/types';
import type { BatchDefinition } from './model';

/**
 * Retrieval modes that count as evidence.
 *
 * `AGENTS.md` states it plainly: recognition is the weakest retrieval mode and
 * the most flattering. A four-way multiple choice answered correctly is not
 * evidence of being able to produce the item, so a batch that graduated on one
 * would be a batch that lies. `tap-to-build` is cued production — the words are
 * given but the learner assembles them — and `think-say` is free production.
 */
export const PRODUCTION_KINDS = [
  'think-say',
  'tap-to-build',
] as const satisfies readonly ExerciseKind[];

/**
 * Days of memory stability an item needs. One real spacing gap survived, rather
 * than one good afternoon: below this, `mastery.ts` would not call the item
 * stable either.
 */
export const ABSORBED_STABILITY_DAYS = 7;

/**
 * Distinct days the item must have been *produced* on.
 *
 * This is the condition that separates knowing thirty words from having crammed
 * them, and the only one the current model cannot fake — a single session, however
 * long and however well it goes, cannot satisfy it.
 */
export const ABSORBED_PRODUCTION_DAYS = 2;

/**
 * How much of a batch counts as done. Not all of it: one stubborn item must not
 * hold a batch hostage, and the stragglers are exactly what the next batch
 * should open with.
 */
export const BATCH_COMPLETION_RATIO = 0.9;

/**
 * Which calendar day a timestamp falls on.
 *
 * Injected because this module is pure and a calendar day is a local fact. UTC
 * division would count one evening session as two days for any learner west of
 * Greenwich, which is the exact thing {@link ABSORBED_PRODUCTION_DAYS} exists to
 * prevent — so the caller, which knows the device, supplies it.
 */
export type DayOf = (at: Timestamp) => string;

export interface BatchStanding {
  readonly batch: BatchDefinition;
  /** Items that still resolve inside the current course. */
  readonly total: number;
  /** Items that no longer do — reported, never pruned. */
  readonly missing: number;
  readonly absorbed: number;
  /** Attempted, not yet absorbed. */
  readonly shaky: number;
  readonly untouched: number;
  readonly dueNow: number;
  readonly complete: boolean;
}

export interface BatchStandingInput {
  readonly batch: BatchDefinition;
  /** Item ids the current course admits, as every screen already builds. */
  readonly courseItemIds: ReadonlySet<string>;
  readonly progress: ReadonlyMap<ItemId, ItemProgress>;
  readonly attempts: readonly Attempt[];
  readonly now: Timestamp;
  readonly dayOf: DayOf;
}

/**
 * Whether one item has been absorbed: produced, on two separate days, and still
 * held a week out. All three, because each covers a way the other two flatter —
 * stability without production rewards recognition, production without stability
 * rewards a good afternoon, and either without distinct days rewards cramming.
 */
export function isItemAbsorbed(
  progress: ItemProgress | undefined,
  productionDays: ReadonlySet<string>,
): boolean {
  if (!progress) return false;
  return (
    (progress.stability ?? 0) >= ABSORBED_STABILITY_DAYS &&
    productionDays.size >= ABSORBED_PRODUCTION_DAYS
  );
}

export function batchStanding(input: BatchStandingInput): BatchStanding {
  const { batch, courseItemIds, progress, now } = input;
  const productionDays = productionDaysByItem(input.attempts, input.dayOf);

  let total = 0;
  let missing = 0;
  let absorbed = 0;
  let shaky = 0;
  let untouched = 0;
  let dueNow = 0;

  // A set, so a duplicated id cannot inflate a count past the size of the batch.
  for (const itemId of new Set(batch.itemIds)) {
    if (!courseItemIds.has(itemId)) {
      missing++;
      continue;
    }

    total++;
    const record = progress.get(itemId);
    if (isItemAbsorbed(record, productionDays.get(itemId) ?? EMPTY_DAYS)) absorbed++;
    else if (record && record.attempts > 0) shaky++;
    else untouched++;

    if (record && isDue(record, now)) dueNow++;
  }

  return {
    batch,
    total,
    missing,
    absorbed,
    shaky,
    untouched,
    dueNow,
    complete: total > 0 && absorbed >= Math.ceil(total * BATCH_COMPLETION_RATIO),
  };
}

const EMPTY_DAYS: ReadonlySet<string> = new Set();

/**
 * Item → the distinct days it was successfully produced on.
 *
 * `grade: 'again'` is excluded because an attempt that failed is not a
 * retrieval; counting it would let two days of getting an item wrong graduate
 * it. This is the first thing in the codebase to read `Attempt.exerciseKind`,
 * which has been recorded and unaggregated since the field was added.
 */
function productionDaysByItem(
  attempts: readonly Attempt[],
  dayOf: DayOf,
): ReadonlyMap<ItemId, ReadonlySet<string>> {
  const days = new Map<ItemId, Set<string>>();

  for (const attempt of attempts) {
    if (!isProduction(attempt.exerciseKind) || attempt.grade === 'again') continue;
    const seen = days.get(attempt.itemId) ?? new Set<string>();
    seen.add(dayOf(attempt.at));
    days.set(attempt.itemId, seen);
  }

  return days;
}

function isProduction(kind: ExerciseKind): boolean {
  return (PRODUCTION_KINDS as readonly ExerciseKind[]).includes(kind);
}
