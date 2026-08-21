import { describe, expect, it } from 'vitest';
import { ExerciseEngine, gradeExercise, type GenerationContext } from '../../src/domain/exercises';
import { ContentRepository } from '../../src/domain/content';
import type { ContentPack, ItemId, LearningItem, PackId } from '../../src/domain/content';
import { seededRng } from '../../src/utils/random';
import { id, TEST_PACK, testRepository } from '../fixtures/pack';

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

const ASK_PACK = id<PackId>('ask-es');

interface Row {
  readonly es: string;
  readonly en: string;
  readonly topic: string;
}

/**
 * A pack shaped for one property: how many of its sentences are questions.
 *
 * The shipped pack is 76 questions in 592 sentences, spread over nineteen
 * topics, so a topic holding four of them is unusual and a topic holding one is
 * the normal case. Both shapes are spelled out per case rather than shared, and
 * the item under test is always the first row.
 */
function asking(rows: readonly Row[]): { repository: ContentRepository; target: LearningItem } {
  const items: LearningItem[] = rows.map((row, index) => ({
    id: id<ItemId>(`ask-es:item:${index}`),
    pack: ASK_PACK,
    type: 'sentence',
    text: row.es,
    level: 'a1',
    topics: [row.topic],
  }));
  const pack: ContentPack = {
    manifest: {
      id: ASK_PACK,
      name: 'Asking',
      targetLanguage: 'es',
      version: '1.0.0',
      files: [{ kind: 'items', path: 'items.jsonl' }],
    },
    items,
    lexemes: [],
    senses: [],
    verbForms: [],
    skills: [],
    translations: rows.map((row, index) => ({
      ref: `ask-es:item:${index}`,
      lang: 'en',
      text: row.en,
    })),
    passages: [],
    audio: [],
  };
  return { repository: ContentRepository.from([pack]), target: items[0] as LearningItem };
}

function choicesFor(rows: readonly Row[], seed = 1) {
  const { repository, target } = asking(rows);
  const exercise = new ExerciseEngine().generate(target, 'multiple-choice', {
    repository,
    referenceLanguage: 'en',
    rng: seededRng(seed),
  });
  if (exercise?.kind !== 'multiple-choice') throw new Error('expected multiple choice');
  return exercise.choices;
}

const HEALTH_STATEMENTS: readonly Row[] = [
  { es: 'Tomo medicina todos los días.', en: 'I take medicine every day.', topic: 'health' },
  { es: 'No pude dormir por la noche.', en: "I couldn't sleep at night.", topic: 'health' },
  {
    es: 'Me dio medicina y ahora estoy mejor.',
    en: "He gave me some medicine and now I'm better.",
    topic: 'health',
  },
];

const OTHER_QUESTIONS: readonly Row[] = [
  { es: '¿Dónde está la estación?', en: 'Where is the station?', topic: 'travel' },
  { es: '¿Cuánto cuesta el billete?', en: 'How much is the ticket?', topic: 'travel' },
  { es: '¿Puedo pagar con tarjeta?', en: 'Can I pay by card?', topic: 'shopping' },
];

