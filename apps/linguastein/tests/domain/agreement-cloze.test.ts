/**
 * The cloze, asking about agreement rather than only about conjugation.
 *
 * `blankCandidate` blanked a verb and nothing else for as long as the exercise
 * existed, so the commonest beginner error in Spanish — which article, which
 * demonstrative, which quantifier — was the one thing the pack could not ask.
 * The blocker was never the generator: the closed-class paradigms were indexed
 * so a sentence linked `estas`, and never *recorded*, so `formsOf` came back
 * empty and there were no alternatives to offer.
 *
 * Every case below is a way the exercise can be wrong rather than merely absent,
 * and each one is a question with more than one right answer — which is worse
 * than no question. They are asserted against hand-built packs rather than the
 * shipped one because each needs a specific shape, and against `pos`/`morph`
 * written by hand for the same reason: this tests the rule, not the dataset.
 */

import { describe, expect, it } from 'vitest';
import { ContentRepository } from '../../src/domain/content';
import type {
  ContentPack,
  InflectedForm,
  ItemId,
  LearningItem,
  LexemeId,
  PackId,
  Token,
} from '../../src/domain/content';
import { ExerciseEngine } from '../../src/domain/exercises';
import { seededRng } from '../../src/utils/random';
import { id } from '../fixtures/pack';

const PACK = id<PackId>('agree-es');
const ARTICLE = id<LexemeId>('agree-es:lexeme:el-det');

/** The four forms of the definite article, as the language module derives them. */
const ARTICLE_FORMS: readonly InflectedForm[] = [
  {
    id: id('agree-es:form:el-c-msg'),
    lexeme: ARTICLE,
    form: 'el',
    morph: { gender: 'masculine', number: 'singular' },
  },
  {
    id: id('agree-es:form:el-c-mpl'),
    lexeme: ARTICLE,
    form: 'los',
    morph: { gender: 'masculine', number: 'plural' },
  },
  {
    id: id('agree-es:form:el-c-fsg'),
    lexeme: ARTICLE,
    form: 'la',
    morph: { gender: 'feminine', number: 'singular' },
  },
  {
    id: id('agree-es:form:el-c-fpl'),
    lexeme: ARTICLE,
    form: 'las',
    morph: { gender: 'feminine', number: 'plural' },
  },
];

const article = (text: string): Token => ({
  id: 't1',
  text,
  pos: 'DET',
  lemma: 'el',
  lexeme: ARTICLE,
  morph: articleMorph(text),
});

function articleMorph(text: string) {
  const gender = text === 'la' || text === 'las' ? 'feminine' : 'masculine';
  const number = text === 'los' || text === 'las' ? 'plural' : 'singular';
  return { gender, number } as const;
}

interface NounSpec {
  readonly text: string;
  readonly gender: 'masculine' | 'feminine';
  readonly number: 'singular' | 'plural';
  /** Extra forms, for a noun whose spelling is both numbers (`lunes`). */
  readonly alsoPlural?: boolean;
}

/**
 * A one-sentence pack: an article, then a noun, then a verb with nothing to
 * conjugate against, so the only blank on offer is the agreement.
 */
function packWith(
  determiner: Token,
  noun: NounSpec,
  trailing: readonly Token[] = [],
): { repository: ContentRepository; target: LearningItem } {
  const nounLexeme = id<LexemeId>(`agree-es:lexeme:${noun.text}`);
  const nounToken: Token = {
    id: 't2',
    text: noun.text,
    pos: 'NOUN',
    lemma: noun.text,
    lexeme: nounLexeme,
    morph: { gender: noun.gender, number: noun.number },
  };
  const tokens = [determiner, nounToken, ...trailing];
  const item: LearningItem = {
    id: id<ItemId>('agree-es:item:001'),
    pack: PACK,
    type: 'sentence',
    text: tokens.map((token) => token.text).join(' '),
    level: 'a1',
    tokens,
  };

  const nounForms: InflectedForm[] = [
    {
      id: id(`agree-es:form:${noun.text}-n-sg`),
      lexeme: nounLexeme,
      form: noun.text,
      morph: { gender: noun.gender, number: 'singular' },
    },
    ...(noun.alsoPlural
      ? [
          {
            id: id(`agree-es:form:${noun.text}-n-pl`),
            lexeme: nounLexeme,
            form: noun.text,
            morph: { gender: noun.gender, number: 'plural' as const },
          } as InflectedForm,
        ]
      : []),
  ];

  const pack: ContentPack = {
    manifest: {
      id: PACK,
      name: 'Agreement',
      targetLanguage: 'es',
      version: '1.0.0',
      files: [{ kind: 'items', path: 'items.jsonl' }],
    },
    items: [item],
    lexemes: [
      { id: ARTICLE, lemma: 'el', pos: 'DET', level: 'a1' },
      { id: nounLexeme, lemma: noun.text, pos: 'NOUN', level: 'a1' },
    ],
    senses: [],
    forms: [...ARTICLE_FORMS, ...nounForms],
    skills: [],
    translations: [{ ref: 'agree-es:item:001', lang: 'en', text: 'the thing' }],
    passages: [],
    audio: [],
  };

  return { repository: ContentRepository.from([pack]), target: item };
}

