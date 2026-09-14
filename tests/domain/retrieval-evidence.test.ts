/**
 * The ladder, verified rather than prescribed.
 *
 * `retrievalModeFor` read `stability` and `difficulty` alone until 2026-09-14,
 * and both fold every exercise kind together — so an item answered ten times as
 * a four-way multiple choice was promoted to production having never once been
 * produced. `docs/tasks/retrieval-evidence.md` is the brief; the test in one
 * line is "only multiple choice never reaches production".
 */

import { describe, expect, it } from 'vitest';
import type { ItemId } from '../../src/domain/content';
import {
  EXERCISE_KINDS,
  GRADED_MODES,
  MODE_KINDS,
  modeOfKind,
  unclaimedKinds,
} from '../../src/domain/exercises';
import {
  applyAttempt,
  newProgress,
  type Attempt,
  type ModeEvidence,
  type SubjectProgress,
} from '../../src/domain/progress';
import { retrievalModeFor } from '../../src/domain/sessions';
import { id } from '../fixtures/pack';

const ITEM = id<ItemId>('test-es:item:001');
const AT = 1_700_000_000_000;

const attempt = (overrides: Partial<Attempt> = {}): Attempt => ({
  id: 'attempt-1',
  subject: ITEM,
  exerciseKind: 'multiple-choice',
  grade: 'good',
  at: AT,
  ...overrides,
});

/** A row durable enough that the memory has earned production on its own. */
const durable = (evidence?: SubjectProgress['evidence']): SubjectProgress => ({
  ...newProgress(ITEM),
  status: 'review',
  attempts: 12,
  stability: 30,
  difficulty: 0.2,
  ...(evidence ? { evidence } : {}),
});

const passed = (correct = 1): ModeEvidence => ({ attempts: correct, correct, lastAt: AT });

describe('which mode an exercise kind is evidence of', () => {
  it('leaves no exercise kind unclaimed', () => {
    // A kind added to EXERCISE_KINDS and to no mode would record as recognition
    // forever, which is a lie the type system cannot catch.
    expect(unclaimedKinds()).toEqual([]);
  });

  it('reads a kind claimed by two modes as the weaker of them', () => {
    // MODE_KINDS is a preference order for *offering* an exercise: multiple
    // choice is the last resort under cued-recall, for items that support
    // nothing better. Reading that as a claim is the inflation being closed.
    expect(MODE_KINDS['cued-recall']).toContain('multiple-choice');
    expect(modeOfKind('multiple-choice')).toBe('recognition');
  });

  it('only ever answers with a graded mode', () => {
    // Never `study`: a study session records nothing, so there is no such thing
    // as evidence from one.
    for (const kind of EXERCISE_KINDS) expect(GRADED_MODES).toContain(modeOfKind(kind));
  });

  it('answers with a mode that actually lists the kind', () => {
    // Derived from MODE_KINDS rather than written beside it — this fails if the
    // two ever drift apart.
    for (const kind of EXERCISE_KINDS) expect(MODE_KINDS[modeOfKind(kind)]).toContain(kind);
  });
});

describe('folding an attempt into evidence', () => {
  it('records against the mode the kind is evidence of', () => {
    const progress = applyAttempt(undefined, attempt({ exerciseKind: 'think-say' }));

    expect(progress.evidence?.production).toEqual({ attempts: 1, correct: 1, lastAt: AT });
    expect(progress.evidence?.recognition).toBeUndefined();
  });

  it('counts a failed attempt as tried but not as passed', () => {
    const progress = applyAttempt(undefined, attempt({ grade: 'again' }));

    expect(progress.evidence?.recognition).toEqual({ attempts: 1, correct: 0, lastAt: AT });
  });

  it('keeps the modes apart as they accumulate', () => {
    const first = applyAttempt(undefined, attempt());
    const second = applyAttempt(first, attempt({ id: 'attempt-2', exerciseKind: 'cloze-choice' }));
    const third = applyAttempt(second, attempt({ id: 'attempt-3', at: AT + 1 }));

    expect(third.evidence).toEqual({
      recognition: { attempts: 2, correct: 2, lastAt: AT + 1 },
      'cued-recall': { attempts: 1, correct: 1, lastAt: AT },
    });
  });
});

describe('gating the ladder on evidence', () => {
  it('never offers production to an item answered only by multiple choice', () => {
    // The bug, in one line. The memory is durable; the evidence is recognition.
    expect(retrievalModeFor(durable({ recognition: passed(12) }))).toBe('cued-recall');
  });

  it('offers production once the rung below has been passed', () => {
    const evidence = { recognition: passed(), 'cued-recall': passed() };
    expect(retrievalModeFor(durable(evidence))).toBe('production');
  });

  it('counts a mode as unpassed while every attempt at it has failed', () => {
    const evidence = {
      recognition: passed(),
      'cued-recall': { attempts: 4, correct: 0, lastAt: AT },
    };
    expect(retrievalModeFor(durable(evidence))).toBe('cued-recall');
  });

  it('descends more than one rung when nothing below has been passed', () => {
    // Barely reachable — `status: 'learning'` catches this first in practice —
    // but the rule is the descent, not a single step.
    const evidence = { recognition: { attempts: 3, correct: 0, lastAt: AT } };
    expect(retrievalModeFor(durable(evidence))).toBe('recognition');
  });

  it('leaves a row written before evidence existed exactly as it was', () => {
    // An absent map is "unknown", never "never produced": nobody's ladder may
    // reset because they upgraded.
    expect(retrievalModeFor(durable())).toBe('production');
  });

  it('still holds a lapsed item at recognition whatever its evidence says', () => {
    const lapsed: SubjectProgress = {
      ...durable({ recognition: passed(), 'cued-recall': passed() }),
      status: 'learning',
    };
    expect(retrievalModeFor(lapsed)).toBe('recognition');
  });
});