const FEVER: Row = { es: '¿Tiene fiebre?', en: 'Do you have a fever?', topic: 'health' };

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

  it('draws distractors from the same theme, so the question has to be read', () => {
    // `cerveza` offered against "June", "name" and "hot" is answerable without
    // knowing any Spanish — the only food word wins. Against the other
    // food-drink cards it is a real question.
    const exercise = engine.generate(itemOf('004'), 'multiple-choice', context());
    if (exercise?.kind !== 'multiple-choice') throw new Error('expected multiple choice');

    const distractors = exercise.choices.filter((choice) => !choice.correct);
    const offTopic = distractors.filter((choice) => {
      const source = choice.sourceItem ? repository.getItem(choice.sourceItem) : undefined;
      return !source?.topics?.includes('food-drink');
    });
    expect(offTopic.map((choice) => choice.text)).toEqual([]);
  });

  /**
   * The bug this closes: `¿Tiene fiebre?` offered against three statements is
   * answered by whoever spots the only `?`, without reading a word of Spanish.
   */
  it('answers a question with questions, so the punctuation is not the answer', () => {
    const choices = choicesFor([FEVER, ...HEALTH_STATEMENTS, ...OTHER_QUESTIONS]);

    expect(choices).toHaveLength(4);
    expect(choices.every((choice) => choice.text.endsWith('?'))).toBe(true);
  });

  /**
   * Form outranks theme deliberately. A question from another topic still has
   * to be read; a statement from this one hands the answer over.
   */
  it('takes a question from another theme over a statement from this one', () => {
    const choices = choicesFor([FEVER, ...HEALTH_STATEMENTS, ...OTHER_QUESTIONS]);
    const distractors = choices.filter((choice) => !choice.correct);

    expect(distractors.map((choice) => choice.text).sort()).toEqual([
      'Can I pay by card?',
      'How much is the ticket?',
      'Where is the station?',
    ]);
  });

  it('prefers a question from the same theme when the pack has them', () => {
    const choices = choicesFor([
      FEVER,
      { es: '¿Le duele la cabeza?', en: 'Does your head hurt?', topic: 'health' },
      { es: '¿Necesita una receta?', en: 'Do you need a prescription?', topic: 'health' },
      { es: '¿Puede respirar bien?', en: 'Can you breathe well?', topic: 'health' },
      ...HEALTH_STATEMENTS,
      ...OTHER_QUESTIONS,
    ]);
    const distractors = choices.filter((choice) => !choice.correct);

    expect(distractors.map((choice) => choice.text).sort()).toEqual([
      'Can you breathe well?',
      'Do you need a prescription?',
      'Does your head hurt?',
    ]);
  });

  /**
   * The other free giveaway: one answer twice the length of the rest is found
   * by looking, not by reading. It ranks below theme, so it only decides
   * between choices that are already equally plausible.
   */
  it('leaves out the one answer that is visibly longer than the rest', () => {
    const choices = choicesFor([
      FEVER,
      { es: '¿Le duele la cabeza?', en: 'Does your head hurt?', topic: 'health' },
      { es: '¿Necesita una receta?', en: 'Do you need a prescription?', topic: 'health' },
      { es: '¿Puede respirar bien?', en: 'Can you breathe well?', topic: 'health' },
      {
        es: '¿Ha tomado algo para la fiebre esta mañana o esta tarde?',
        en: 'Have you taken anything for the fever this morning or this afternoon?',
        topic: 'health',
      },
    ]);

    expect(choices.map((choice) => choice.text)).not.toContain(
      'Have you taken anything for the fever this morning or this afternoon?',
    );
  });

  /**
   * A pack with one question in it still has to ask something. Four statements
   * is a worse question than four matched ones, and a better one than two.
   */
  it('fills the choices from statements when the pack has no other question', () => {
    const choices = choicesFor([FEVER, ...HEALTH_STATEMENTS]);

    expect(choices).toHaveLength(4);
    expect(choices.filter((choice) => choice.correct)).toHaveLength(1);
  });

  it('widens the pool rather than shrinking the question on a thin topic', () => {
    // `everyday` has too few cards to fill four choices. Starving them would
    // leave a two-option question, which is easier than an off-topic one.
    const exercise = engine.generate(itemOf('002'), 'multiple-choice', context());
    if (exercise?.kind !== 'multiple-choice') throw new Error('expected multiple choice');
    expect(exercise.choices).toHaveLength(4);
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

  /**
   * A blank is only a question about grammar if every option could stand in the
   * gap. `Tengo` offered against `teniendo` and `tenido` is answerable from
   * shape alone — the same "a choice a learner can eliminate without knowing any
   * Spanish is not a choice" rule the multiple-choice distractors follow, which
   * this generator was sampling at random and ignoring.
   */
  const clozeChoices = (local: string, seed: number): readonly string[] => {
    const exercise = engine.generate(itemOf(local), 'cloze-choice', context(seed));
    if (exercise?.kind !== 'cloze-choice') throw new Error('expected a cloze');
    return exercise.choices.filter((choice) => !choice.correct).map((choice) => choice.text);
  };

  it('never offers a non-finite form against a finite blank', () => {
    // `tener` has a gerund and a participle in the fixture, and four rival
    // finite forms. Every seed must reach for the finite ones first.
    for (let seed = 1; seed <= 25; seed += 1) {
      expect(clozeChoices('001', seed)).not.toContain('teniendo');
      expect(clozeChoices('001', seed)).not.toContain('tenido');
    }
  });

  it('prefers forms that differ from the answer on one axis only', () => {
    // `Tengo` is 1st person singular present. `tienes`, `tiene` and `tenemos`
    // vary agreement alone and `tuve` varies tense alone — four forms for three
    // slots — while `tuvo` varies both at once. So it loses on every seed, not
    // just a lucky one: the ranking is a property, and the seed only decides
    // which three of the four equals are dealt.
    for (let seed = 1; seed <= 25; seed += 1) {
      const ranked = clozeChoices('001', seed);
      expect(ranked).toHaveLength(3);
      expect(ranked).not.toContain('tuvo');
    }
  });

  it('varies which of the equally good choices it deals', () => {
    // Shuffled before it is sorted, so the same sentence is not the same card
    // twice. Without this the four-for-three tie would always drop `tenemos`.
    const seen = new Set<string>();
    for (let seed = 1; seed <= 25; seed += 1) {
      for (const choice of clozeChoices('001', seed)) seen.add(choice);
    }

    expect([...seen].sort()).toEqual(['tenemos', 'tiene', 'tienes', 'tuve']);
  });

  it('still fills a card when the good choices run out', () => {
    // A score, not a filter cascade: too few choices hands the answer over just
    // as surely as bad ones, so a thin form table must still produce a card.
    const thin = ContentRepository.from([
      {
        ...TEST_PACK,
        verbForms: TEST_PACK.verbForms.filter((form) => form.morph.verbForm !== 'finite'),
      },
    ]);
    const exercise = new ExerciseEngine().generate(itemOf('001'), 'cloze-choice', {
      repository: thin,
      referenceLanguage: 'en',
      rng: seededRng(1),
    });

    if (exercise?.kind !== 'cloze-choice') throw new Error('expected a cloze');
    expect(exercise.choices.map((choice) => choice.text).sort()).toEqual([
      'Tengo',
      'tenido',
      'teniendo',
    ]);
  });

  /**
   * A comma is not a word, and a full stop is a tile you cannot get wrong. Both
   * were dealt as tiles, so `Abre la boca por favor` — the sentence, correctly
   * ordered — was marked wrong for the punctuation the learner left in the tray.
   */
  it('builds a sentence out of words, never punctuation', () => {
    const exercise = engine.generate(itemOf('001'), 'tap-to-build', context());
    if (exercise?.kind !== 'tap-to-build') throw new Error('expected tap-to-build');

    expect([...exercise.solution]).toEqual(['Tengo', 'que', 'trabajar']);
    expect(exercise.parts).toHaveLength(3);
  });

  it('drops punctuation from an untokenised sentence too', () => {
    const { repository, target } = asking([
      { es: 'Abre la boca, por favor.', en: 'Open your mouth, please.', topic: 'health' },
    ]);
    const exercise = new ExerciseEngine().generate(target, 'tap-to-build', {
      repository,
      referenceLanguage: 'en',
      rng: seededRng(1),
    });
    if (exercise?.kind !== 'tap-to-build') throw new Error('expected tap-to-build');

    expect([...exercise.solution]).toEqual(['Abre', 'la', 'boca', 'por', 'favor']);
    expect(gradeExercise(exercise, { value: ['Abre', 'la', 'boca', 'por', 'favor'] })).toEqual({
      correct: true,
      grade: 'good',
      expected: 'Abre la boca, por favor.',
    });
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

  it('grades tap-to-build ignoring case, accents and punctuation', () => {
    const exercise = engine.generate(itemOf('001'), 'tap-to-build', context());
    if (exercise?.kind !== 'tap-to-build') throw new Error('expected tap-to-build');

    expect(gradeExercise(exercise, { value: [...exercise.solution] })?.correct).toBe(true);
    expect(gradeExercise(exercise, { value: ['tengo', 'que', 'trabajar.'] })?.correct).toBe(true);
    expect(gradeExercise(exercise, { value: ['que', 'Tengo'] })?.correct).toBe(false);
  });

  /** The sentence as written, not the graded words with spaces between them. */
  it('shows the answer punctuated, however it was graded', () => {
    const exercise = engine.generate(itemOf('001'), 'tap-to-build', context());
    if (exercise?.kind !== 'tap-to-build') throw new Error('expected tap-to-build');

    expect(gradeExercise(exercise, { value: ['que'] })?.expected).toBe('Tengo que trabajar.');
  });

  it('leaves self-rated exercises to the learner', () => {
    const exercise = engine.generate(itemOf('001'), 'listen-repeat', context());
    expect(gradeExercise(exercise!, { value: 'anything' })).toBeNull();
  });
});
