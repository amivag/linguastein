/**
 * Spanish numerals.
 *
 * The module is pure and its input space is enumerable, so most of this is
 * exhaustive rather than illustrative: every integer 0–1000 is spelled and
 * checked for shape, and the boundaries above that are pinned individually.
 *
 * The cases that matter are the ones a plausible-looking implementation gets
 * wrong: `ciento uno` with no `y`, `cien mil` never `ciento mil`, `mil` never
 * `un mil`, `veintiún mil`, and the accents that are load-bearing.
 */

import { describe, expect, it } from 'vitest';
import {
  MAX_CARDINAL,
  MAX_ORDINAL,
  NUMERAL_RULES,
  parseCardinal,
  rulesFor,
  spellCardinal,
  parseOrdinal,
  spellOrdinal,
} from '../../src/languages/es/numerals';

describe('cardinals', () => {
  it.each([
    [0, 'cero'],
    [1, 'uno'],
    [10, 'diez'],
    [15, 'quince'],
    [20, 'veinte'],
    [27, 'veintisiete'],
    [30, 'treinta'],
    [31, 'treinta y uno'],
    [40, 'cuarenta'],
    [99, 'noventa y nueve'],
    [136, 'ciento treinta y seis'],
    [1042, 'mil cuarenta y dos'],
  ])('spells %i as "%s"', (value, expected) => {
    expect(spellCardinal(value)).toBe(expected);
  });

  it('writes the teens solid, with an accent only on dieciséis', () => {
    // A blanket "accent the teens" rule passes on 16 and fails on the rest, so
    // the unaccented three are asserted as explicitly as the accented one.
    expect([16, 17, 18, 19].map((n) => spellCardinal(n))).toEqual([
      'dieciséis',
      'diecisiete',
      'dieciocho',
      'diecinueve',
    ]);
  });

  it('writes the twenties solid, accenting only 22, 23 and 26', () => {
    const accented = [21, 22, 23, 24, 25, 26, 27, 28, 29]
      .map((n) => spellCardinal(n))
      .filter((form) => /[áéíóú]/.test(form));
    expect(accented).toEqual(['veintidós', 'veintitrés', 'veintiséis']);
  });

  it('joins tens to units with y, and hundreds to tens with nothing', () => {
    expect(spellCardinal(31)).toBe('treinta y uno');
    // The single most common mistake: `ciento y uno` is wrong.
    expect(spellCardinal(101)).toBe('ciento uno');
    expect(spellCardinal(115)).toBe('ciento quince');
    expect(spellCardinal(121)).toBe('ciento veintiuno');
    expect(spellCardinal(131)).toBe('ciento treinta y uno');
  });

  it('says cien alone and ciento in a compound', () => {
    expect(spellCardinal(100)).toBe('cien');
    expect(spellCardinal(101)).toBe('ciento uno');
    expect(spellCardinal(199)).toBe('ciento noventa y nueve');
    // Never `ciento mil`.
    expect(spellCardinal(100_000)).toBe('cien mil');
  });

  it('knows the three irregular hundreds', () => {
    expect(spellCardinal(500)).toBe('quinientos');
    expect(spellCardinal(700)).toBe('setecientos');
    expect(spellCardinal(900)).toBe('novecientos');
    // And that the others are regular, so the table cannot be half-wrong.
    expect(spellCardinal(200)).toBe('doscientos');
    expect(spellCardinal(600)).toBe('seiscientos');
  });

  it('says mil, never un mil', () => {
    expect(spellCardinal(1000)).toBe('mil');
    expect(spellCardinal(1001)).toBe('mil uno');
    expect(spellCardinal(2000)).toBe('dos mil');
    expect(spellCardinal(21_000)).toBe('veintiún mil');
    expect(spellCardinal(999_000)).toBe('novecientos noventa y nueve mil');
  });

  it('reads a zero in the middle as silence, not as a word', () => {
    expect(spellCardinal(1042)).toBe('mil cuarenta y dos');
    expect(spellCardinal(1002)).toBe('mil dos');
    expect(spellCardinal(1_000_042)).toBe('un millón cuarenta y dos');
  });

  it('counts millions as a noun', () => {
    expect(spellCardinal(1_000_000)).toBe('un millón');
    expect(spellCardinal(2_000_000)).toBe('dos millones');
    expect(spellCardinal(21_000_000)).toBe('veintiún millones');
    expect(spellCardinal(MAX_CARDINAL)).toBe(
      'novecientos noventa y nueve millones novecientos noventa y nueve mil novecientos noventa y nueve',
    );
  });

  it('refuses what it cannot spell rather than guessing', () => {
    // A drill that asked for an unspellable number would mark a correct learner
    // wrong, so this throws instead of returning something plausible.
    expect(() => spellCardinal(-1)).toThrow(RangeError);
    expect(() => spellCardinal(1.5)).toThrow(RangeError);
    expect(() => spellCardinal(MAX_CARDINAL + 1)).toThrow(RangeError);
  });
});

