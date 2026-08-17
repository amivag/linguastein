import { describe, expect, it } from 'vitest';
import type { ItemId, LexemeId, SkillId } from '../../src/domain/content';
import {
  ENCOUNTERS_FOR_STRENGTH,
  inferMastery,
  newItemProgress,
  weakest,
  type ItemProgress,
} from '../../src/domain/progress';
import { id, testRepository } from '../fixtures/pack';

const repository = testRepository();
const NOW = 1_700_000_000_000;
const TENER = id<LexemeId>('test-es:lexeme:tener');
const TENER_QUE = id<SkillId>('test-es:skill:tener-que');

const record = (local: string, overrides: Partial<ItemProgress> = {}): ItemProgress => ({
  ...newItemProgress(id<ItemId>(`test-es:item:${local}`)),
  attempts: 4,
  correct: 4,
  stability: 20,
  ...overrides,
});

const infer = (progress: readonly ItemProgress[]) => inferMastery(repository, progress, NOW);

describe('inferMastery', () => {
  it('reports nothing for a learner who has not practised', () => {
    const mastery = infer([]);
    expect(mastery.lexemes.size).toBe(0);
    expect(mastery.skills.size).toBe(0);
  });

  it('credits the word and the pattern, not just the sentence', () => {
    // Item 001 is `Tengo que trabajar.` — it carries both.
    const mastery = infer([record('001')]);

    expect(mastery.lexemes.get(TENER)?.label).toBe('tener');
    expect(mastery.skills.get(TENER_QUE)?.label).toBe('tener que + infinitivo');
    expect(mastery.lexemes.get(TENER)?.encounters).toBe(1);
  });

  it('treats a word met in one sentence as weaker than one met in several', () => {
    const narrow = infer([record('001')]).lexemes.get(TENER)!;
    // Items 001 and 002 both use `tener`.
    const broad = infer([record('001'), record('002')]).lexemes.get(TENER)!;

    expect(broad.encounters).toBe(2);
    expect(broad.strength).toBeGreaterThan(narrow.strength);
  });

  it('does not call a word strong on perfect recall of a single sentence', () => {
    const single = infer([record('001', { stability: 200 })]).lexemes.get(TENER)!;
    expect(single.status).not.toBe('strong');
  });

  it('counts a shaky memory as weaker than a durable one', () => {
    const shaky = infer([record('001', { stability: 0.5, correct: 2, attempts: 4 })]);
    const durable = infer([record('001', { stability: 60, correct: 4, attempts: 4 })]);

    expect(shaky.lexemes.get(TENER)!.strength).toBeLessThan(durable.lexemes.get(TENER)!.strength);
    expect(shaky.lexemes.get(TENER)!.status).toBe('weak');
  });

  it('reports how much of a word is due for review', () => {
    const mastery = infer([
      record('001', { dueAt: NOW - 1000 }),
      record('002', { dueAt: NOW + 100_000 }),
    ]);
    expect(mastery.lexemes.get(TENER)?.due).toBe(1);
  });

  it('ignores items that were planned but never attempted', () => {
    expect(infer([record('001', { attempts: 0, correct: 0 })]).lexemes.size).toBe(0);
  });

  it('needs several contexts before a word counts as strong', () => {
    const many = Array.from({ length: ENCOUNTERS_FOR_STRENGTH }, (_, index) =>
      record(String(index + 1).padStart(3, '0'), { stability: 60 }),
    );
    // Only items 001 and 002 carry `tener` in the fixture, so breadth is capped
    // by the content itself — which is exactly the recycling problem the
    // dataset has to solve.
    const mastery = infer(many).lexemes.get(TENER)!;
    expect(mastery.encounters).toBe(2);
    expect(mastery.strength).toBeLessThan(1);
  });
});

describe('weakest', () => {
  it('ranks what a session should spend its time on', () => {
    const mastery = infer([
      record('001', { stability: 0.2, correct: 1, attempts: 5 }),
      record('004', { stability: 90, correct: 5, attempts: 5 }),
    ]);

    const ranked = weakest(mastery, 3);
    expect(ranked[0]!.strength).toBeLessThanOrEqual(ranked.at(-1)!.strength);
    expect(ranked.some((entry) => entry.label === 'tener')).toBe(true);
  });
});
