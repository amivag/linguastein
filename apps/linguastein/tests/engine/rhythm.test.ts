/** A second subject must run without importing the language model or casting its ids. */
import { describe, expect, it } from 'vitest';
import {
  fsrsScheduler,
  nextSubject,
  seededRng,
  type DrillMaterial,
  type MemoryState,
} from '../../src/engine';

const DAY = 86_400_000;
const rules = ['rhythm:skill:pulse', 'rhythm:skill:offbeat'] as const;
type Rule = (typeof rules)[number];
interface RhythmTarget {
  readonly rule: Rule;
  readonly onsetsInBeats: readonly number[];
}
const material: DrillMaterial<RhythmTarget> = {
  rules,
  sampleFor(rule) {
    if (rule !== rules[0] && rule !== rules[1]) throw new Error('Unknown rule');
    return { rule, onsetsInBeats: rule === rules[0] ? [0, 1, 2, 3] : [0.5, 1.5, 2.5, 3.5] };
  },
  rulesFor: (target) => [target.rule],
};
const fresh = (): MemoryState => ({
  status: 'new',
  attempts: 0,
  correct: 0,
  incorrect: 0,
  difficulty: 0.3,
  streak: 0,
});

describe('rhythm curriculum on the shared engine', () => {
  it('selects, generates and schedules timed targets without text or language types', () => {
    const progress = new Map<Rule, MemoryState>();
    const rng = seededRng(42);
    const first = nextSubject(rules, progress, 0, rng)!;
    expect(first).toBe(rules[0]);
    const target = material.sampleFor(first, rng);
    expect(target.onsetsInBeats).toEqual([0, 1, 2, 3]);
    expect(material.rulesFor(target)).toEqual([first]);
    progress.set(first, fsrsScheduler.review(fresh(), 'good', 0));
    expect(nextSubject(rules, progress, 1, rng)).toBe(rules[1]);
    progress.set(rules[1], fsrsScheduler.review(fresh(), 'easy', 1));
    expect(nextSubject(rules, progress, progress.get(first)!.dueAt!, rng)).toBe(first);
    const lapsed = fsrsScheduler.review(progress.get(first)!, 'again', 4 * DAY);
    expect(lapsed.streak).toBe(0);
    expect(lapsed.dueAt).toBe(4 * DAY + 600_000);
  });

  it('counts elapsed time from epoch zero, just as from any other clock origin', () => {
    const initial = fsrsScheduler.review(fresh(), 'good', 0);
    const atEpoch = fsrsScheduler.review(initial, 'good', 10 * DAY);
    const shifted = fsrsScheduler.review({ ...initial, lastReviewedAt: DAY }, 'good', 11 * DAY);
    expect(atEpoch.stability).toBeGreaterThan(initial.stability!);
    expect(atEpoch.stability).toBe(shifted.stability);
  });
});
