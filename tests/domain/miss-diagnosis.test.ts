/**
 * Naming the axis a typed answer slipped on.
 *
 * Stage B of `docs/tasks/typed-production.md`. The brief expected this to need a
 * Spanish module, because naming a missed tense sounds like knowing how Spanish
 * conjugates. It does not: the pack ships `InflectedForm` records whose
 * `Morphology` is already language-neutral, and a token already carries the
 * lexeme the build linked it to, so the diagnosis is a lookup and a field
 * comparison. These tests are therefore about the *shape* of the evidence rather
 * than about Spanish, and the same code serves any pack that ships forms.
 *
 * The other half of the job is declining to answer. Every `null` case below is a
 * place where something could be said and would sometimes be wrong.
 */

import { describe, expect, it } from 'vitest';
import {
  ContentRepository,
  type ContentPack,
  type InflectedForm,
  type ItemId,
  type LexemeId,
  type Morphology,
  type PackId,
  type Token,
} from '../../src/domain/content';
import { diagnoseMiss, type TypeItExercise } from '../../src/domain/exercises';
import { id } from '../fixtures/pack';

const PACK = id<PackId>('diag-es');
const HABLAR = id<LexemeId>('diag-es:lexeme:hablar');
const ROJO = id<LexemeId>('diag-es:lexeme:rojo');

const form = (lexeme: LexemeId, text: string, morph: Morphology): InflectedForm => ({
  id: id(`diag-es:form:${text}`),
  lexeme,
  form: text,
  morph,
});

const FORMS: readonly InflectedForm[] = [
  form(HABLAR, 'hablé', { person: 1, number: 'singular', tense: 'preterite', mood: 'indicative' }),
  form(HABLAR, 'hablaste', {
    person: 2,
    number: 'singular',
    tense: 'preterite',
    mood: 'indicative',
  }),
  form(HABLAR, 'hablo', { person: 1, number: 'singular', tense: 'present', mood: 'indicative' }),
  form(HABLAR, 'hablamos', { person: 1, number: 'plural', tense: 'present', mood: 'indicative' }),
  form(ROJO, 'roja', { gender: 'feminine', number: 'singular' }),
  form(ROJO, 'rojo', { gender: 'masculine', number: 'singular' }),
];

const token = (text: string, extra: Partial<Token> = {}): Token => ({
  id: `t${text}`,
  text,
  ...extra,
});

const SPOKE = id<ItemId>('diag-es:item:001');
const HOUSE = id<ItemId>('diag-es:item:002');

function repository(): ContentRepository {
  const pack: ContentPack = {
    manifest: {
      id: PACK,
      name: 'Diagnosis',
      targetLanguage: 'es',
      version: '1.0.0',
      files: [{ kind: 'items', path: 'items.jsonl' }],
    },
    items: [
      {
        id: SPOKE,
        pack: PACK,
        type: 'sentence',
        level: 'a1',
        text: 'Ayer hablé con mi hermana.',
        tokens: [
          token('Ayer', { pos: 'ADV' }),
          token('hablé', { pos: 'VERB', lemma: 'hablar', lexeme: HABLAR }),
          token('con', { pos: 'ADP' }),
          token('mi', { pos: 'DET' }),
          token('hermana', { pos: 'NOUN' }),
          token('.', { pos: 'PUNCT' }),
        ],
      },
      {
        id: HOUSE,
        pack: PACK,
        type: 'sentence',
        level: 'a1',
        text: 'La casa roja.',
        tokens: [
          token('La', { pos: 'DET' }),
          token('casa', { pos: 'NOUN' }),
          token('roja', { pos: 'ADJ', lemma: 'rojo', lexeme: ROJO }),
          token('.', { pos: 'PUNCT' }),
        ],
      },
    ],
    lexemes: [
      { id: HABLAR, lemma: 'hablar', pos: 'VERB' },
      { id: ROJO, lemma: 'rojo', pos: 'ADJ' },
    ],
    senses: [],
    forms: [...FORMS],
    skills: [],
    translations: [
      { ref: SPOKE, lang: 'en', text: 'I spoke to my sister yesterday.' },
      { ref: HOUSE, lang: 'en', text: 'The red house.' },
    ],
    passages: [],
    audio: [],
  };
  return ContentRepository.from([pack]);
}

