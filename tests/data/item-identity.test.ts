/**
 * What makes two rows the same item, and what does not — plus the gate that
 * stops vocabulary outrunning the sentences that exemplify it.
 *
 * The duplicate-text check exists because progress, mastery and scheduling all
 * key on the item id: two items reading the same thing would be practised twice
 * and known once. It normalises punctuation away, which is what catches `Hola`
 * against `Hola.` — and which also declared a statement a duplicate of the
 * question built from it, the one pair the pack most needs to hold.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { createScratchPack, type ScratchPack } from '../fixtures/dataset';

/** A sentence row with only the columns these cases care about. */
const row = (spanish: string, english: string) => `${spanish}\t${english}\ta1\tgrammar\t\tneutral`;

const LINES = /\r?\n/;

describe('item identity', () => {
  let scratch: ScratchPack | undefined;

  afterEach(() => {
    scratch?.dispose();
    scratch = undefined;
  });

  it('holds a statement and its question as two items', () => {
    scratch = createScratchPack('identity-mood');
    scratch.append(
      'sentences-asking.tsv',
      row('El gato está en la casa.', 'The cat is in the house.'),
    );
    scratch.append(
      'sentences-asking.tsv',
      row('¿El gato está en la casa?', 'Is the cat in the house?'),
    );

    const result = scratch.tryBuild();
    expect(result.output).not.toContain('Duplicate item text');
    expect(result.ok).toBe(true);
  });

  it('still rejects the same sentence written twice', () => {
    scratch = createScratchPack('identity-dup');
    scratch.append(
      'sentences-asking.tsv',
      row('El gato está en la casa.', 'The cat is in the house.'),
    );
    // A trailing mark is not a difference: same words, same mood, one sentence.
    scratch.append(
      'sentences-asking.tsv',
      row('El gato está en la casa', 'The cat is in the house.'),
    );

    const result = scratch.tryBuild();
    expect(result.ok).toBe(false);
    expect(result.output).toContain('Duplicate item text');
  });

  it('still rejects two questions written twice', () => {
    scratch = createScratchPack('identity-dup-q');
    scratch.append(
      'sentences-asking.tsv',
      row('¿El gato está en la casa?', 'Is the cat in the house?'),
    );
    scratch.append(
      'sentences-asking.tsv',
      row('¿El gato está en la casa?', 'Is the cat in the house, then?'),
    );

    const result = scratch.tryBuild();
    expect(result.ok).toBe(false);
    expect(result.output).toContain('Duplicate item text');
  });
});

/**
 * The recycling ratchet. §5 of the dataset-expansion brief asked for a threshold
 * the build enforces rather than prints, and the reason is measured: two content
 * passes added one-encounter lexemes as fast as they fixed them, and the coverage
 * report reported it to nobody.
 */
describe('the recycling ratchet', () => {
  let scratch: ScratchPack | undefined;

  afterEach(() => {
    scratch?.dispose();
    scratch = undefined;
  });

  const setCeiling = (pack: ScratchPack, level: string, short: number) => {
    const rows = pack.read('recycling.tsv').split(LINES);
    const index = rows.findIndex((entry) => entry.startsWith(`${level}\t`));
    expect(index, `no ${level} row in recycling.tsv`).toBeGreaterThan(-1);
    const columns = rows[index]!.split('\t');
    columns[2] = String(short);
    rows[index] = columns.join('\t');
    pack.write('recycling.tsv', rows.join('\n'));
  };

  /** The gate only reports for a scratch copy, so these ask for it explicitly. */
  const ENFORCE = { LINGUASTEIN_RECYCLING: 'enforce' };

  it('passes at the recorded ceiling, and reports where it stands', () => {
    scratch = createScratchPack('recycling-ok');

    const result = scratch.tryBuild(ENFORCE);
    expect(result.output).toContain('recycling a1:');
    expect(result.ok).toBe(true);
  });

  it('fails, naming the words, when recycling gets worse', () => {
    scratch = createScratchPack('recycling-worse');
    setCeiling(scratch, 'a1', 10);

    const result = scratch.tryBuild(ENFORCE);
    expect(result.ok).toBe(false);
    expect(result.output).toContain('recycling regressed for a1');
    // The words are the work; a bare count sends the reader off to derive them.
    expect(result.output).toMatch(/\S+ \(\d+\)/);
  });

  it('fails when an improvement would go unrecorded', () => {
    scratch = createScratchPack('recycling-better');
    setCeiling(scratch, 'a1', 9999);

    // The half that makes it a ratchet: leaving the ceiling high hands the next
    // pass back the room this one earned.
    const result = scratch.tryBuild(ENFORCE);
    expect(result.ok).toBe(false);
    expect(result.output).toContain('recycling improved for a1');
  });
});
