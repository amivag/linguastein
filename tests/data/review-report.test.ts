/**
 * The editorial review aid (`npm run review:data`).
 *
 * It reports content questions a schema cannot ask, so it is advisory. The two
 * behaviours worth pinning: a planted defect is reported, and a row a human has
 * signed off stops being reported — a report that never shrinks gets ignored,
 * and some of what it raises is correct content that only needs confirming.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createScratchPack, type ScratchPack } from '../fixtures/dataset';

let pack: ScratchPack;

const review = () => pack.run('scripts/review-dataset.ts');

/** Id of the word card with this text, which the build assigns. */
function cardId(text: string): string {
  const record = pack
    .records<{ id: string; text: string }>('es-a1-a2-core-vocabulary.jsonl')
    .find((item) => item.text === text);
  return record!.id.replace('core-es:item:', '');
}

const signOff = (text: string) => [cardId(text), text, 'A. Editor', '2026-08-18'].join('\t');

beforeAll(() => {
  pack = createScratchPack('lingo-report');

  // `car` is already a marked regional pair (coche/carro); an unmarked third
  // word with the same meaning is the shape that teaches a dialect as universal.
  pack.append('nouns.tsv', 'auto\tcar\tm\t\ta1\ttravel');
  pack.build();
}, 120_000);

afterAll(() => {
  pack.dispose();
});

describe('the review report', () => {
  it('raises a word taught as universal alongside marked regional variants', () => {
    const output = review();

    expect(output).toContain('regional pair with an unmarked side');
    expect(output).toMatch(/"car".*auto/s);
  });

  it('reports how much of the pack has been signed off', () => {
    expect(review()).toContain('0 signed off');
  });

  it('stops raising it once every item in the finding is signed off', () => {
    pack.write(
      'reviewed.tsv',
      ['# scratch', ...['auto', 'coche', 'carro'].map(signOff)].join('\n') + '\n',
    );
    pack.build();

    const output = review();
    expect(output).toContain('3 signed off');
    expect(output).toContain('1 settled by sign-off');
    // Only this finding is settled: other rows raising the same check remain.
    expect(output).not.toMatch(/"car".*auto/s);
  });
});
