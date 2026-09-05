/**
 * The numbers drill: which pattern to ask about, and a number that asks it.
 *
 * Two halves, and they fail in different ways. `sampleFor` and `rulesFor` are
 * two descriptions of the same rules written independently, so the thing worth
 * asserting is that they still **agree** — a sample that stopped exercising the
 * rule it was drawn for would record evidence against a pattern the learner was
 * never asked about, and nothing on screen would look wrong. `nextSubject` is
 * the ordering, and what matters there is that due work leads and that a learner
 * meets the patterns in the order they are taught.
 */

import { describe, expect, it } from 'vitest';
import type { EntityId } from '../../src/domain/content';
import { nextSubject } from '../../src/domain/drills';
import { newProgress, type SubjectProgress } from '../../src/domain/progress';
import {
  MAX_CARDINAL,
  NUMERAL_RULES,
  parseCardinal,
  rulesFor,
  sampleFor,
  spellCardinal,
} from '../../src/languages/es/numerals';
import { id } from '../fixtures/pack';
import { seededRng } from '../../src/utils/random';

const NOW = 1_757_030_400_000;
const DAY = 86_400_000;

const skill = (rule: string) => id<EntityId>(`test-es:skill:numerals-${rule}`);

describe('sampling a number for a rule', () => {
  /**
   * The guarantee the drill rests on. Asserted across every rule and many seeds
   * rather than with an example each, because the failure mode is a
   * construction that is *usually* right — `apocopation` drawing an occasional
   * 11, say — which one example per rule would miss for months.
   */
  it('always produces a number that exercises the rule', () => {
    for (const rule of NUMERAL_RULES) {
      for (let seed = 1; seed <= 60; seed++) {
        const value = sampleFor(rule, seededRng(seed));

        expect(rulesFor(value), `${rule} @ ${seed} → ${value}`).toContain(rule);
      }
    }
  });

  /** A number the speller cannot spell is a question that cannot be marked. */
  it('never produces a number outside what the speller handles', () => {
    for (const rule of NUMERAL_RULES) {
      for (let seed = 1; seed <= 60; seed++) {
        const value = sampleFor(rule, seededRng(seed));

        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(MAX_CARDINAL);
        // And it round-trips, which is what grading a typed answer depends on.
        expect(parseCardinal(spellCardinal(value))).toBe(value);
      }
    }
  });

  /**
   * Ranges a learner meets, not ranges the module can reach. A drill asking for
   * 758,214,003 because `MAX_CARDINAL` allows it would be technically correct
   * and useless.
   */
  it('keeps the numbers to sizes people say', () => {
    for (let seed = 1; seed <= 40; seed++) {
      expect(sampleFor('mil-millon', seededRng(seed))).toBeLessThanOrEqual(10_000_000);
      expect(sampleFor('teens', seededRng(seed))).toBeLessThan(20);
    }
  });

  it('does not always ask the same number', () => {
    const seen = new Set(
      Array.from({ length: 40 }, (_, seed) => sampleFor('y-joining', seededRng(seed + 1))),
    );

    expect(seen.size).toBeGreaterThan(10);
  });
});

describe('choosing what to practise next', () => {
  const rules = NUMERAL_RULES.map(skill);
  const rng = seededRng(1);

  const reviewed = (overrides: Partial<SubjectProgress>): SubjectProgress => ({
    ...newProgress(skill('teens')),
    status: 'review',
    attempts: 4,
    correct: 4,
    stability: 30,
    dueAt: NOW + 30 * DAY,
    ...overrides,
  });

  it('has nothing to say about an empty set', () => {
    expect(nextSubject([], new Map(), NOW, rng)).toBeUndefined();
  });

  /** Teaching order, so a learner meets the solid teens before `un millón de`. */
  it('leads with the first unmet pattern, in the order given', () => {
    expect(nextSubject(rules, new Map(), NOW, rng)).toBe(skill('teens'));
  });

  it('moves on once a pattern has been met', () => {
    const progress = new Map([[skill('teens'), reviewed({ subject: skill('teens') })]]);

    expect(nextSubject(rules, progress, NOW, rng)).toBe(skill('twenties'));
  });

  /**
   * Due work leads, which is the rule the whole app follows: a drill that kept
   * introducing patterns while the scheduler asked for the earlier ones back
   * would build exactly the review debt that gets people to stop.
   */
  it('leads with what is due, ahead of anything unmet', () => {
    const progress = new Map([
      [skill('mil-millon'), reviewed({ subject: skill('mil-millon'), dueAt: NOW - DAY })],
    ]);

    expect(nextSubject(rules, progress, NOW, rng)).toBe(skill('mil-millon'));
  });

  it('takes the most overdue first', () => {
    const progress = new Map([
      [skill('teens'), reviewed({ subject: skill('teens'), dueAt: NOW - DAY })],
      [skill('twenties'), reviewed({ subject: skill('twenties'), dueAt: NOW - 9 * DAY })],
    ]);

    expect(nextSubject(rules, progress, NOW, rng)).toBe(skill('twenties'));
  });

  /**
   * Once everything is met and nothing is due, practice still has to go
   * somewhere — and the weakest is where it is worth going.
   */
  it('falls back to the weakest when everything is known and nothing is due', () => {
    const progress = new Map(
      NUMERAL_RULES.map((rule) => [
        skill(rule),
        reviewed({
          subject: skill(rule),
          // `hundreds-agreement` answered badly; the rest answered well.
          correct: rule === 'hundreds-agreement' ? 1 : 4,
        }),
      ]),
    );

    expect(nextSubject(rules, progress, NOW, rng)).toBe(skill('hundreds-agreement'));
  });

  /**
   * A memory that has never survived a gap is not as strong as one that has,
   * even at the same accuracy — the distinction `mastery.ts` and the batch bar
   * both draw, and the reason strength is not just `correct / attempts`.
   */
  it('prefers a pattern that has not yet survived a gap', () => {
    const progress = new Map(
      NUMERAL_RULES.map((rule) => [
        skill(rule),
        reviewed({ subject: skill(rule), stability: rule === 'cien-ciento' ? 1 : 30 }),
      ]),
    );

    expect(nextSubject(rules, progress, NOW, rng)).toBe(skill('cien-ciento'));
  });
});
