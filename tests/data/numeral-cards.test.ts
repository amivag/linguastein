/**
 * Number cards.
 *
 * Numerals are the first `NUM` rows to earn word cards, and the first modifier
 * rows to use the no-card sentinel. Both were gaps: the modifier loop issued ids
 * to rows that had none to own, and only adjectives could become cards at all.
 *
 * The rule that shapes the set: every word card must have an example sentence
 * (`shipped-packs.test.ts` holds that for the pack as a whole), so a numeral no
 * sentence uses contributes a lexeme and a gloss but no card. It becomes one for
 * free the day someone writes a sentence with it in.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parseCardinal, spellCardinal } from '../../src/languages/es/numerals';
import { createScratchPack, shippedRecords, type ScratchPack } from '../fixtures/dataset';

interface Lexeme {
  readonly id: string;
  readonly lemma: string;
  readonly pos: string;
}

interface Item {
  readonly id: string;
  readonly text: string;
  readonly lexemes?: readonly string[];
  readonly examples?: readonly string[];
  readonly topics?: readonly string[];
}

const numLexemes = shippedRecords<Lexeme>('es-a1-a2-core-modifiers.jsonl').filter(
  (lexeme) => lexeme.pos === 'NUM',
);
const cards = shippedRecords<Item>('es-a1-a2-core-vocabulary.jsonl');
const numeralIds = new Set(numLexemes.map((lexeme) => lexeme.id));
const numeralCards = cards.filter((card) => card.lexemes?.some((id) => numeralIds.has(id)));

describe('the shipped number cards', () => {
  it('spells every numeral lexeme exactly as the module does', () => {
    // A round trip, not set membership: reading the lemma gives the number it
    // means, and spelling that number again must return the same string. So
    // `dieciseis` fails for being unreadable, and `diez y seis` fails for not
    // being what the module would have written, even though it parses.
    const wrong = numLexemes.filter((lexeme) => {
      const value = parseCardinal(lexeme.lemma);
      return value === null || spellCardinal(value) !== lexeme.lemma;
    });
    expect(wrong.map((lexeme) => lexeme.lemma)).toEqual([]);
  });

  it('carries the digits in the gloss, so the drill asks a number', () => {
    // "twenty → veinte" is a vocabulary question a learner half-answers from
    // English. "20 → veinte" is the cue they meet on a price tag, and the
    // existing exercise kinds prompt from the gloss.
    const glosses = new Map(
      shippedRecords<{ ref: string; lang: string; text: string }>(
        'es-a1-a2-core-translations-en.jsonl',
      )
        .filter((entry) => entry.lang === 'en')
        .map((entry) => [entry.ref, entry.text]),
    );

    for (const lexeme of numLexemes) {
      const value = parseCardinal(lexeme.lemma)!;
      // Both glosses: the card's, and the lexeme's for the 22 with no card.
      expect(glosses.get(lexeme.id), lexeme.lemma).toContain(`(${value})`);
    }

    const card = numeralCards.find((entry) => entry.text === 'veinte');
    expect(glosses.get(card!.id)).toBe('twenty (20)');
  });

  it('leaves a non-numeral gloss alone', () => {
    const glosses = shippedRecords<{ ref: string; lang: string; text: string }>(
      'es-a1-a2-core-translations-en.jsonl',
    );
    const adjective = shippedRecords<Lexeme>('es-a1-a2-core-modifiers.jsonl').find(
      (lexeme) => lexeme.lemma === 'bueno',
    );
    expect(glosses.find((entry) => entry.ref === adjective!.id)?.text).toBe('good');
  });

  it('cards the numerals a sentence can show, and only those', () => {
    expect(numeralCards.map((card) => card.text).sort()).toEqual(
      [
        'cien',
        'cinco',
        'cuatro',
        'diez',
        'doce',
        'dos',
        'mil',
        'nueve',
        'ocho',
        'once',
        'seis',
        'siete',
        'treinta',
        'tres',
        'uno',
        'veinte',
      ].sort(),
    );
  });

  it('gives every number card an example, like every other card', () => {
    const orphans = numeralCards.filter((card) => (card.examples?.length ?? 0) === 0);
    expect(orphans.map((card) => card.text)).toEqual([]);
  });

  it('keeps the lexeme and the gloss for a numeral with no card yet', () => {
    // `dieciséis` stays inspectable when tapped in a sentence and stays a valid
    // drill answer; what it lacks is a card of its own, not a meaning.
    const carded = new Set(numeralCards.flatMap((card) => card.lexemes ?? []));
    const uncarded = numLexemes.filter((lexeme) => !carded.has(lexeme.id));

    expect(uncarded.map((lexeme) => lexeme.lemma)).toContain('dieciséis');
    const glosses = shippedRecords<{ ref: string; lang: string }>(
      'es-a1-a2-core-translations-en.jsonl',
    );
    const missing = uncarded.filter(
      (lexeme) => !glosses.some((entry) => entry.ref === lexeme.id && entry.lang === 'en'),
    );
    expect(missing.map((lexeme) => lexeme.lemma)).toEqual([]);
  });

  it('files them under the numbers category', () => {
    const stray = numeralCards.filter((card) => !card.topics?.includes('numbers'));
    expect(stray.map((card) => card.text)).toEqual([]);
  });
});

describe('the no-card sentinel on a modifier row', () => {
  let pack: ScratchPack;

  beforeAll(() => {
    pack = createScratchPack('linguastein-numeral-cards');
  }, 120_000);

  afterAll(() => {
    pack.dispose();
  });

  it('issues no id to a row marked with a dash', () => {
    // The bug this covers: the modifier loop checked only the part of speech, so
    // a `-` row was handed an id it had no card to own — and the write-back then
    // put that id *in front of* the dash, corrupting every later column.
    pack.build();
    const source = pack.read('modifiers.tsv');
    const dashed = source
      .split('\n')
      .filter((line) => line.startsWith('-\t'))
      .map((line) => line.split('\t'));

    expect(dashed.length).toBeGreaterThan(0);
    // Second cell is the lemma, not a six-digit id that leaked in.
    for (const cells of dashed) expect(cells[1]).not.toMatch(/^\d{6}$/);
  });

  /**
   * Drops the row `append` added, so each case starts from a clean source.
   * Trailing newline trimmed first — `append` leaves one, so slicing the raw
   * split discards the blank line and keeps the row.
   */
  function dropLastRow(file: string): void {
    const rows = pack.read(file).trimEnd().split('\n');
    pack.write(file, `${rows.slice(0, -1).join('\n')}\n`);
  }

  it('refuses a numeral it cannot read', () => {
    pack.append('modifiers.tsv', ['dieciseis', 'sixteen', 'NUM', 'a1', 'numbers'].join('\t'));

    const { ok, output } = pack.tryBuild();
    expect(ok).toBe(false);
    expect(output).toContain('cannot read it');

    dropLastRow('modifiers.tsv');
    expect(pack.tryBuild().ok).toBe(true);
  });

  it('refuses a spelling the module would not have written, even if it parses', () => {
    // `diez y seis` reads as 16 perfectly well. It is still not what the module
    // writes, and two spellings of one number is how a dataset starts lying.
    pack.append('modifiers.tsv', ['diez y seis', 'sixteen', 'NUM', 'a1', 'numbers'].join('\t'));

    const { ok, output } = pack.tryBuild();
    expect(ok).toBe(false);
    // The message has to name the spelling to use, or the author is guessing.
    expect(output).toContain('spells 16 as "dieciséis"');

    dropLastRow('modifiers.tsv');
    expect(pack.tryBuild().ok).toBe(true);
  });

  it('cards a numeral as soon as a sentence uses it', () => {
    // The deferral is a content gap, not a rule: write the sentence and the card
    // appears, with no source edit to the numeral row at all.
    const rows = pack.read('modifiers.tsv').split('\n');
    const line = rows.findIndex((row) => row.startsWith('-\tdieciséis\t'));
    expect(line).toBeGreaterThan(-1);
    rows[line] = rows[line]!.slice('-\t'.length);
    pack.write('modifiers.tsv', rows.join('\n'));
    pack.append(
      'sentences-core.tsv',
      ['Tengo dieciséis euros.', "I've got sixteen euros.", 'a1', 'numbers'].join('\t'),
    );

    expect(pack.tryBuild().ok).toBe(true);
    const carded = pack
      .records<Item>('es-a1-a2-core-vocabulary.jsonl')
      .find((card) => card.text === 'dieciséis');
    expect(carded).toBeDefined();
    expect(carded!.examples?.length).toBeGreaterThan(0);
  });
});
