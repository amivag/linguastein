import { describe, expect, it } from 'vitest';
import { ExerciseEngine, gradeExercise, type GenerationContext } from '../../src/domain/exercises';
import type { ItemId } from '../../src/domain/content';
import { seededRng } from '../../src/utils/random';
import { id, testRepository } from '../fixtures/pack';

const repository = testRepository();
const engine = new ExerciseEngine();

const context = (seed = 1): GenerationContext => ({
  repository,
  referenceLanguage: 'en',
  rng: seededRng(seed),
});

const itemOf = (local: string) => {
  const item = repository.getItem(id<ItemId>(`test-es:item:${local}`));
  if (!item) throw new Error(`missing fixture item ${local}`);
  return item;
};

describe('exercise generation', () => {
  it('derives several exercise kinds from one item', () => {
    const kinds = engine.supportedKinds(itemOf('001'), context());
    expect(kinds).toContain('listen-repeat');
    expect(kinds).toContain('reveal');
    expect(kinds).toContain('think-say');
    expect(kinds).toContain('multiple-choice');
  });

  it('builds multiple choice with exactly one correct answer and plausible distractors', () => {
    const exercise = engine.generate(itemOf('004'), 'multiple-choice', context());
    expect(exercise?.kind).toBe('multiple-choice');
    if (exercise?.kind !== 'multiple-choice') return;

    expect(exercise.prompt).toBe('cerveza');
    expect(exercise.choices).toHaveLength(4);
    expect(exercise.choices.filter((choice) => choice.correct)).toHaveLength(1);
    expect(exercise.choices.find((choice) => choice.correct)?.text).toBe('beer');
    // Distractors are drawn from items of the same type and level.
    expect(new Set(exercise.choices.map((choice) => choice.text)).size).toBe(4);
  });

  it('is deterministic for a given seed', () => {
    const first = engine.generate(itemOf('004'), 'multiple-choice', context(42));
    const second = engine.generate(itemOf('004'), 'multiple-choice', context(42));
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('skips think-say when no reference translation exists', () => {
    const untranslated = { ...itemOf('001'), id: id<ItemId>('test-es:item:404') };
    expect(engine.generate(untranslated, 'think-say', context())).toBeNull();
  });

  it('blanks a verb token and offers other forms of the same verb', () => {
    const exercise = engine.generate(itemOf('001'), 'cloze-choice', context());
    expect(exercise?.kind).toBe('cloze-choice');
    if (exercise?.kind !== 'cloze-choice') return;

    expect(exercise.prompt).toBe('___ que trabajar.');
    expect(exercise.choices.find((choice) => choice.correct)?.text).toBe('Tengo');
    expect(exercise.choices.length).toBeGreaterThan(1);
  });

  it('falls back through the preferred kinds', () => {
    const exercise = engine.generateFirst(itemOf('002'), ['cloze-choice', 'reveal'], context());
    expect(exercise?.kind).toBe('reveal');
  });
});

describe('grading', () => {
  it('grades multiple choice and reports the expected answer', () => {
    const exercise = engine.generate(itemOf('004'), 'multiple-choice', context());
    if (exercise?.kind !== 'multiple-choice') throw new Error('expected multiple-choice');

    const correct = exercise.choices.find((choice) => choice.correct)!;
    const wrong = exercise.choices.find((choice) => !choice.correct)!;

    expect(gradeExercise(exercise, { value: correct.id, latencyMs: 1000 })).toEqual({
      correct: true,
      grade: 'easy',
      expected: 'beer',
    });
    expect(gradeExercise(exercise, { value: wrong.id })?.grade).toBe('again');
  });

  it('grades tap-to-build ignoring case and accents', () => {
    const exercise = engine.generate(itemOf('001'), 'tap-to-build', context());
    if (exercise?.kind !== 'tap-to-build') throw new Error('expected tap-to-build');

    expect(gradeExercise(exercise, { value: [...exercise.solution] })?.correct).toBe(true);
    expect(gradeExercise(exercise, { value: ['que', 'Tengo'] })?.correct).toBe(false);
  });

  it('leaves self-rated exercises to the learner', () => {
    const exercise = engine.generate(itemOf('001'), 'listen-repeat', context());
    expect(gradeExercise(exercise!, { value: 'anything' })).toBeNull();
  });
});