const repo = repository();

function cardFor(itemId: ItemId): TypeItExercise {
  const item = repo.getItem(itemId);
  if (!item) throw new Error(`missing item ${itemId}`);
  return {
    id: `${itemId}#type-it`,
    kind: 'type-it',
    item,
    prompt: 'prompt',
    answer: item.text,
    answerLanguage: 'es',
  };
}

const spoke = cardFor(SPOKE);
const house = cardFor(HOUSE);
const diagnose = (card: TypeItExercise, written: string) => diagnoseMiss(card, written, repo);

describe('naming what slipped', () => {
  it('names a wrong tense, and shows how each spelling parses', () => {
    const miss = diagnose(spoke, 'Ayer hablo con mi hermana');

    expect(miss?.axis).toBe('tense');
    expect(miss?.written).toBe('hablo');
    expect(miss?.expected).toBe('hablé');
    expect(miss?.writtenGrammar).toBe('1st · sg · present · indicative');
    expect(miss?.expectedGrammar).toBe('1st · sg · preterite · indicative');
    // The values on the named axis, which are what a line of feedback says:
    // the full parse buries the one difference among three things that were right.
    expect(miss?.writtenValue).toBe('present');
    expect(miss?.expectedValue).toBe('preterite');
  });

  it('names a wrong person', () => {
    const miss = diagnose(spoke, 'Ayer hablaste con mi hermana');

    expect(miss?.axis).toBe('person');
    expect(miss?.axes).toEqual(['person']);
    expect(miss?.writtenValue).toBe('2nd');
    expect(miss?.expectedValue).toBe('1st');
  });

  it('names a wrong gender on an adjective', () => {
    // Nothing in the diagnoser knows what an adjective is: `roja` and `rojo` are
    // two forms of one lexeme differing on one modelled field.
    const miss = diagnose(house, 'La casa rojo');

    expect(miss?.axis).toBe('gender');
    expect(miss?.expected).toBe('roja');
    expect(miss?.writtenValue).toBe('masculine');
    expect(miss?.expectedValue).toBe('feminine');
  });

  it('leads with the tense when several axes differ at once', () => {
    // `hablamos` against `hablé` is a different tense *and* a different number.
    // Naming one is more use than naming none; the two grammar labels carry the
    // rest, which is why they are on the record rather than composed on screen.
    const miss = diagnose(spoke, 'Ayer hablamos con mi hermana');

    expect(miss?.axis).toBe('tense');
    expect(miss?.axes).toEqual(['tense', 'number']);
  });
});

describe('declining to answer', () => {
  it('says nothing when more than one word differs', () => {
    // Two substitutions cannot be told from a different sentence, and guessing
    // is what makes a diagnosis worse than none.
    expect(diagnose(spoke, 'Hoy hablo con mi hermana')).toBeNull();
  });

  it('says nothing when the answer is a different length', () => {
    expect(diagnose(spoke, 'Ayer hablé con mi')).toBeNull();
  });

  it('says nothing about a word the pack cannot place', () => {
    // `comí` is not a form of `hablar`. It may be a different lexeme or a form
    // this pack has never carried, and those need different words on screen.
    expect(diagnose(spoke, 'Ayer comí con mi hermana')).toBeNull();
  });

  it('says nothing about a token with no lexeme behind it', () => {
    expect(diagnose(spoke, 'Ayer hablé con mi prima')).toBeNull();
  });

  it('says nothing about an accent, which is not a grammatical slip', () => {
    // `hable` for `hablé` is the `near` verdict's business, and the card already
    // names the accent there.
    expect(diagnose(spoke, 'Ayer hable con mi hermana')).toBeNull();
  });

  it('says nothing about a right answer', () => {
    expect(diagnose(spoke, 'Ayer hablé con mi hermana.')).toBeNull();
  });
});
