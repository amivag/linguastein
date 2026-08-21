/**
 * The alphabet, as the letter index and the sort both have to agree on it.
 *
 * The cases worth writing down are the ones where "alphabetical" is not
 * obvious: a Spanish question opens with `¿`, an accent is not a letter of its
 * own, and `ñ` is.
 */

import { describe, expect, it } from 'vitest';
import { byLetter, initialLetter, OTHER_INITIAL, sortItems } from '../../src/domain/content';

const texts = (items: readonly { text: string }[]) => items.map((item) => item.text);
const items = (...values: string[]) => values.map((text) => ({ text }));

describe('the letter a phrase files under', () => {
  it('folds an accent, because a learner looking for está looks under E', () => {
    expect(initialLetter('está')).toBe('E');
    expect(initialLetter('Árbol')).toBe('A');
    // Not Spanish, and the rule is not Spanish either: it is the collator's.
    expect(initialLetter('Ça va')).toBe('C');
  });

  it('keeps ñ as its own letter', () => {
    // Folded, an Ñ chip would list every word starting with n — which is the one
    // thing a letter index must not do.
    expect(initialLetter('ñoño')).toBe('Ñ');
    expect(initialLetter('niño')).toBe('N');
  });

  it('steps over the punctuation a question opens with', () => {
    expect(initialLetter('¿Qué hora es?')).toBe('Q');
    expect(initialLetter('¡Hola!')).toBe('H');
  });

  it('files text with no letter in it under one bucket rather than inventing a letter', () => {
    expect(initialLetter('123')).toBe(OTHER_INITIAL);
    expect(initialLetter('')).toBe(OTHER_INITIAL);
  });
});

describe('ordering a list', () => {
  it('hands back pack order untouched', () => {
    const list = items('pan', 'agua');
    expect(sortItems(list, 'pack')).toBe(list);
  });

  it('sorts alphabetically, ignoring accents and opening punctuation', () => {
    const sorted = sortItems(items('¿Tienes tiempo?', 'café', 'agua', 'Tengo que irme.'), 'az');

    // `¿Tienes…` last rather than first: it is filed under T, and a list whose
    // index says T while its order says "before A" is showing two alphabets.
    expect(texts(sorted)).toEqual(['agua', 'café', 'Tengo que irme.', '¿Tienes tiempo?']);
  });

  it('reverses without disturbing anything else', () => {
    const forwards = sortItems(items('pan', 'agua', 'café'), 'az');
    const backwards = sortItems(items('pan', 'agua', 'café'), 'za');
    expect(texts(backwards)).toEqual([...texts(forwards)].reverse());
  });

  it('leaves the array it was given alone', () => {
    const list = items('pan', 'agua');
    sortItems(list, 'az');
    expect(texts(list)).toEqual(['pan', 'agua']);
  });
});

describe('the order the letters themselves come in', () => {
  it('puts Ñ between N and O for Spanish', () => {
    expect(['O', 'Ñ', 'A', 'N'].sort(byLetter('es'))).toEqual(['A', 'N', 'Ñ', 'O']);
  });

  it('puts the not-a-letter bucket after every letter', () => {
    expect([OTHER_INITIAL, 'B', 'A'].sort(byLetter('es'))).toEqual(['A', 'B', OTHER_INITIAL]);
  });
});
