/**
 * A noun's gender is read, never defaulted.
 *
 * The build used to read `f` as feminine and everything else as masculine, so a
 * neuter noun or a typo shipped as masculine without a word. Neuter is now a
 * value of its own (see `second-language-build.test.ts`), and anything that is
 * not `m`, `f` or `n` fails the build by name.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createScratchPack, type ScratchPack } from '../fixtures/dataset';

let scratch: ScratchPack;

beforeAll(() => {
  scratch = createScratchPack('noun-gender');
});

afterAll(() => scratch.dispose());

describe('the noun gender gate', () => {
  it('refuses a gender letter it does not know', () => {
    scratch.append('nouns.tsv', 'tortuga\ttortoise\tx\t\ta1\tanimals\t\t');

    const result = scratch.tryBuild();

    expect(result.ok).toBe(false);
    expect(result.output).toContain('nouns.tsv (tortuga): gender "x" is not m, f or n');
  });
});
