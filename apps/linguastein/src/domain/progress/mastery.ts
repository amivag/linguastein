/**
 * Mastery of words and patterns, inferred from item history (spec §8.2).
 *
 * Item-level progress alone answers "do you remember this sentence?", which is
 * not the question worth asking. If a learner handles `Tengo que trabajar`,
 * `Tengo que irme` and `Tengo que comprar comida`, what they have acquired is
 * `tener que + infinitivo` — and the next sentence using it should not be
 * treated as brand new. Equally, a word met once inside one sentence is not
 * known, however well that sentence is remembered.
 *
 * Nothing here is stored: mastery is derived from item progress and the
 * repository whenever it is needed, so it can never drift out of sync with the
 * attempts it is based on.
 *
 * A stored form did once exist as a declaration — `SkillProgress` in
 * `types.ts`, holding an aggregated count and a 0–1 mastery per skill, never
 * written and never read. It is gone rather than waiting, and the reason is the
 * paragraph above: an aggregate that is stored has to be *maintained*, so every
 * change to what counts as an encounter, a context or a strength becomes a
 * migration of rows that nothing can rebuild. `MasteryRecord` is the same fact
 * computed on demand, and it is richer than the row ever was (distinct items,
 * distinct passages, items due now). Do not reintroduce a stored aggregate to
 * make a screen faster; measure first, and cache above this module if it is
 * ever genuinely needed.
 */

import { isItemId, type ContentRepository, type LexemeId, type SkillId } from '../content';
import { GRADED_MODES, type GradedMode } from '../exercises/modes';
import { isDue, type SubjectProgress, type Timestamp } from './types';

export type MasteryKind = 'lexeme' | 'skill';

export interface MasteryRecord {
  readonly id: LexemeId | SkillId;
  readonly kind: MasteryKind;
  readonly label: string;
  /** Distinct items practised that use this word or pattern. */
  readonly encounters: number;
  /** Distinct authored passages those practised items belong to. */
  readonly contexts: number;
  readonly attempts: number;
  readonly correct: number;
  /** 0–1: how reliably it is recalled, weighted by memory stability. */
  readonly strength: number;
  /** Items using it that are due for review now. */
  readonly due: number;
  readonly status: 'weak' | 'developing' | 'strong';
  /**
   * How the evidence was gathered, per retrieval mode.
   *
   * `strength` is one number, and one number cannot distinguish a word
   * recognised among four options from the same word produced from nothing —
   * which is the difference the learner actually cares about and the difference
   * `docs/tasks/retrieval-evidence.md` exists to make legible. Counted in
   * *distinct items*, like `encounters`, rather than in attempts: twenty
   * multiple-choice answers on one sentence are not breadth.
   *
   * Every mode is present with zeros rather than the key being absent, so a
   * reader never has to decide what a missing key meant. All-zero is a real
   * state and it means **unknown** — rows practised before evidence was recorded
   * have none, and {@link reachedMode} is what turns that into "say nothing"
   * rather than into "never produced".
   */
  readonly modes: Readonly<Record<GradedMode, ModeReach>>;
}

/** How far one retrieval mode's evidence for a word or pattern reaches. */
export interface ModeReach {
  /** Distinct items using it that have been tried at this mode. */
  readonly tried: number;
  /** …of those, the ones passed at least once. */
  readonly passed: number;
}

export interface Mastery {
  readonly lexemes: ReadonlyMap<LexemeId, MasteryRecord>;
  readonly skills: ReadonlyMap<SkillId, MasteryRecord>;
}

/**
 * Encounters needed before a word counts as genuinely known. Research on
 * incidental vocabulary acquisition puts durable learning at roughly 8–12
 * meetings in varied contexts; 6 is the floor this app treats as "strong",
 * because its encounters are deliberate rather than incidental.
 */
export const ENCOUNTERS_FOR_STRENGTH = 6;

interface Accumulator {
  encounters: number;
  contexts: Set<string>;
  attempts: number;
  correct: number;
  due: number;
  strengthTotal: number;
  modes: Record<GradedMode, { tried: number; passed: number }>;
}

function noReach(): Record<GradedMode, { tried: number; passed: number }> {
  return {
    recognition: { tried: 0, passed: 0 },
    'cued-recall': { tried: 0, passed: 0 },
    production: { tried: 0, passed: 0 },
  };
}

