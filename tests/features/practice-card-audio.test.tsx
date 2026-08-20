/**
 * Two things a practice card owes a learner: the phrase can be heard, and its
 * words can be opened. Quick practice is mostly multiple choice, cloze and
 * tap-to-build, and those three cards had neither — playback was wired to the
 * self-rated cards only, and tap-to-build never showed the sentence at all.
 *
 * Playback speaks the item's own text, so a card is only allowed to offer it
 * where that text is not the answer. These cases pin both halves of that: the
 * button is there where hearing reveals nothing, and absent where it would.
 *
 * The runner is stubbed rather than driven, because what changed is what a card
 * renders for a given answer state — `practice-flow` covers the real sequence.
 */

import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ExerciseEngine, type Exercise, type ExerciseKind } from '../../src/domain/exercises';
import type { GradeResult } from '../../src/domain/exercises';
import { ExerciseView } from '../../src/features/practice/ExerciseView';
import { SessionScreen } from '../../src/features/practice/SessionScreen';
import type { SessionRunner } from '../../src/features/practice/useSessionRunner';
import type { ItemId } from '../../src/domain/content';
import { seededRng } from '../../src/utils/random';
import { id, testRepository } from '../fixtures/pack';
import { renderWithServices } from '../fixtures/services';

/** `Tengo que trabajar.` — tokenised, and the one item all three kinds support. */
const SENTENCE = id<ItemId>('test-es:item:001');

function card(kind: ExerciseKind, options: { answered: boolean }) {
  const repository = testRepository();
  const item = repository.getItem(SENTENCE);
  if (!item) throw new Error(`missing fixture item ${SENTENCE}`);

  const exercise = new ExerciseEngine().generate(item, kind, {
    repository,
    referenceLanguage: 'en',
    rng: seededRng(7),
  });
  if (!exercise) throw new Error(`fixture item does not support ${kind}`);

  return renderWithServices(
    <ExerciseView exercise={exercise} runner={stubRunner(exercise, options.answered)} />,
  );
}

function stubRunner(exercise: Exercise, answered: boolean): SessionRunner {
  const result: GradeResult | null = answered
    ? { correct: true, grade: 'good', expected: exercise.item.text }
    : null;

  return {
    status: 'active',
    startedAt: 0,
    durationMs: null,
    exercise,
    item: exercise.item,
    index: 0,
    total: 1,
    stats: { answered: answered ? 1 : 0, correct: answered ? 1 : 0 },
    outcome: { advanced: [], lapsed: [] },
    tracked: true,
    lastResult: result,
    submitAnswer: () => result,
    submitGrade: () => {},
    next: () => {},
    previous: () => {},
    restart: () => {},
  };
}

const playback = () => screen.queryByRole('button', { name: 'Play audio' });
const firstWord = () => screen.queryByRole('button', { name: 'About “Tengo”' });

describe('hearing and opening a graded card', () => {
  /**
   * The Spanish is on the card and the choices are meanings, so playback tells
   * the learner nothing the card is not already showing — and hearing a phrase
   * before deciding what it means is the whole premise of an audio-first app.
   */
  it('lets a multiple-choice card be heard before it is answered', () => {
    card('multiple-choice', { answered: false });

    expect(playback()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play slowly' })).toBeInTheDocument();
    // The words open too. What the card grades is the *meaning*, and that is
    // what the sheet holds back — see word-info for the sheet's own half.
    expect(firstWord()).toBeInTheDocument();
  });

  /** The missing word is the answer, and the audio would simply say it. */
  it('holds a cloze card silent until the blank is filled', () => {
    card('cloze-choice', { answered: false });
    expect(playback()).not.toBeInTheDocument();
  });

  it('opens a cloze card up once it is answered', () => {
    card('cloze-choice', { answered: true });

    expect(playback()).toBeInTheDocument();
    expect(firstWord()).toBeInTheDocument();
  });

  /** Speaking the sentence would read the parts out in the right order. */
  it('holds a tap-to-build card silent and shut while it is being built', () => {
    card('tap-to-build', { answered: false });

    expect(playback()).not.toBeInTheDocument();
    expect(firstWord()).not.toBeInTheDocument();
  });

  it('shows the built sentence to hear and to tap once it is checked', () => {
    card('tap-to-build', { answered: true });

    expect(playback()).toBeInTheDocument();
    expect(firstWord()).toBeInTheDocument();
  });
});

describe('Quick practice', () => {
  /**
   * The composer starts every unseen item at recognition, which in this preset
   * is multiple choice — so the card that had no playback was the card Quick
   * practice opens with.
   */
  it('offers playback on the card it opens with', async () => {
    renderWithServices(<SessionScreen />, { route: '/session?preset=quick&size=items:1' });

    expect(await screen.findByRole('button', { name: 'Play audio' })).toBeInTheDocument();
  });
});