describe('agreement', () => {
  it('apocopates uno before a masculine noun', () => {
    expect(spellCardinal(1)).toBe('uno');
    expect(spellCardinal(1, { beforeNoun: true })).toBe('un');
    expect(spellCardinal(21, { beforeNoun: true })).toBe('veintiún');
    expect(spellCardinal(31, { beforeNoun: true })).toBe('treinta y un');
    expect(spellCardinal(101, { beforeNoun: true })).toBe('ciento un');
  });

  it('keeps the accent that apocopation creates', () => {
    // Dropping the syllable moves the stress onto the `u`, so `veintiun` is a
    // spelling error rather than a variant.
    expect(spellCardinal(21, { beforeNoun: true })).toBe('veintiún');
    expect(spellCardinal(21, { gender: 'masculine', beforeNoun: true })).toBe('veintiún');
  });

  it('makes uno feminine whether or not a noun follows', () => {
    expect(spellCardinal(1, { gender: 'feminine' })).toBe('una');
    expect(spellCardinal(21, { gender: 'feminine' })).toBe('veintiuna');
    expect(spellCardinal(21, { gender: 'feminine', beforeNoun: true })).toBe('veintiuna');
    expect(spellCardinal(31, { gender: 'feminine' })).toBe('treinta y una');
  });

  it('agrees the hundreds', () => {
    expect(spellCardinal(200, { gender: 'feminine' })).toBe('doscientas');
    expect(spellCardinal(500, { gender: 'feminine' })).toBe('quinientas');
    // Both halves agree at once.
    expect(spellCardinal(231, { gender: 'feminine' })).toBe('doscientas treinta y una');
  });

  it('leaves cien, ciento and the tens alone', () => {
    // Only `-cientos` and `uno` change shape; a blanket "-o becomes -a" rule
    // would produce `cienta` and `cuarenta y doa`.
    expect(spellCardinal(100, { gender: 'feminine' })).toBe('cien');
    expect(spellCardinal(102, { gender: 'feminine' })).toBe('ciento dos');
    expect(spellCardinal(42, { gender: 'feminine' })).toBe('cuarenta y dos');
  });

  it('adds de after a bare million before a noun, and not otherwise', () => {
    expect(spellCardinal(1_000_000, { beforeNoun: true })).toBe('un millón de');
    expect(spellCardinal(2_000_000, { beforeNoun: true })).toBe('dos millones de');
    // The number continues, so the noun attaches to its lower part instead:
    // `un millón doscientas mil personas`, with no `de`.
    expect(spellCardinal(1_200_000, { beforeNoun: true, gender: 'feminine' })).toBe(
      'un millón doscientas mil',
    );
    // Nothing follows, so nothing to attach to.
    expect(spellCardinal(1_000_000)).toBe('un millón');
  });
});

