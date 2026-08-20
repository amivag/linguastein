/**
 * The numeral rules and the pack's skill records have to stay in step.
 *
 * A rule the module can report but the pack cannot name is an attempt with
 * nowhere to go: the drill scores against these ids, and its targets — 1042 —
 * exist in no pack, so nothing else in the build would ever notice them missing.
 *
 * The forward direction (a rule with no label) is caught by the typechecker,
 * because the build's table is a `Record<NumeralRule, …>`. These tests hold the
 * parts a type cannot: that the records actually ship, that their ids are the
 * ones `rulesFor` implies, and that every one is reachable from a real number.
 */

import { describe, expect, it } from 'vitest';
import { NUMERAL_RULES, rulesFor, type NumeralRule } from '../../src/languages/es/numerals';
import { shippedRecords } from '../fixtures/dataset';

interface Skill {
  readonly id: string;
  readonly kind: string;
  readonly label: string;
  readonly level: string;
}

interface Translation {
  readonly ref: string;
  readonly lang: string;
  readonly text: string;
}

const skills = shippedRecords<Skill>('es-a1-a2-core-skills.jsonl');
const translations = shippedRecords<Translation>('es-a1-a2-core-translations-en.jsonl');

const idOf = (rule: NumeralRule) => `core-es:skill:numerals-${rule}`;

describe('numeral skills in the shipped pack', () => {
  it('ships one record per rule', () => {
    const shipped = skills.filter((skill) => skill.id.includes(':numerals-')).map((s) => s.id);
    expect(shipped.sort()).toEqual(NUMERAL_RULES.map(idOf).sort());
  });

  it('ships them even though no item references one', () => {
    // Every other skill is emitted only when an item uses it. These are declared,
    // because the drill's targets are generated and can never be items — so a
    // filter on usage would silently drop the whole feature.
    const items = shippedRecords<{ skills?: readonly string[] }>(
      'es-a1-a2-core-sentences.jsonl',
    ).flatMap((item) => item.skills ?? []);
    expect(items.filter((id) => id.includes(':numerals-'))).toEqual([]);
    expect(skills.some((skill) => skill.id === idOf('y-joining'))).toBe(true);
  });

  it('gives each one a Spanish label and an English gloss', () => {
    for (const rule of NUMERAL_RULES) {
      const skill = skills.find((entry) => entry.id === idOf(rule));
      expect(skill, rule).toBeDefined();
      expect(skill!.label.length, `${rule} label`).toBeGreaterThan(0);

      const gloss = translations.find((entry) => entry.ref === idOf(rule) && entry.lang === 'en');
      expect(gloss, `${rule} gloss`).toBeDefined();
      // The gloss has to say something the label does not, or a learner tapping
      // it learns only that "veintiún libros" is called "veintiún libros".
      expect(gloss!.text).not.toBe(skill!.label);
    }
  });

  it('levels them as patterns a beginner meets before ones they do not', () => {
    const levelOf = (rule: NumeralRule) => skills.find((s) => s.id === idOf(rule))?.level;
    expect(levelOf('teens')).toBe('a1');
    expect(levelOf('y-joining')).toBe('a1');
    // Agreement and the scale words come later than being able to count.
    expect(levelOf('hundreds-agreement')).toBe('a2');
    expect(levelOf('mil-millon')).toBe('a2');
  });

  it('declares no rule that no number can exercise', () => {
    // Dead curriculum: a skill a learner could never be shown. Cheaper to prove
    // by exhaustion than to reason about, since the module is pure.
    const reachable = new Set<NumeralRule>();
    for (let n = 0; n <= 2000; n++) for (const rule of rulesFor(n)) reachable.add(rule);
    for (const n of [100_000, 1_000_000]) for (const rule of rulesFor(n)) reachable.add(rule);

    expect(NUMERAL_RULES.filter((rule) => !reachable.has(rule))).toEqual([]);
  });
});
