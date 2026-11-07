import { describe, expect, it } from 'vitest';
import { adjectiveForms, pluralOf } from '../../src/languages/es/morphology';

describe('pluralOf', () => {
  it('adds -s after a vowel and -es after a consonant', () => {
    expect(pluralOf('casa')).toBe('casas');
    expect(pluralOf('coche')).toBe('coches');
    expect(pluralOf('hotel')).toBe('hoteles');
    expect(pluralOf('color')).toBe('colores');
  });

  it('turns a final z into ces', () => {
    expect(pluralOf('lápiz')).toBe('lápices');
    expect(pluralOf('vez')).toBe('veces');
    expect(pluralOf('luz')).toBe('luces');
  });

  it('drops an accent only when it marked final-syllable stress', () => {
    expect(pluralOf('canción')).toBe('canciones');
    expect(pluralOf('autobús')).toBe('autobuses');
    expect(pluralOf('jardín')).toBe('jardines');
    expect(pluralOf('inglés')).toBe('ingleses');
    // Stress falls earlier here, so the accent stays.
    expect(pluralOf('árbol')).toBe('árboles');
    expect(pluralOf('fácil')).toBe('fáciles');
  });

  it('keeps a stressed final vowel', () => {
    expect(pluralOf('café')).toBe('cafés');
    expect(pluralOf('sofá')).toBe('sofás');
  });
});

describe('adjectiveForms', () => {
  it('inflects -o adjectives for gender and number', () => {
    expect(adjectiveForms('cansado').map((entry) => entry.form)).toEqual([
      'cansado',
      'cansados',
      'cansada',
      'cansadas',
    ]);
  });

  it('inflects invariable adjectives for number only', () => {
    expect(adjectiveForms('grande').map((entry) => entry.form)).toEqual(['grande', 'grandes']);
    expect(adjectiveForms('feliz').map((entry) => entry.form)).toEqual(['feliz', 'felices']);
    expect(adjectiveForms('fácil').map((entry) => entry.form)).toEqual(['fácil', 'fáciles']);
  });

  it('gives an invariable adjective no gender at all', () => {
    // Labelling `grande` masculine by default is a claim, and a false one: the
    // form a learner meets in `una casa grande` would be described as masculine
    // by the very entry meant to teach agreement. These morphs are also what a
    // sentence token inherits, so the wrong label would travel.
    expect(adjectiveForms('grande').map((entry) => entry.morph)).toEqual([
      { number: 'singular' },
      { number: 'plural' },
    ]);
    expect(adjectiveForms('cansado').map((entry) => entry.morph.gender)).toEqual([
      'masculine',
      'masculine',
      'feminine',
      'feminine',
    ]);
  });
});