describe('ordinals', () => {
  it.each([
    [1, 'primero'],
    [2, 'segundo'],
    [3, 'tercero'],
    [10, 'décimo'],
    [11, 'undécimo'],
    [13, 'decimotercero'],
    [20, 'vigésimo'],
  ])('spells %ith as "%s"', (value, expected) => {
    expect(spellOrdinal(value)).toBe(expected);
  });

  it('shortens primero and tercero before a masculine noun', () => {
    expect(spellOrdinal(1, { beforeNoun: true })).toBe('primer');
    expect(spellOrdinal(3, { beforeNoun: true })).toBe('tercer');
    // …and its compound, which is the case a hard-coded pair of words misses.
    expect(spellOrdinal(13, { beforeNoun: true })).toBe('decimotercer');
    // Nothing else shortens.
    expect(spellOrdinal(2, { beforeNoun: true })).toBe('segundo');
    expect(spellOrdinal(4, { beforeNoun: true })).toBe('cuarto');
  });

  it('agrees in the feminine without shortening', () => {
    expect(spellOrdinal(1, { gender: 'feminine' })).toBe('primera');
    expect(spellOrdinal(1, { gender: 'feminine', beforeNoun: true })).toBe('primera');
    expect(spellOrdinal(3, { gender: 'feminine' })).toBe('tercera');
  });

  it('stops where the standard stops being one', () => {
    expect(() => spellOrdinal(0)).toThrow(RangeError);
    expect(() => spellOrdinal(1.5)).toThrow(RangeError);
    expect(() => spellOrdinal(MAX_ORDINAL + 1)).toThrow(RangeError);
  });

  it('reads a citation form back to its number', () => {
    for (let value = 1; value <= MAX_ORDINAL; value++) {
      expect(parseOrdinal(spellOrdinal(value))).toBe(value);
    }
  });

  it('rejects anything that is not a citation form', () => {
    // The dataset build uses this as a round trip, so an accepted variant would
    // let a hand-typed spelling through: `septimo` has to fail, not resolve.
    expect(parseOrdinal('septimo')).toBeNull();
    expect(parseOrdinal('cuarta')).toBeNull();
    expect(parseOrdinal('primer')).toBeNull();
    expect(parseOrdinal('cuatro')).toBeNull();
    expect(parseOrdinal('')).toBeNull();
  });
});

describe('every cardinal 0–1000', () => {
  const all = Array.from({ length: 1001 }, (_, n) => [n, spellCardinal(n)] as const);

  it('spells all of them without throwing', () => {
    expect(all).toHaveLength(1001);
  });

  it('never emits a doubled space or a stray edge', () => {
    // Composition is string concatenation, so an empty table slot shows up as a
    // gap rather than an error. This is the assertion that catches it.
    const malformed = all.filter(([, form]) => /\s{2}|^\s|\s$/.test(form));
    expect(malformed).toEqual([]);
  });

  it('uses only letters, spaces and the accents Spanish writes', () => {
    const invalid = all.filter(([, form]) => !/^[a-záéíóúñ ]+$/.test(form));
    expect(invalid).toEqual([]);
  });

  it('says y only between a tens word and a unit', () => {
    const withY = all.filter(([, form]) => form.includes(' y '));
    // 31–99 minus the exact tens is seven tens words times nine units = 63,
    // and that pattern repeats inside each of the nine hundreds. 30 and 20 are
    // excluded for different reasons: `treinta` has no unit, `veintiuno` is solid.
    expect(withY).toHaveLength(63 * 10);
    expect(withY.every(([n]) => n % 100 >= 31 && (n % 100) % 10 !== 0)).toBe(true);
  });

  it('spells every number distinctly', () => {
    expect(new Set(all.map(([, form]) => form)).size).toBe(all.length);
  });
});

