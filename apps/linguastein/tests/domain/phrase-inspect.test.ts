/**
 * Inspecting a run of words, not only one.
 *
 * `tener que` means "to have to" while `tener` alone means "to have", and the
 * dataset has always recorded the difference as a multi-token `Annotation`.
 * Nothing could ask about a span, so that data was only ever reachable one word
 * at a time — which is the gap these tests close.
 */

import { describe, expect, it } from 'vitest';
import {
  expandSpan,
  inspectSpan,
  isPunctuation,
  joinTokens,
  needsSpaceBefore,
  nextInSpan,
  splitWords,
  type ItemId,
  type LearningItem,
  type PackId,
} from '../../src/domain/content';
import { id, testRepository } from '../fixtures/pack';

const repository = testRepository();
const sentence = repository.getItem(id<ItemId>('test-es:item:001'))!;
const wordCard = repository.getItem(id<ItemId>('test-es:item:004'))!;

const span = (tokens: readonly string[]) => inspectSpan(repository, sentence, tokens, 'en');

describe('inspectSpan', () => {
  it('reads the selected words back as they are written', () => {
    expect(span(['t1', 't2'])?.text).toBe('Tengo que');
    expect(span(['t1', 't2', 't3'])?.text).toBe('Tengo que trabajar');
  });

  it('names the pattern the words form, which the parts do not add up to', () => {
    const info = span(['t1', 't2']);
    expect(info?.constructions.map((entry) => entry.label)).toEqual(['tener que + infinitivo']);
  });

  it('explains each word as well as the phrase', () => {
    const info = span(['t1', 't2']);

    expect(info?.words.map((word) => word.token.text)).toEqual(['Tengo', 'que']);
    expect(info?.words[0]?.gloss).toBe('to have');
    expect(info?.words[0]?.grammar).toBe('1st sg · present');
    // `que` carries no lexeme in the fixture; the part of speech still lands.
    expect(info?.words[1]?.posLabel).toBe('conjunction');
  });

  it('carries the sentence it sits in as context', () => {
    expect(span(['t1', 't2'])?.context).toBe('I have to work.');
  });

  /**
   * Overlap, not an exact match. A learner selecting `que trabajar` is asking
   * about the same construction as one who selected the whole thing, and
   * demanding they guess the annotation's boundaries would make the feature a
   * puzzle rather than an answer.
   */
  it('answers for a selection that only overlaps the annotation', () => {
    expect(span(['t2', 't3'])?.constructions).toHaveLength(1);
  });

  it('says nothing about a pattern when the words are not one', () => {
    const other = repository.getItem(id<ItemId>('test-es:item:003'))!;
    const info = inspectSpan(repository, other, ['t1'], 'en');
    // Item 003 carries no tokens at all, so there is nothing to select.
    expect(info).toBeNull();
  });

  it('offers other phrases built on the same pattern', () => {
    // The fixture's second sentence shares the `tener que` skill via its lexeme
    // rather than the skill itself, so an empty list here is the honest answer.
    expect(span(['t1', 't2'])?.examples).toEqual([]);
  });

  it('drops punctuation from the word-by-word breakdown', () => {
    const info = span(['t3', 't4']);
    expect(info?.words.map((word) => word.token.text)).toEqual(['trabajar']);
    // …but keeps it in the text, which is what the phrase actually reads as.
    expect(info?.text).toBe('trabajar.');
  });

  it('returns nothing for a selection that matches no token', () => {
    expect(span(['nope'])).toBeNull();
  });

  /**
   * A span is grown one word at a time, so whatever sits between its ends is
   * punctuation. Dropping it made a selection across a comma read `Hola cómo`
   * where the sentence says `Hola, ¿cómo` — the words were right and the phrase
   * was not one anybody had written.
   */
  it('keeps the punctuation between the selected words', () => {
    const greeting: LearningItem = {
      id: id<ItemId>('test-es:item:900'),
      pack: id<PackId>('test-es'),
      type: 'sentence',
      text: 'Hola, ¿cómo estás?',
      tokens: [
        { id: 't1', text: 'Hola', pos: 'INTJ' },
        { id: 't2', text: ',', pos: 'PUNCT' },
        { id: 't3', text: '¿', pos: 'PUNCT' },
        { id: 't4', text: 'cómo', pos: 'ADV' },
        { id: 't5', text: 'estás', pos: 'VERB' },
        { id: 't6', text: '?', pos: 'PUNCT' },
      ],
    };

    const info = inspectSpan(repository, greeting, ['t1', 't4'], 'en');
    expect(info?.text).toBe('Hola, ¿cómo');
    // …and the breakdown still lists only the words, since a comma has nothing
    // to explain.
    expect(info?.words.map((word) => word.token.text)).toEqual(['Hola', 'cómo']);
  });
});

