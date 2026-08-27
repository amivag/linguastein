/**
 * The letter index and the letter filter, held against each other.
 *
 * `alphabet.ts` opens by saying why both halves live in one file: *shown
 * `¿Tienes tiempo?` under T and then sorted above `agua`, a learner has been
 * given two different alphabets*. The same argument applies one layer up, to the
 * chip a learner taps and the query it runs — and that pair had no test, which is
 * how the `Ñ` fold could be moved out of `alphabet.ts` without anything noticing
 * if the two sides had come to disagree.
 *
 * They can now, in a way they could not before: the fold is a language's answer
 * rather than a constant (`docs/tasks/language-matrix.md` §6), so the index and
 * the filter agreeing is a property of how the repository is *composed* and not
 * of one pure function. Hence a test at this level.
 */

import { describe, expect, it } from 'vitest';
import { ContentRepository } from '../../src/domain/content';
import type { ContentPack, ItemId, PackId } from '../../src/domain/content';
import { standaloneLetters } from '../../src/languages/runtime';
import { id } from '../fixtures/pack';

/** Words chosen so folding `Ñ` and not folding it give different answers. */
const WORDS = ['ñoño', 'niño', 'nada', 'árbol', 'Ávila', '123'];

function packOf(packId: string, language: string): ContentPack {
  const owner = id<PackId>(packId);
  return {
    manifest: {
      id: owner,
      name: packId,
      targetLanguage: language,
      version: '1.0.0',
      levels: ['a1'],
      files: [{ kind: 'items', path: 'items.jsonl' }],
    },
    items: WORDS.map((text, index) => ({
      id: id<ItemId>(`${packId}:item:${String(index).padStart(6, '0')}`),
      pack: owner,
      type: 'word' as const,
      text,
      level: 'a1',
    })),
    lexemes: [],
    senses: [],
    forms: [],
    skills: [],
    translations: [],
    passages: [],
    audio: [],
  };
}

const spanish = ContentRepository.from([packOf('core-es', 'es')], { standaloneLetters });
/** The same words, composed with no language rules at all. */
const bare = ContentRepository.from([packOf('core-es', 'es')]);

describe('a Spanish letter index', () => {
  it('offers Ñ as a letter of its own, between N and O', () => {
    const letters = spanish.initials({}, 'es').map((facet) => facet.letter);
    expect(letters).toEqual(['A', 'N', 'Ñ', '#']);
  });

  it('returns exactly what the chip promised, for every chip', () => {
    // The property, asserted over the whole index rather than on `Ñ` alone: the
    // counts a learner reads and the rows a tap produces are the same numbers.
    for (const facet of spanish.initials({}, 'es')) {
      expect(spanish.query({ initial: facet.letter })).toHaveLength(facet.count);
    }
  });

  it('finds ñ from a lower-case chip, since a URL may carry either', () => {
    expect(spanish.query({ initial: 'ñ' }).map((item) => item.text)).toEqual(['ñoño']);
  });

  it('keeps n and ñ apart in both directions', () => {
    expect(spanish.query({ initial: 'N' }).map((item) => item.text)).toEqual(['niño', 'nada']);
    expect(spanish.query({ initial: 'Ñ' }).map((item) => item.text)).toEqual(['ñoño']);
  });
});

describe('the same words with no language rules', () => {
  it('folds ñ into n, and the two halves still agree with each other', () => {
    const letters = bare.initials({}, 'es').map((facet) => facet.letter);
    expect(letters).toEqual(['A', 'N', '#']);

    for (const facet of bare.initials({}, 'es')) {
      expect(bare.query({ initial: facet.letter })).toHaveLength(facet.count);
    }
    expect(bare.query({ initial: 'N' })).toHaveLength(3);
  });
});

describe('two languages in one repository', () => {
  it('buckets each pack by its own language', () => {
    const both = ContentRepository.from([packOf('core-es', 'es'), packOf('core-fr', 'fr')], {
      standaloneLetters,
    });

    // `ñoño` files under Ñ on the Spanish side and under N on the French one. The
    // chip is read in the index's vocabulary — the union — so asking for Ñ gets the
    // Spanish word and not the three French ones that merely fold to N.
    expect(both.query({ initial: 'Ñ' }).map((item) => item.pack)).toEqual(['core-es']);
    expect(both.query({ initial: 'N' }).map((item) => item.pack)).toEqual([
      'core-es',
      'core-es',
      'core-fr',
      'core-fr',
      'core-fr',
    ]);
  });
});
