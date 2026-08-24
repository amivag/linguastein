/**
 * The alphabet is a closed set with exact spellings, so it is checked the way
 * the numerals are: against the whole inventory, not a sample.
 */

import { describe, expect, it } from 'vitest';
import {
  ALPHABET,
  isLetterName,
  letterName,
  letterNames,
  spellWord,
} from '../../src/languages/es/alphabet';

describe('the inventory', () => {
  it('has the twenty-seven letters, and not ch or ll', () => {
    // Twenty-nine until 2010. A learner with an older book will look for `che`
    // and `elle`, and a dictionary no longer files them separately.
    expect(ALPHABET).toHaveLength(27);
    expect(ALPHABET.map((entry) => entry.letter).join('')).toBe('abcdefghijklmnñopqrstuvwxyz');
    expect(ALPHABET.some((entry) => entry.letter === 'ch')).toBe(false);
    expect(ALPHABET.some((entry) => entry.letter === 'll')).toBe(false);
  });

  it('gives every letter exactly one RAE name', () => {
    const names = ALPHABET.map((entry) => entry.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names.every((name) => name.length > 0)).toBe(true);
  });

  it('names the letters a learner gets wrong', () => {
    expect(letterName('h')).toBe('hache');
    expect(letterName('j')).toBe('jota');
    expect(letterName('ñ')).toBe('eñe');
    expect(letterName('q')).toBe('cu');
    expect(letterName('v')).toBe('uve');
    expect(letterName('w')).toBe('uve doble');
    expect(letterName('x')).toBe('equis');
    expect(letterName('y')).toBe('ye');
    expect(letterName('z')).toBe('zeta');
  });

  it('carries the regional names, because a code is read out by somebody', () => {
    // Knowing only `uve` is not enough to take a booking reference from a
    // Mexican speaker, which is the situation this is learned for.
    expect(letterNames('v')).toContain('ve corta');
    expect(letterNames('w')).toContain('doble ve');
    expect(letterNames('y')).toContain('i griega');
    expect(letterNames('b')).toContain('be larga');
  });

  it('treats an accented vowel as its own letter, not a new one', () => {
    expect(letterName('á')).toBe('a');
    expect(letterName('ü')).toBe('u');
    expect(letterName('É')).toBe('e');
  });

  it('returns nothing for what is not a letter', () => {
    expect(letterName('-')).toBeUndefined();
    expect(letterName('4')).toBeUndefined();
    expect(letterNames('@')).toEqual([]);
  });
});

describe('spelling a word out', () => {
  it('reads the letters in order', () => {
    expect(spellWord('gato')).toEqual(['ge', 'a', 'te', 'o']);
    expect(spellWord('año')).toEqual(['a', 'eñe', 'o']);
  });

  it('says the accent, because leaving it out spells a different word', () => {
    expect(spellWord('Gómez')).toEqual(['ge', 'o con acento', 'eme', 'e', 'zeta']);
    expect(spellWord('pingüino')).toEqual([
      'pe',
      'i',
      'ene',
      'ge',
      'u con diéresis',
      'i',
      'ene',
      'o',
    ]);
  });

  it('drops what cannot be said rather than guessing', () => {
    expect(spellWord('c-3')).toEqual(['ce']);
    expect(spellWord('el sol')).toEqual(['e', 'ele', 'ese', 'o', 'ele']);
  });

  it('recognises its own output, which is what the dataset check relies on', () => {
    for (const entry of ALPHABET) {
      for (const name of letterNames(entry.letter)) {
        expect(isLetterName(name), name).toBe(true);
      }
    }
    expect(isLetterName('che')).toBe(false);
    expect(isLetterName('elle')).toBe(false);
  });
});