/** The cloze this sentence produces at one seed, or `null` for none. */
function clozeOf(built: { repository: ContentRepository; target: LearningItem }, seed = 1) {
  const exercise = new ExerciseEngine().generate(built.target, 'cloze-choice', {
    repository: built.repository,
    referenceLanguage: 'en',
    rng: seededRng(seed),
  });
  return exercise?.kind === 'cloze-choice' ? exercise : null;
}

describe('the agreement cloze', () => {
  it('asks which article the noun takes, with exactly one right answer', () => {
    const cloze = clozeOf(
      packWith(article('las'), { text: 'casas', gender: 'feminine', number: 'plural' }),
    );
    expect(cloze).not.toBeNull();
    expect(cloze!.prompt).toBe('___ casas');

    const correct = cloze!.choices.filter((choice) => choice.correct);
    expect(correct.map((choice) => choice.text)).toEqual(['las']);
    // And the rest are wrong *because of the noun*, which is the only thing that
    // makes this gradeable: every one disagrees with `casas` on gender or number.
    for (const choice of cloze!.choices.filter((c) => !c.correct)) {
      expect(articleMorph(choice.text)).not.toEqual({ gender: 'feminine', number: 'plural' });
    }
  });

  it('offers no blank where the noun is both singular and plural', () => {
    // `el lunes` and `los lunes` are both right, so there is nothing to grade.
    // The noun carries a number, which is what makes this the dangerous case:
    // every other check would pass it.
    const built = packWith(article('el'), {
      text: 'lunes',
      gender: 'masculine',
      number: 'singular',
      alsoPlural: true,
    });
    expect(clozeOf(built)).toBeNull();
  });

  it('offers no blank where the article and its noun already disagree', () => {
    // `el agua` — a feminine noun that takes the masculine article. Spanish's own
    // exception, and the rule this exercise teaches is false for it, so it must
    // be skipped rather than graded either way.
    const built = packWith(article('el'), { text: 'agua', gender: 'feminine', number: 'singular' });
    expect(clozeOf(built)).toBeNull();
  });

  it('offers no blank where nothing follows to settle it', () => {
    const alone: Token = {
      id: 't1',
      text: 'Muchas',
      pos: 'DET',
      lemma: 'mucho',
      lexeme: ARTICLE,
      morph: { gender: 'feminine', number: 'plural' },
    };
    const item: LearningItem = {
      id: id<ItemId>('agree-es:item:001'),
      pack: PACK,
      type: 'sentence',
      text: 'Muchas',
      level: 'a1',
      tokens: [alone],
    };
    const pack: ContentPack = {
      manifest: {
        id: PACK,
        name: 'Agreement',
        targetLanguage: 'es',
        version: '1.0.0',
        files: [{ kind: 'items', path: 'items.jsonl' }],
      },
      items: [item],
      lexemes: [{ id: ARTICLE, lemma: 'el', pos: 'DET', level: 'a1' }],
      senses: [],
      forms: [...ARTICLE_FORMS],
      skills: [],
      translations: [{ ref: 'agree-es:item:001', lang: 'en', text: 'many' }],
      passages: [],
      audio: [],
    };
    expect(clozeOf({ repository: ContentRepository.from([pack]), target: item })).toBeNull();
  });

  it('looks past an adjective to reach the noun', () => {
    const adjective: Token = {
      id: 't3',
      text: 'buenas',
      pos: 'ADJ',
      lemma: 'bueno',
      morph: { gender: 'feminine', number: 'plural' },
    };
    // Written in the order Spanish puts them — `las buenas noticias` — so the
    // adjective is between the blank and its target.
    const built = packWith(article('las'), {
      text: 'noticias',
      gender: 'feminine',
      number: 'plural',
    });
    const withAdjective = {
      ...built,
      target: {
        ...built.target,
        tokens: [built.target.tokens![0]!, adjective, built.target.tokens![1]!],
      },
    };
    const cloze = clozeOf(withAdjective);
    expect(cloze).not.toBeNull();
    expect(cloze!.choices.filter((choice) => choice.correct).map((c) => c.text)).toEqual(['las']);
  });
});
