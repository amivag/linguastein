import { describe, expect, it } from 'vitest';
import {
  describeMorphology,
  inspectItem,
  inspectToken,
  isInspectableItem,
  WHOLE_ITEM_TOKEN,
  type ItemId,
  type LearningItem,
  type LexemeId,
} from '../../src/domain/content';
import { id, TEST_PACK_ID, testRepository } from '../fixtures/pack';

const repository = testRepository();
const item = repository.getItem(id<ItemId>('test-es:item:001'))!;
const inspect = (tokenId: string, language = 'en') =>
  inspectToken(repository, item, tokenId, language);

const wordItem = (local: string) => repository.getItem(id<ItemId>(`test-es:item:${local}`))!;

describe('inspectToken', () => {
  it('describes a conjugated verb: meaning, grammar and lemma', () => {
    const info = inspect('t1');

    expect(info?.token.text).toBe('Tengo');
    expect(info?.lemma).toBe('tener');
    expect(info?.posLabel).toBe('verb');
    expect(info?.gloss).toBe('to have');
    expect(info?.grammar).toBe('1st sg · present');
  });

  it('lists the construction the word takes part in', () => {
    expect(inspect('t1')?.constructions).toEqual([
      {
        label: 'tener que + infinitivo',
        skill: 'test-es:skill:tener-que',
      },
    ]);
  });

  it('offers the other forms of the same verb, marking the current one', () => {
    const forms = inspect('t1')?.forms ?? [];

    expect(forms.map((form) => form.form)).toEqual(['tengo', 'tienes', 'tiene', 'tenemos']);
    expect(forms.filter((form) => form.current).map((form) => form.form)).toEqual(['tengo']);
  });

  it('shows other phrases using the same word, without repeating this one', () => {
    expect(inspect('t1')?.examples).toEqual([
      { id: 'test-es:item:002', text: 'Tengo que irme.', translation: 'I have to go.' },
    ]);
  });

  it('returns what it knows when a token has no lexeme link', () => {
    const info = inspect('t2');
    expect(info?.token.text).toBe('que');
    expect(info?.gloss).toBeUndefined();
    expect(info?.posLabel).toBe('conjunction');
  });

  it('ignores punctuation and unknown tokens', () => {
    expect(inspect('t4')).toBeNull();
    expect(inspect('t99')).toBeNull();
  });

  it('falls back through the reference-language chain', () => {
    // el has no glosses, so el → en applies (spec §11.1).
    expect(inspect('t1', 'el-GR')?.gloss).toBe('to have');
  });
});

/**
 * A word card has no tokens to look up — the card is the word — so the sheet
 * that explains a word inside a phrase had nothing to open for `cerveza`. The
 * same derivation now runs over a token made from the item's own lexeme.
 */
describe('inspectItem', () => {
  it('describes a word card: meaning, part of speech and gender', () => {
    const info = inspectItem(repository, wordItem('004'), 'en');

    expect(info?.token.text).toBe('cerveza');
    expect(info?.gloss).toBe('beer');
    expect(info?.posLabel).toBe('noun');
    // Gender is the grammar a Spanish noun has, and it decides el or la.
    expect(info?.grammar).toBe('feminine');
    expect(info?.lexeme).toBe('test-es:lexeme:cerveza');
  });

  it('states no grammar for a word whose gender the dataset has not declared', () => {
    // Silence beats a guess: `agua` is feminine but takes `el`, and inventing a
    // value here would teach it wrong.
    expect(inspectItem(repository, wordItem('005'), 'en')?.grammar).toBeUndefined();
    expect(inspectItem(repository, wordItem('005'), 'en')?.gloss).toBe('water');
  });

  it('follows the reference-language chain like any other word', () => {
    expect(inspectItem(repository, wordItem('004'), 'de')?.gloss).toBe('Bier');
  });

  /**
   * Built rather than taken from the fixture: it needs a word card whose lexeme
   * a sentence also uses, which is how all 451 word cards in the shipped pack
   * are related to their examples.
   */
  it('offers the forms and the phrases of the lexeme behind the card', () => {
    const card: LearningItem = {
      id: id<ItemId>('test-es:item:900'),
      pack: TEST_PACK_ID,
      type: 'word',
      text: 'tener',
      level: 'a1',
      lexemes: [id<LexemeId>('test-es:lexeme:tener')],
    };
    const info = inspectItem(repository, card, 'en');

    expect(info?.gloss).toBe('to have');
    expect(info?.forms.map((form) => form.form)).toEqual(['tengo', 'tienes', 'tiene', 'tenemos']);
    expect(info?.examples.map((example) => example.text)).toEqual([
      'Tengo que trabajar.',
      'Tengo que irme.',
    ]);
  });

  it('refuses an item that is not one word', () => {
    // A sentence has tokens of its own, and picking one lexeme out of several
    // would be choosing a meaning at random.
    expect(inspectItem(repository, item, 'en')).toBeNull();
    expect(isInspectableItem(item)).toBe(false);
    expect(isInspectableItem(wordItem('004'))).toBe(true);
  });

  it('refuses a word card with no lexeme to explain', () => {
    const card: LearningItem = {
      id: id<ItemId>('test-es:item:901'),
      pack: TEST_PACK_ID,
      type: 'word',
      text: 'dieciséis',
      level: 'a1',
    };

    expect(isInspectableItem(card)).toBe(false);
    expect(inspectItem(repository, card, 'en')).toBeNull();
  });

  /** The id the tappable text hands back, so one sheet serves both shapes. */
  it('is what inspectToken resolves the whole-item id to', () => {
    const card = wordItem('004');

    expect(inspectToken(repository, card, WHOLE_ITEM_TOKEN, 'en')).toEqual(
      inspectItem(repository, card, 'en'),
    );
    // A real token id on a word card still finds nothing.
    expect(inspectToken(repository, card, 't1', 'en')).toBeNull();
  });
});

describe('describeMorphology', () => {
  it('renders readable grammar summaries', () => {
    expect(describeMorphology({ person: 2, number: 'singular', tense: 'present' })).toBe(
      '2nd sg · present',
    );
    expect(describeMorphology({ verbForm: 'infinitive' })).toBe('infinitive');
    expect(
      describeMorphology({ person: 3, number: 'plural', tense: 'preterite', mood: 'subjunctive' }),
    ).toBe('3rd pl · preterite · subjunctive');
    expect(describeMorphology(undefined)).toBeUndefined();
    expect(describeMorphology({})).toBeUndefined();
  });

  it('describes a command by who it is aimed at', () => {
    // "2nd sg · imperative · formal" is accurate and unhelpful; the choice the
    // learner is making is tú or usted.
    const command = { mood: 'imperative', person: 2, verbForm: 'finite' } as const;

    expect(describeMorphology({ ...command, number: 'singular', formality: 'informal' })).toBe(
      'command · tú',
    );
    expect(describeMorphology({ ...command, number: 'singular', formality: 'formal' })).toBe(
      'command · usted',
    );
    expect(describeMorphology({ ...command, number: 'plural', formality: 'formal' })).toBe(
      'command · ustedes',
    );
    // A command carries no tense, so none should leak into the description.
    expect(describeMorphology({ ...command, number: 'plural', formality: 'informal' })).toBe(
      'command · vosotros',
    );
  });
});
