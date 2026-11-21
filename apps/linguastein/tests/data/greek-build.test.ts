/**
 * Greek text tokenises.
 *
 * The build's word pattern was a Spanish character class, so a Greek sentence
 * produced punctuation and nothing else — no word tokens to link, look up or
 * practise, and no error to say so. This builds a sentence-only `el` pack and
 * checks the words come out whole, with their accents composed.
 *
 * Sentence-only on purpose: a Greek *lexeme* needs a Latin id stem, which only a
 * Greek module's `transliterate` can supply, and the build already refuses an
 * empty one by name. That is the next piece of work, not this one.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readJsonl, tryRunScript } from '../fixtures/dataset';

const workspace = mkdtempSync(join(tmpdir(), 'build-el-'));
const content = join(workspace, 'content');
const packs = join(workspace, 'packs');
const write = (name: string, text: string) => writeFileSync(join(content, name), text, 'utf8');

let result: { ok: boolean; output: string };

beforeAll(() => {
  mkdirSync(content, { recursive: true });
  write('levels.tsv', '# Columns: id\tlabel\na1\n');
  write('pack.tsv', '# Columns: version\titems\tupdated\tnote\n0.1.0\t1\t2026-11-21\tfixture\n');
  write(
    'translations.tsv',
    '# Columns: language\tversion\trecords\tupdated\tnote\nen\t0.1.0\t1\t2026-11-21\tfixture\n',
  );
  write(
    'manifest.tsv',
    '# Columns: key\tvalue\nname\tGreek Core\ndescription\tA fixture.\nglossLanguage\ten\n',
  );
  write('verbs.tsv', '# Columns: lemma\tgloss\tlevel\tregularity\ttopics\n');
  write('nouns.tsv', '# Columns: lemma\tgloss\tgender\tplural\tlevel\ttopics\tregions\tregister\n');
  write('modifiers.tsv', '# Columns: lemma\tgloss\tpos\tlevel\ttopics\tforms\n');
  write(
    'sentences-core.tsv',
    '# Columns: id\ttarget\tgloss\tlevel\ttopics\tnote\tregister\taddress\tregions\tpassage\tspeaker\tskills\n' +
      // `Είναι` typed decomposed (Ε + ι + U+0301), and `;` — the Greek question
      // mark — closing the sentence.
      'Είναι μεγάλο το σπίτι;\tIs the house big?\ta1\n',
  );

  result = tryRunScript('scripts/build-dataset.ts', {
    args: ['el'],
    env: { LINGUASTEIN_CONTENT_DIR: content, LINGUASTEIN_PACKS_DIR: packs },
  });
});

afterAll(() => rmSync(workspace, { recursive: true, force: true }));

describe('building a Greek sentence', () => {
  it('builds', () => {
    expect(result.ok, result.output).toBe(true);
  });

  it('splits it into whole words, composed, with `;` as punctuation', () => {
    const [sentence] = readJsonl<{ text: string; tokens: { text: string; pos?: string }[] }>(
      join(packs, 'core-el', '0.1.0', 'el-a1-core-sentences-a1.jsonl'),
    );

    expect(sentence?.text).toBe('Είναι μεγάλο το σπίτι;');
    expect(sentence?.tokens.map((token) => token.text)).toEqual([
      'Είναι',
      'μεγάλο',
      'το',
      'σπίτι',
      ';',
    ]);
    expect(sentence?.tokens.at(-1)?.pos).toBe('PUNCT');
  });
});