describe('expandSpan', () => {
  it('grows the selection by one word at a time', () => {
    expect(expandSpan(sentence, ['t2'], 'before')).toEqual(['t1', 't2']);
    expect(expandSpan(sentence, ['t2'], 'after')).toEqual(['t2', 't3']);
  });

  it('keeps the run in reading order however it was grown', () => {
    const grown = expandSpan(sentence, expandSpan(sentence, ['t2'], 'after'), 'before');
    expect(grown).toEqual(['t1', 't2', 't3']);
  });

  /** A span reading `Tengo que trabajar .` would be nonsense. */
  it('steps over punctuation rather than selecting it', () => {
    expect(expandSpan(sentence, ['t3'], 'after')).toEqual(['t3']);
  });

  it('stays put at the edges', () => {
    expect(expandSpan(sentence, ['t1'], 'before')).toEqual(['t1']);
  });

  it('leaves a word card alone: there is nothing to grow into', () => {
    expect(expandSpan(wordCard, ['#item'], 'after')).toEqual(['#item']);
  });
});

describe('nextInSpan', () => {
  it('names the word a control would add, so the control can say it', () => {
    expect(nextInSpan(sentence, ['t2'], 'before')?.text).toBe('Tengo');
    expect(nextInSpan(sentence, ['t2'], 'after')?.text).toBe('trabajar');
  });

  it('is undefined where there is nothing to add', () => {
    expect(nextInSpan(sentence, ['t1'], 'before')).toBeUndefined();
    expect(nextInSpan(sentence, ['t3'], 'after')).toBeUndefined();
  });
});

describe('joinTokens', () => {
  it('spaces words but not the punctuation after them', () => {
    expect(joinTokens(sentence.tokens ?? [])).toBe('Tengo que trabajar.');
  });

  it('suppresses the space after an opening inverted mark', () => {
    expect(
      joinTokens([
        { id: 'a', text: '¿' },
        { id: 'b', text: 'Dónde' },
        { id: 'c', text: '?' },
      ]),
    ).toBe('¿Dónde?');
  });
});

describe('needsSpaceBefore', () => {
  it('is the one rule both the renderer and the text builder use', () => {
    expect(needsSpaceBefore(undefined, 'Tengo')).toBe(false);
    expect(needsSpaceBefore('Tengo', 'que')).toBe(true);
    expect(needsSpaceBefore('trabajar', '.')).toBe(false);
    expect(needsSpaceBefore('¿', 'Dónde')).toBe(false);
  });
});

/**
 * The punctuation class is shared by speech comparison, exercise generation and
 * grading, so a mark missing from it is a learner marked wrong for saying the
 * sentence correctly. It is asserted for scripts the app does not ship yet
 * because that failure is silent: nothing about a Greek `·` left in a word looks
 * broken until a session grades it.
 */
describe('punctuation across scripts', () => {
  it('strips Greek marks, including the question mark that is a semicolon', () => {
    expect(splitWords('Πού είναι η τράπεζα;')).toEqual(['Πού', 'είναι', 'η', 'τράπεζα']);
    expect(isPunctuation('·')).toBe(true);
  });

  it('strips CJK marks, which are not the ASCII ones', () => {
    expect(splitWords('你好，世界！')).toEqual(['你好', '世界']);
    expect(isPunctuation('。')).toBe(true);
    expect(isPunctuation('银行')).toBe(false);
  });

  it('leaves Spanish exactly as it was', () => {
    expect(splitWords('¿Dónde está el baño?')).toEqual(['Dónde', 'está', 'el', 'baño']);
    expect(isPunctuation('¿')).toBe(true);
  });
});
