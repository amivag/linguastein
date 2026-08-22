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
 */

import type { ContentRepository, LexemeId, SkillId } from '../content';
import { isDue, type ItemProgress, type Timestamp } from './types';

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
}

export function inferMastery(
  repository: ContentRepository,
  progress: readonly ItemProgress[],
  now: Timestamp = Date.now(),
): Mastery {
  const lexemes = new Map<LexemeId, Accumulator>();
  const skills = new Map<SkillId, Accumulator>();

  for (const record of progress) {
    if (record.attempts === 0) continue;
    const item = repository.getItem(record.itemId);
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
      (id) => (repository.getSkill(id)?.kind === 'function' ? 2 : 1),
    ),
  };
}

function add<K>(
  index: Map<K, Accumulator>,
  key: K,
  record: ItemProgress,
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
  };
  entry.encounters += 1;
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
    });
  }

  return result;
}

/** How well one item is currently held, from its memory stability. */
function itemStrength(record: ItemProgress): number {
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
