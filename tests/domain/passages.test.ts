/**
 * Passages are containers, not longer items: they order sentences that stay
 * independently practisable. These tests hold that boundary, because the moment
 * a passage owns its text instead of referencing items, the exercise engine and
 * mastery both lose sight of the sentences inside it.
 */

import { describe, expect, it } from 'vitest';
import type { ItemId, PassageId } from '../../src/domain/content';
import { id, testRepository } from '../fixtures/pack';

const repository = testRepository();
const TEXT = id<PassageId>('test-es:passage:700001');
const DIALOGUE = id<PassageId>('test-es:passage:700002');

describe('passages in the repository', () => {
  it('keeps them in pack order', () => {
    expect(repository.allPassages().map((passage) => passage.id)).toEqual([TEXT, DIALOGUE]);
  });

  it('resolves its sentences in reading order', () => {
    expect(repository.itemsOfPassage(TEXT).map((item) => item.text)).toEqual([
      'Tengo que trabajar.',
      'Tengo que irme.',
    ]);
  });

  it('leaves the sentences as ordinary practisable items', () => {
    const [first] = repository.itemsOfPassage(TEXT);

    // Same record the practice engine sees — tokens, lexemes, skills and all.
    expect(first).toBe(repository.getItem(id<ItemId>('test-es:item:001')));
    expect(first?.type).toBe('sentence');
    expect(first?.tokens?.length).toBeGreaterThan(0);
  });

  it('points from a sentence back to the texts it appears in', () => {
    // `002` is reused by both fixture passages, which is legitimate: a sentence
    // can read in more than one context.
    expect(repository.passagesOfItem(id<ItemId>('test-es:item:002')).map((p) => p.id)).toEqual([
      TEXT,
      DIALOGUE,
    ]);
    expect(repository.passagesOfItem(id<ItemId>('test-es:item:004'))).toEqual([]);
  });

  it('resolves the local id a route carries', () => {
    expect(repository.passageByRef('700001')?.id).toBe(TEXT);
    expect(repository.passageByRef('nope')).toBeUndefined();
  });

  it('names a speaker per line of a dialogue', () => {
    const dialogue = repository.getPassage(DIALOGUE);
    expect(dialogue?.speakers).toHaveLength(dialogue?.items.length ?? 0);
  });

  it('returns nothing for an unknown passage rather than throwing', () => {
    expect(repository.getPassage(id<PassageId>('test-es:passage:999999'))).toBeUndefined();
    expect(repository.itemsOfPassage(id<PassageId>('test-es:passage:999999'))).toEqual([]);
  });
});

describe('scoping a query to a passage', () => {
  it('keeps only the named items', () => {
    const passage = repository.getPassage(TEXT)!;
    const scoped = repository.query({ ids: passage.items });

    expect(scoped.map((item) => item.id)).toEqual([...passage.items]);
  });

  it('composes with the other filters', () => {
    const passage = repository.getPassage(TEXT)!;
    expect(repository.query({ ids: passage.items, types: ['word'] })).toEqual([]);
  });

  it('treats an empty id list as no items, not as no constraint', () => {
    // The trap this avoids: a passage id that does not resolve would otherwise
    // fall back to an allow-list of nothing and practise the entire pack.
    expect(repository.query({ ids: [] })).toEqual([]);
    expect(repository.query({}).length).toBe(repository.itemCount);
  });
});