describe('parseCardinal', () => {
  it('reads back what spellCardinal wrote, for every number it can spell', () => {
    // The property that matters: an exact inverse. Anything less and a drill
    // marks a correct answer wrong, which is worse than not asking.
    const broken: [number, string, number | null][] = [];
    for (let n = 0; n <= 1000; n++) {
      const spelled = spellCardinal(n);
      const parsed = parseCardinal(spelled);
      if (parsed !== n) broken.push([n, spelled, parsed]);
    }
    expect(broken).toEqual([]);
  });

  it('round-trips the awkward ones above a thousand', () => {
    for (const n of [
      1001,
      1042,
      2000,
      21_000,
      100_000,
      999_000,
      1_000_000,
      1_000_042,
      2_000_000,
      21_000_000,
      1_200_000,
      MAX_CARDINAL,
    ]) {
      expect(parseCardinal(spellCardinal(n)), spellCardinal(n)).toBe(n);
    }
  });

  it('accepts the agreement forms a learner might reasonably type', () => {
    expect(parseCardinal('un')).toBe(1);
    expect(parseCardinal('una')).toBe(1);
    expect(parseCardinal('veintiún')).toBe(21);
    expect(parseCardinal('veintiuna')).toBe(21);
    expect(parseCardinal('doscientas casas'.split(' ')[0]!)).toBe(200);
    expect(parseCardinal('doscientas')).toBe(200);
    expect(parseCardinal('treinta y una')).toBe(31);
    expect(parseCardinal('veintiún mil')).toBe(21_000);
  });

  it('is forgiving about case, spacing and stray commas', () => {
    expect(parseCardinal('  Ciento   Treinta y Seis ')).toBe(136);
    expect(parseCardinal('mil, cuarenta y dos')).toBe(1042);
  });

  it('rejects nonsense rather than scoring it', () => {
    // A parser that returned a number here would mark a nonsense answer correct.
    expect(parseCardinal('mil mil')).toBeNull();
    expect(parseCardinal('millón millón')).toBeNull();
    // Scales have to descend: `mil millones` is a billion, which is out of range
    // for this module and must not be read as `un millón`.
    expect(parseCardinal('mil millones')).toBeNull();
    expect(parseCardinal('')).toBeNull();
    expect(parseCardinal('   ')).toBeNull();
    expect(parseCardinal('y')).toBeNull();
    expect(parseCardinal('perro')).toBeNull();
    expect(parseCardinal('ciento perro')).toBeNull();
    expect(parseCardinal('16')).toBeNull();
  });

  it('reads cero as zero, not as nothing', () => {
    expect(parseCardinal('cero')).toBe(0);
  });
});

describe('rulesFor', () => {
  it('names why a number is hard', () => {
    expect(rulesFor(16)).toEqual(['teens']);
    expect(rulesFor(27)).toEqual(['twenties']);
    expect(rulesFor(31)).toEqual(['y-joining', 'apocopation']);
    expect(rulesFor(100)).toEqual(['cien-ciento']);
    expect(rulesFor(200)).toEqual(['hundreds-agreement']);
  });

  it('reports every rule a compound number exercises', () => {
    // 136 is `ciento treinta y seis`: the hundreds/tens join *and* the tens/unit
    // join, which is what makes it the useful three-digit example.
    expect(rulesFor(136)).toEqual(['y-joining', 'cien-ciento']);
    expect(rulesFor(1042)).toEqual(['y-joining', 'mil-millon']);
    expect(rulesFor(21_000)).toEqual(['twenties', 'apocopation', 'mil-millon']);
  });

  it('sees rules in the upper groups, not just the last three digits', () => {
    // `doscientos dieciséis mil`: both rules live above the thousands mark.
    expect(rulesFor(216_000)).toEqual(['teens', 'hundreds-agreement', 'mil-millon']);
  });

  it('reports apocopation for anything that can apocopate, but not for eleven', () => {
    expect(rulesFor(1)).toContain('apocopation');
    expect(rulesFor(21)).toContain('apocopation');
    expect(rulesFor(101)).toContain('apocopation');
    // `once` has no `uno` in it to shorten.
    expect(rulesFor(11)).not.toContain('apocopation');
    expect(rulesFor(111)).not.toContain('apocopation');
  });

  it('returns rules in registry order however the number decomposes', () => {
    for (const value of [136, 1042, 21_000, 216_000, 999_999_999]) {
      const rules = rulesFor(value);
      const positions = rules.map((rule) => NUMERAL_RULES.indexOf(rule));
      expect(positions).toEqual([...positions].sort((a, b) => a - b));
    }
  });

  it('finds no rule in zero', () => {
    // `cero` is a single irreducible word. It is spellable and exercises nothing,
    // which is not the same as being out of range.
    expect(spellCardinal(0)).toBe('cero');
    expect(rulesFor(0)).toEqual([]);
  });

  it('says nothing about a number it cannot spell', () => {
    expect(rulesFor(-1)).toEqual([]);
    expect(rulesFor(1.5)).toEqual([]);
    expect(rulesFor(MAX_CARDINAL + 1)).toEqual([]);
  });

  it('covers every declared rule somewhere under a billion', () => {
    // A rule nothing can exercise is a rule with no pattern record to earn, so
    // the enum and the generator have to stay in step.
    const seen = new Set(
      [1, 16, 27, 31, 100, 200, 1000, 100_000].flatMap((value) => [...rulesFor(value)]),
    );
    expect([...NUMERAL_RULES].filter((rule) => !seen.has(rule))).toEqual([]);
  });
});
