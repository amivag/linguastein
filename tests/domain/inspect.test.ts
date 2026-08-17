import { describe, expect, it } from 'vitest';
import { describeMorphology, inspectToken, type ItemId } from '../../src/domain/content';
import { id, testRepository } from '../fixtures/pack';

const repository = testRepository();
const item = repository.getItem(id<ItemId>('test-es:item:001'))!;
const inspect = (tokenId: string, language = 'en') =>
  inspectToken(repository, item, tokenId, language);

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
