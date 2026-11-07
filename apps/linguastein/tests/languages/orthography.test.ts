/**
 * The seam that decides which letters survive into an id.
 *
 * Lexeme and form ids are a lemma reduced to `[a-z0-9-]`. The reduction belongs
 * to the id scheme and is the same for every pack; which letters must not be lost
 * on the way is the *language's* convention, and it lived in
 * `scripts/build-dataset.ts` as a Spanish regex until `language-matrix.md` §1 said
 * why that was the wrong home: German's `schon`/`schön` and Greek's
 * every-lemma-slugs-to-nothing had nowhere to be fixed.
 *
 * Two halves are asserted. Spanish's own rule, which is a real shipped bug rather
 * than a hypothetical — and the refusal, which is what makes the seam load-bearing
 * for a language nobody has written yet: an alphabet the module cannot romanise
 * has to fail the build rather than hand every word one id.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spanish } from '../../src/languages/es';
import { transliterate } from '../../src/languages/es/orthography';
import { createScratchPack, type ScratchPack } from '../fixtures/dataset';

/** The build's half: what `slug` does once the language has had its say. */
const reduce = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const stem = (lemma: string) => reduce(transliterate(lemma));

describe("Spanish's transliteration", () => {
  it('keeps ñ apart from n, because año and ano are different words', () => {
    expect(stem('año')).toBe('anno');
    expect(stem('ano')).toBe('ano');
    expect(stem('año')).not.toBe(stem('ano'));
  });

  it('keeps the letter names apart, which is the bug it was written for', () => {
    // `eñe` and `ene` folded to one stem, and the *form* ids had no collision
    // guard — so the pack shipped one letter's plural under the other's id.
    expect(stem('eñe')).toBe('enne');
    expect(stem('ene')).toBe('ene');
  });

  it('protects the pairs no content has reached yet', () => {
    for (const [withTilde, without] of [
      ['caña', 'cana'],
      ['peña', 'pena'],
      ['sueño', 'sueno'],
    ]) {
      expect(stem(withTilde!)).not.toBe(stem(without!));
    }
  });

  it('leaves the accents to fold, which is why eight pairs are recorded instead', () => {
    // Deliberate, and the reason `content/es/stem-collisions.tsv` exists: these
    // ids are permanent and learner mastery is keyed on them, so the pairs are
    // recorded rather than fixed. A new language fixes the same accident in its
    // own `transliterate`.
    expect(stem('té')).toBe(stem('te'));
    expect(stem('él')).toBe(stem('el'));
  });

  it('is what the module offers the build, not a private helper', () => {
    // The seam, asserted rather than assumed: the build reaches this through
    // `LanguageModule`, so a module that forgot to wire it would silently get the
    // bare fold and quietly rename nineteen lexemes.
    expect(spanish.transliterate).toBeDefined();
    expect(spanish.transliterate!('año')).toBe(transliterate('año'));
  });
});

describe('a script the module cannot romanise', () => {
  let pack: ScratchPack;

  beforeAll(() => {
    pack = createScratchPack('linguastein-orthography');
  }, 120_000);

  afterAll(() => {
    pack.dispose();
  });

  it('fails the build rather than giving every word one id', () => {
    // Greek through Spanish's transliteration reduces to nothing, which is the
    // honest state of a language whose orthography nobody has written: with an
    // empty stem there is no pair to record and no suffix that could rescue it,
    // so `stem-collisions.tsv` is explicitly not the answer here.
    pack.append('nouns.tsv', ['καλημέρα', 'good morning', 'f', '', 'a1', 'greetings'].join('\t'));

    const { ok, output } = pack.tryBuild();
    expect(ok).toBe(false);
    expect(output).toContain('slug is empty');
    expect(output).toContain('transliteration');
  });
});
