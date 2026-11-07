/** "Mastered" is a claim about recall, so it needs evidence of production behind it. */
import { describe, expect, it } from 'vitest';
import type { ItemId } from '../../src/domain/content';
import type { ExerciseKind } from '../../src/domain/exercises';
import {
  recordAttempt,
  replaySubject,
  type Attempt,
  type ReviewGrade,
  type SubjectProgress,
} from '../../src/domain/progress';
import { retrievalModeFor } from '../../src/domain/sessions';
import { gradeExercise, type Exercise } from '../../src/domain/exercises';
import { seededRng } from '../../src/utils/random';
import { id } from '../fixtures/pack';

const ITEM = id<ItemId>('test-es:item:001');
const START = Date.UTC(2026, 0, 1);

/** Each answer lands on the day it falls due, as a learner keeping up would. */
function practise(steps: readonly (readonly [ExerciseKind, ReviewGrade])[]) {
  const rng = seededRng(1);
  const attempts: Attempt[] = [];
  let progress: SubjectProgress | undefined;
  let now = START;
  for (const [exerciseKind, grade] of steps) {
    if (progress?.dueAt !== undefined) now = progress.dueAt;
    const recorded = recordAttempt(
      progress,
      { subject: ITEM, exerciseKind, grade },
      now,
      undefined,
      rng,
    );
    progress = recorded.progress;
    attempts.push(recorded.attempt);
  }
  return { progress: progress!, attempts };
}

const CHOICE = ['multiple-choice', 'good'] as const;

describe('reaching mastered', () => {
  it('is not possible on recognition alone', () => {
    const { progress } = practise([CHOICE, CHOICE, CHOICE, CHOICE, CHOICE]);

    expect(progress.stability).toBeGreaterThan(21);
    expect(progress.status).toBe('review');
  });

  it('is not possible on cued recall either', () => {
    const { progress } = practise([CHOICE, CHOICE, ['cloze-choice', 'good'], CHOICE, CHOICE]);

    expect(progress.status).toBe('review');
  });

  it('follows the first production answer that passes', () => {
    const { progress } = practise([CHOICE, CHOICE, CHOICE, ['type-it', 'good']]);

    expect(progress.status).toBe('mastered');
  });

  it('does not follow a failed production answer', () => {
    const { progress } = practise([CHOICE, CHOICE, CHOICE, ['type-it', 'again']]);

    expect(progress.status).toBe('learning');
  });

  it('survives later recognition answers, because production was shown', () => {
    const { progress } = practise([CHOICE, CHOICE, CHOICE, ['type-it', 'good'], CHOICE]);

    expect(progress.status).toBe('mastered');
  });

  it('gives the same answer when the row is rebuilt from its log', () => {
    const { progress, attempts } = practise([CHOICE, CHOICE, CHOICE, CHOICE]);

    expect(replaySubject(ITEM, attempts)).toEqual(progress);
  });

  it('keeps the ladder moving, so the capped item is still offered production', () => {
    const { progress } = practise([CHOICE, CHOICE, ['cloze-choice', 'good']]);

    expect(progress.status).toBe('review');
    expect(retrievalModeFor(progress)).toBe('production');
  });
});

describe('an item missed on first sight', () => {
  const missedFirst = [
    ['multiple-choice', 'again'],
    CHOICE,
    CHOICE,
    ['cloze-choice', 'good'],
  ] as const;

  it('stays at cued recall while it is still shaky', () => {
    const { progress } = practise([...missedFirst, CHOICE]);

    expect(progress.difficulty).toBeGreaterThanOrEqual(0.6);
    expect(progress.stability).toBeLessThan(21);
    expect(retrievalModeFor(progress)).toBe('cued-recall');
  });

  it('is offered production once it has held, so mastered stays reachable', () => {
    const { progress } = practise([...missedFirst, CHOICE, CHOICE]);

    expect(progress.difficulty).toBeGreaterThanOrEqual(0.6);
    expect(retrievalModeFor(progress)).toBe('production');
    expect(practise([...missedFirst, CHOICE, CHOICE, ['type-it', 'good']]).progress.status).toBe(
      'mastered',
    );
  });
});

describe('grading a choice', () => {
  const choiceCard = (kind: 'multiple-choice' | 'cloze-choice') =>
    ({
      kind,
      choices: [
        { id: 'right', text: 'beer', correct: true },
        { id: 'wrong', text: 'water', correct: false },
      ],
    }) as unknown as Exercise;

  it.each(['multiple-choice', 'cloze-choice'] as const)(
    'caps a fast correct %s at good, since the answer was on screen',
    (kind) => {
      const result = gradeExercise(choiceCard(kind), { value: 'right', latencyMs: 500 });

      expect(result).toMatchObject({ correct: true, grade: 'good' });
    },
  );

  it('still reads hesitation as hard', () => {
    const result = gradeExercise(choiceCard('multiple-choice'), {
      value: 'right',
      latencyMs: 20_000,
    });

    expect(result?.grade).toBe('hard');
  });

  it('schedules a first correct choice days away rather than weeks', () => {
    const result = gradeExercise(choiceCard('multiple-choice'), { value: 'right', latencyMs: 500 });
    const { progress } = practise([['multiple-choice', result!.grade]]);

    expect(progress.dueAt! - START).toBeLessThanOrEqual(4 * 86_400_000);
  });

  it('leaves a typed answer free to earn easy, because nothing was on screen', () => {
    const typed = {
      kind: 'type-it',
      answer: 'cerveza',
      answerLanguage: 'es',
    } as unknown as Exercise;

    expect(gradeExercise(typed, { value: 'cerveza', latencyMs: 500 })?.grade).toBe('easy');
  });
});
