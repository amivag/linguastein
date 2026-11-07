/**
 * Two words that differ only by an accent share one lexeme-id stem, and this is
 * the ratchet that stops a new pair arriving unnoticed.
 *
 * `content/es` has eight, all `tilde diacrítica` pairs whose ids are already
 * shipped and permanent. The point of recording them is what it makes possible
 * elsewhere: German's `schon`/`schön` is the same accident with no history, and
 * an alphabet `slug` cannot spell collides on every word at once — so a
 * collision the file does not name has to fail rather than take an id belonging
 * to another word. See `docs/tasks/language-matrix.md` §1.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createScratchPack, repoRoot } from '../fixtures/dataset';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FILE = 'stem-collisions.tsv';
const shipped = readFileSync(join(repoRoot, 'content/es', FILE), 'utf8');

describe('the shipped record', () => {
  it('names both lemmas of every pair, in claim order', () => {
    const rows = shipped
      .split(/\r?\n/)
      .filter((line) => line.trim() && !line.startsWith('#'))
      .map((line) => line.split('\t'));

    expect(rows.length).toBeGreaterThan(0);
    for (const [stem, lemmas] of rows) {
      // A row that named one lemma would record a collision without saying what
      // it collided with, which is the fact the order guard needs.
      expect(lemmas?.split(',').length).toBeGreaterThan(1);
      expect(stem).toBeTruthy();
    }
  });
});

describe('the build gate', () => {
  const pack = createScratchPack('stem-collisions');
  beforeAll(() => {
    expect(pack.tryBuild().ok).toBe(true);
  });
  afterAll(() => pack.dispose());

  it('rejects a collision the file does not record', () => {
    // Dropping `el`/`él` is what a *new* language's first collision looks like
    // to the build: a pair claiming one stem with nothing declaring it expected.
    pack.write(
      FILE,
      pack
        .read(FILE)
        .split(/\r?\n/)
        .filter((line) => !line.startsWith('el\t'))
        .join('\n'),
    );

    const { ok, output } = pack.tryBuild();
    expect(ok).toBe(false);
    expect(output).toContain('"él" and "el" all slug to "el"');
    // The message has to offer both fixes, or the only visible way out of it is
    // a row here — which for a new language is the wrong one.
    expect(output).toContain('transliteration');
    expect(output).toContain(FILE);
  });

  it('rejects a swap in claim order, because the ids move with it', () => {
    pack.write(FILE, shipped.replace('el\tél,el\t', 'el\tel,él\t'));

    const { ok, output } = pack.tryBuild();
    expect(ok).toBe(false);
    expect(output).toContain('recorded as el,él but is now claimed by él,el');
  });

  it('rejects a recorded collision that no longer exists', () => {
    pack.write(FILE, `${shipped.trimEnd()}\nquux\tqu,ux\tnot a real pair\n`);

    const { ok, output } = pack.tryBuild();
    expect(ok).toBe(false);
    expect(output).toContain('"quux" no longer collides');
  });

  it('accepts the shipped record', () => {
    pack.write(FILE, shipped);
    expect(pack.tryBuild().ok).toBe(true);
  });
});