export function inferMastery(
  repository: ContentRepository,
  progress: readonly SubjectProgress[],
  now: Timestamp = Date.now(),
): Mastery {
  const lexemes = new Map<LexemeId, Accumulator>();
  const skills = new Map<SkillId, Accumulator>();

  for (const record of progress) {
    if (record.attempts === 0) continue;
    /*
     * Only rows about an *item*, and the skip is now doing two jobs.
     *
     * It always dropped a row whose item the loaded packs do not have. Since a
     * progress row can be about a form or a pattern as well
     * (`SubjectProgress.subject`), it also drops **direct** evidence — forty
     * numeral drills against `numerals-y-joining` do not become forty
     * encounters here.
     *
     * That is deliberate rather than pending. `encounters` means *distinct items
     * using this word or pattern*, and it is what the strength floor is
     * calibrated against; folding a drill's repetitions into the same number
     * would let one afternoon of drilling read as breadth across six contexts.
     * Direct evidence is real and is scheduled by FSRS on its own row — mixing
     * the two into one figure is what would corrupt the signal this module
     * exists to protect. Widening it is a separate decision, with its own
     * definition of what an encounter is.
     */
    if (!isItemId(record.subject)) continue;
    const item = repository.getItem(record.subject);
    if (!item) continue;

    const strength = itemStrength(record);
    const due = isDue(record, now) ? 1 : 0;
    // A standalone item is its own context. Passage items share the first
    // authored container, which stops six memorised lines in one dialogue from
    // masquerading as transfer across six situations.
    const context = repository.passagesOfItem(item.id)[0]?.id ?? item.id;

    for (const lexeme of item.lexemes ?? []) add(lexemes, lexeme, record, strength, due, context);
    for (const skill of item.skills ?? []) add(skills, skill, record, strength, due, context);
  }

  return {
    lexemes: finalise(lexemes, (id) => repository.getLexeme(id)?.lemma ?? id, 'lexeme'),
    skills: finalise(
      skills,
      (id) => repository.getSkill(id)?.label ?? id,
      'skill',
      // A taught example plus two changed situations is the minimum evidence
      // for communicative reliability. Two contexts still permit a memorised
      // model and one close variation to flatter the learner.
      (id) => (repository.getSkill(id)?.kind === 'function' ? 3 : 1),
    ),
  };
}

function add<K>(
  index: Map<K, Accumulator>,
  key: K,
  record: SubjectProgress,
  strength: number,
  due: number,
  context: string,
): void {
  const entry = index.get(key) ?? {
    encounters: 0,
    contexts: new Set(),
    attempts: 0,
    correct: 0,
    due: 0,
    strengthTotal: 0,
    modes: noReach(),
  };
  entry.encounters += 1;
  /*
   * One item contributes at most one to each mode, whatever it was answered
   * however many times. `encounters` counts distinct items and the strength
   * floor is calibrated against that; a tally of raw attempts beside it would
   * be two different units under one heading.
   */
  for (const mode of GRADED_MODES) {
    const held = record.evidence?.[mode];
    if (!held || held.attempts === 0) continue;
    entry.modes[mode].tried += 1;
    if (held.correct > 0) entry.modes[mode].passed += 1;
  }
  entry.contexts.add(context);
  entry.attempts += record.attempts;
  entry.correct += record.correct;
  entry.due += due;
  entry.strengthTotal += strength;
  index.set(key, entry);
}

function finalise<K extends LexemeId | SkillId>(
  index: Map<K, Accumulator>,
  label: (id: K) => string,
  kind: MasteryKind,
  minimumContexts: (id: K) => number = () => 1,
): ReadonlyMap<K, MasteryRecord> {
  const result = new Map<K, MasteryRecord>();

  for (const [id, entry] of index) {
    const recall = entry.strengthTotal / entry.encounters;
    // Breadth matters as much as recall: one very familiar sentence is not
    // the same as the same word handled across six different ones.
    const breadth = Math.min(entry.encounters / ENCOUNTERS_FOR_STRENGTH, 1);
    const strength = round2(recall * (0.5 + 0.5 * breadth));

    result.set(id, {
      id,
      kind,
      label: label(id),
      encounters: entry.encounters,
      contexts: entry.contexts.size,
      attempts: entry.attempts,
      correct: entry.correct,
      due: entry.due,
      strength,
      status: statusFor(strength, entry.contexts.size, minimumContexts(id)),
      modes: entry.modes,
    });
  }

  return result;
}

/** How well one item is currently held, from its memory stability. */
function itemStrength(record: SubjectProgress): number {
  const accuracy = record.attempts > 0 ? record.correct / record.attempts : 0;
  // A month of stability counts as fully stable; below that it scales.
  const stability = Math.min((record.stability ?? 0) / 21, 1);
  return round2(0.5 * accuracy + 0.5 * stability);
}

function statusFor(
  strength: number,
  contexts: number,
  minimumContexts: number,
): MasteryRecord['status'] {
  // Every record here has been attempted, so there is no 'unseen' case: a word
  // met and forgotten is weak, not unknown.
  if (strength < 0.35) return 'weak';
  if (strength < 0.7 || contexts < minimumContexts) return 'developing';
  return 'strong';
}

/**
 * The hardest way this word or pattern has actually been recalled, if any.
 *
 * `undefined` covers two different-looking cases that a surface must treat the
 * same way: nothing has been tried at any mode (a row practised before evidence
 * was recorded), and everything tried has failed. Neither supports a claim about
 * what the learner can do, so the honest rendering of both is to say nothing —
 * the same rule `retrievalModeFor` follows when the map is absent.
 */
export function reachedMode(record: MasteryRecord): GradedMode | undefined {
  return [...GRADED_MODES].reverse().find((mode) => record.modes[mode].passed > 0);
}

/** Weakest first — what a session should spend its time on. */
export function weakest(mastery: Mastery, limit = 10): readonly MasteryRecord[] {
  return [...mastery.skills.values(), ...mastery.lexemes.values()]
    .filter((record) => record.attempts > 0)
    .sort((a, b) => a.strength - b.strength || b.attempts - a.attempts)
    .slice(0, limit);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
