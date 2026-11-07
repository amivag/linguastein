/**
 * Typing the answer, and how close is close enough.
 *
 * Stage A of `docs/tasks/typed-production.md`. Six kinds shipped before this and
 * none of them asked the learner to supply the words — they pick from four,
 * arrange the ones they are given, or grade themselves — so `type-it` is the
 * first machine-checked production evidence in the app.
 *
 * The interesting half is the middle verdict. A missing accent is neither a
 * right answer nor a wrong one, and which marks are accents is a question about
 * the language rather than about the characters.
 */

import { describe, expect, it } from 'vitest';
import type { ItemId, LearningItem } from '../../src/domain/content';
import {
  compareTyped,
  ExerciseEngine,
  gradeExercise,
  isSelfRated,
  MODE_KINDS,
  modeOfKind,
  TYPE_IT_MAX_WORDS,
  typeItGenerator,
  type GenerationContext,
  type TypeItExercise,
} from '../../src/domain/exercises';
import { seededRng } from '../../src/utils/random';
import { id, testRepository } from '../fixtures/pack';

const repository = testRepository();
const engine = new ExerciseEngine();
const context: GenerationContext = { repository, referenceLanguage: 'en', rng: seededRng(1) };

const itemOf = (local: string) => {
  const item = repository.getItem(id<ItemId>(`test-es:item:${local}`));
  if (!item) throw new Error(`missing fixture item ${local}`);
  return item;
};

const typeIt = (local: string): TypeItExercise => {
  const exercise = engine.generate(itemOf(local), 'type-it', context);
  if (exercise?.kind !== 'type-it') throw new Error(`no type-it exercise for ${local}`);
  return exercise;
};

/**
 * A card with an accent in its answer, built rather than drawn from the fixture.
 *
 * Grading is a pure function of the exercise, and the verdicts worth asserting
 * are about specific spellings — pinning them to whichever fixture sentence
 * happens to carry an acute would make the test about the fixture.
 */
const accented: TypeItExercise = {
  ...typeIt('001'),
  prompt: 'I spoke to my sister yesterday.',
  answer: 'Ayer hablé con mi hermana.',
};

describe('comparing a typed answer', () => {
  it('ignores case and punctuation, which the card is not asking about', () => {
    expect(compareTyped('tengo que trabajar', 'Tengo que trabajar.', 'es')).toBe('exact');
    expect(compareTyped('¿Tienes tiempo?', 'Tienes tiempo', 'es')).toBe('exact');
  });

  it('calls a missing accent near rather than wrong', () => {
    expect(compareTyped('hable', 'hablé', 'es')).toBe('near');
    expect(compareTyped('Ayer hable con el', 'Ayer hablé con él', 'es')).toBe('near');
  });

  it('does not let an accent-blind comparison swallow a letter', () => {
    // The bug this is built around: stripping every combining mark turns `año`
    // into `ano`, a different word — which is the accident
    // `src/languages/es/orthography.ts` exists to record. A collator knows the
    // difference because CLDR does, so the engine does not have to.
    expect(compareTyped('ano', 'año', 'es')).toBe('wrong');
    expect(compareTyped('cana', 'caña', 'es')).toBe('wrong');
  });

  it('is wrong when the words differ at all', () => {
    expect(compareTyped('Tengo que comer', 'Tengo que trabajar', 'es')).toBe('wrong');
    expect(compareTyped('Tengo trabajar', 'Tengo que trabajar', 'es')).toBe('wrong');
    expect(compareTyped('', 'Tengo que trabajar', 'es')).toBe('wrong');
  });

  it('compares the marks as written when no language is known', () => {
    // Strict rather than wrong: without a locale there is nothing that can say
    // which marks are decorative, so none are assumed to be.
    expect(compareTyped('hable', 'hablé', undefined)).toBe('wrong');
    expect(compareTyped('hablé', 'hablé', undefined)).toBe('exact');
  });
});

describe('grading a typed answer', () => {
  it('carries the language its answer is written in', () => {
    const exercise = typeIt('001');

    expect(exercise.answer).toBe(itemOf('001').text);
    expect(exercise.answerLanguage).toBe('es');
  });

  it('grades an exact answer as a pass', () => {
    const result = gradeExercise(accented, { value: 'ayer hablé con mi hermana' });

    expect(result?.correct).toBe(true);
    expect(result?.verdict).toBe('exact');
    expect(result?.grade).not.toBe('again');
  });

  it('counts a near answer but schedules it sooner', () => {
    const result = gradeExercise(accented, { value: 'Ayer hable con mi hermana.' });

    expect(result?.verdict).toBe('near');
    expect(result?.correct).toBe(true);
    expect(result?.grade).toBe('hard');
  });

  it('grades a wrong answer as again, and says what was wanted', () => {
    const result = gradeExercise(accented, { value: 'no tengo ni idea' });

    expect(result?.correct).toBe(false);
    expect(result?.grade).toBe('again');
    expect(result?.verdict).toBe('wrong');
    expect(result?.expected).toBe(accented.answer);
  });

  it('is graded by the engine rather than by the learner', () => {
    expect(isSelfRated('type-it')).toBe(false);
  });
});

/**
 * A sentence of a given length, sharing item 001's identity.
 *
 * Built field by field rather than spread from the fixture, because the fixture
 * item is tokenised and `words()` prefers tokens over text — a synthetic
 * sentence that inherited them would be measured at the fixture's three words
 * however long its text was, and the ceiling test would pass while testing
 * nothing. The id is kept, because `supports` also requires a translation and a
 * synthetic id has none.
 */
function sentenceOf(words: number): LearningItem {
  const base = itemOf('001');
  return {
    id: base.id,
    pack: base.pack,
    type: 'sentence',
    level: 'a1',
    text: `${Array.from({ length: words }, () => 'palabra').join(' ')}.`,
  };
}

describe('where the kind sits', () => {
  it('is production evidence, and leads the mode', () => {
    expect(modeOfKind('type-it')).toBe('production');
    // First, because it is the only member whose answer the app checks: the
    // other two record what the learner says about their answer.
    expect(MODE_KINDS.production[0]).toBe('type-it');
  });

  /**
   * The ceiling, at the boundary.
   *
   * Built rather than filtered out of the fixture, which holds seven sentences
   * of at most three words: a loop over "every fixture item longer than eight"
   * runs zero times and passes, which is a test that asserts nothing while
   * looking like it asserts the feature.
   */
  it('stops offering the kind past the length ceiling', () => {
    expect(typeItGenerator.supports(sentenceOf(TYPE_IT_MAX_WORDS), context)).toBe(true);
    expect(typeItGenerator.supports(sentenceOf(TYPE_IT_MAX_WORDS + 1), context)).toBe(false);
  });

  it('still offers something to practise an over-long item with', () => {
    // The ceiling withholds one kind, never the item: an eleven-word sentence is
    // still a sentence somebody is learning.
    const kinds = engine.supportedKinds(sentenceOf(11), context);
    expect(kinds).not.toContain('type-it');
    expect(kinds.length).toBeGreaterThan(0);
  });
});
