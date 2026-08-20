/**
 * No two items may carry the same text.
 *
 * Progress, mastery and scheduling all key on the item id, so two items reading
 * the same splits one word a learner sees into two — practised twice and known
 * once. The guard used to cover sentences only, which let the noun `frío` and
 * the adjective `frío` both ship a card glossed "cold".
 *
 * These build a scratch copy of `content/es`, so they exercise the real script
 * without touching the checked-in pack.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createScratchPack, type ScratchPack } from '../fixtures/dataset';

const NOUNS = 'nouns.tsv';

let pack: ScratchPack;

/** Stderr of a build expected to fail. */
function buildError(): string {
  const { ok, output } = pack.tryBuild();
  expect(ok, 'expected the build to fail').toBe(false);
  return output;
}

beforeAll(() => {
  pack = createScratchPack('linguastein-dupes');
  pack.build();
}, 120_000);

afterAll(() => {
  pack.dispose();
});

describe('a word marked as having no card', () => {
  it('ships one card for a noun/adjective homograph, not two', () => {
    const cards = pack
      .records<{ id: string; text: string }>('es-a1-a2-core-vocabulary.jsonl')
      .filter((item) => item.text === 'frío');

    expect(cards).toHaveLength(1);
  });

  /** The word is still taught: five sentences use it, and tapping it must work. */
  it('keeps the lexeme and its meaning, so sentences stay inspectable', () => {
    const lexemes = pack.records<{ id: string }>('es-a1-a2-core-nouns.jsonl');
    expect(lexemes.some((lexeme) => lexeme.id === 'core-es:lexeme:frio')).toBe(true);

    const translations = pack.records<{ ref: string }>('es-a1-a2-core-translations-en.jsonl');
    expect(translations.some((entry) => entry.ref === 'core-es:lexeme:frio')).toBe(true);
  });

  it('holds no item id, so the one it used to own is retired not reused', () => {
    expect(pack.read('id-ledger.tsv')).toMatch(/^500230\tnoun-card\tretired/m);
  });
});

describe('the duplicate-text guard', () => {
  it('fails the build when a word card repeats an adjective card', () => {
    // `bueno` is already an adjective card; a noun of the same lemma collides.
    pack.append(NOUNS, 'bueno\tgood thing\tm\t\ta1\tcore');

    const error = buildError();
    expect(error).toContain('Duplicate item text');
    expect(error).toContain('bueno');
  });

  it('names the sentinel as a way out, since one of the pair may be lexeme-only', () => {
    expect(buildError()).toContain('id column');
  });

  it('fails the build when a word card repeats a sentence', () => {
    pack.write(NOUNS, pack.read(NOUNS).replace(/\nbueno\tgood thing.*\n?$/, '\n'));
    // A sentence whose whole text is a word that already has a card.
    pack.append('sentences-core.tsv', 'refrigerador\tfridge\ta1\thome');

    const error = buildError();
    expect(error).toContain('refrigerador');
    // The collision is across sources, which is what the guard used to miss.
    expect(error).toContain('word card');
    expect(error).not.toContain('bueno');
  });
});
