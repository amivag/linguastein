/**
 * The alphabet is a closed set with exact spellings, so it is checked the way
 * the numerals are: against the whole inventory, not a sample.
 */

import { describe, expect, it } from 'vitest';
import {
  ALPHABET,
  DIGRAPHS,
  MARKS,
  SPANISH_ALPHABET,
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

/**
 * The chart half: what a letter *sounds* like, which is a different fact from
 * what it is called and the one a learner needs first.
 *
 * Checked against the whole inventory rather than a sample, for the reason the
 * names are — and with one invariant that is worth more than all the others put
 * together: an example has to contain the letter it is an example of. Twenty-seven
 * cards of near-identical shape are written by copying the one above, and a
 * `casa` left under D is the mistake that makes.
 */
describe('the chart', () => {
  const FOLD: Readonly<Record<string, string>> = {
    á: 'a',
    é: 'e',
    í: 'i',
    ó: 'o',
    ú: 'u',
  };

  /** Accents off, `ñ` and `ü` kept: both are the letter being demonstrated. */
  const fold = (word: string) =>
    [...word].map((character) => FOLD[character] ?? character).join('');

  it('gives every letter a sound and not only a name', () => {
    for (const entry of ALPHABET) {
      expect(entry.say.length, entry.letter).toBeGreaterThan(0);
      expect(entry.sound.length, entry.letter).toBeGreaterThan(0);
      expect(entry.examples.length, entry.letter).toBeGreaterThanOrEqual(2);
    }
  });

  it('gives every example a word and a meaning', () => {
    for (const entry of [...ALPHABET, ...DIGRAPHS, ...MARKS]) {
      for (const example of entry.examples) {
        expect(example.word.length, entry.letter).toBeGreaterThan(0);
        expect(example.gloss.length, example.word).toBeGreaterThan(0);
      }
    }
  });

  it('demonstrates the letter it is filed under', () => {
    for (const entry of [...ALPHABET, ...DIGRAPHS]) {
      for (const example of entry.examples) {
        expect(fold(example.word), `${example.word} under ${entry.letter}`).toContain(entry.letter);
      }
    }
  });

  it('keeps ch and ll out of the alphabet and still teaches them', () => {
    // Two letters each since 2010, and one sound each regardless. A chart that
    // drops them is a chart a learner cannot read `calle` with.
    const digraphs = DIGRAPHS.map((entry) => entry.letter);
    expect(digraphs).toContain('ch');
    expect(digraphs).toContain('ll');
    for (const digraph of digraphs) {
      expect(ALPHABET.some((entry) => entry.letter === digraph)).toBe(false);
    }
  });

  it('names the pairs that have a name and leaves the spelling rules unnamed', () => {
    // `che` and `elle` are what speakers call them. `qu` and `gu` are rules, and
    // a name invented for either would teach a learner to say something nobody
    // says.
    const named = Object.fromEntries(DIGRAPHS.map((entry) => [entry.letter, entry.name]));
    expect(named['ch']).toBe('che');
    expect(named['ll']).toBe('elle');
    expect(named['qu']).toBeUndefined();
    expect(named['gu']).toBeUndefined();
  });

  it('keeps the marks apart from the letters', () => {
    // An accent is not a twenty-eighth letter, and `ü` is not a letter at all —
    // but a learner who does not know either cannot write their own name down.
    expect(MARKS.map((entry) => entry.name)).toEqual(['tilde', 'diéresis']);
    for (const mark of MARKS) {
      expect(letterName(mark.letter)).not.toBe(mark.name);
    }
  });

  it('offers the three lists as one guide, still counting twenty-seven', () => {
    expect(SPANISH_ALPHABET.tag).toBe('es');
    expect(SPANISH_ALPHABET.letters).toHaveLength(27);
    expect(SPANISH_ALPHABET.digraphs).toBe(DIGRAPHS);
    expect(SPANISH_ALPHABET.marks).toBe(MARKS);
  });
});
