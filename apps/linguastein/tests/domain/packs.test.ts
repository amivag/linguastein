/**
 * What a pack contains, counted rather than claimed.
 *
 * The rule under test is the one Study got wrong once and had to be fixed for:
 * count with the filter the label describes. "Word cards" is not "items
 * exemplifying a word", and the difference in the shipped pack is 546 against 0.
 */

import { describe, expect, it } from 'vitest';
import { installedPacks, issueBelongsTo, packContents } from '../../src/domain/content';
import type { PackId } from '../../src/domain/content';
import { ITEMS, testRepository, TEST_PACK_ID } from '../fixtures/pack';

const repository = () => testRepository();

describe('packContents', () => {
  it('counts each type with the filter that names it', () => {
    const contents = packContents(repository(), TEST_PACK_ID);
    if (!contents) throw new Error('the fixture pack should be loaded');

    expect(contents.items).toBe(ITEMS.length);
    expect(contents.words).toBe(ITEMS.filter((item) => item.type === 'word').length);
    expect(contents.phrases).toBe(ITEMS.filter((item) => item.type === 'phrase').length);
    expect(contents.sentences).toBe(ITEMS.filter((item) => item.type === 'sentence').length);
    // The three types are a partition of the items, so a miscount anywhere shows
    // up here even where the fixture happens to have none of one kind.
    expect(contents.words + contents.phrases + contents.sentences).toBe(contents.items);
  });

  it('counts passages and skills, which carry their pack differently', () => {
    // A passage has a `pack` field; a skill only has its namespace, so the two
    // are found by different routes and both have to work.
    const contents = packContents(repository(), TEST_PACK_ID);

    expect(contents?.passages).toBeGreaterThan(0);
    expect(contents?.skills).toBeGreaterThan(0);
  });

  it('counts only the categories something actually uses', () => {
    /*
     * The fixture declares `colours` and puts nothing in it, and uses `everyday`
     * without declaring it — so a count of *declared* topics would both advertise
     * a category that opens an empty sheet and miss one that does not. The same
     * rule Study's tiles follow: count what the label leads to.
     */
    const contents = packContents(repository(), TEST_PACK_ID);
    const used = new Set(ITEMS.flatMap((item) => item.topics ?? []));

    expect(used.has('colours')).toBe(false);
    expect(contents?.topics).toBe(used.size);
  });

  it('reports what the manifest declares about itself', () => {
    const contents = packContents(repository(), TEST_PACK_ID);

    expect(contents?.manifest.name).toBe('Test Spanish');
    expect(contents?.manifest.version).toBe('1.0.0');
    expect(contents?.voices).toBe(3);
    expect(contents?.hasAudio).toBe(true);
  });

  it('is absent for a pack that is not loaded, rather than empty', () => {
    // Zero of everything is a real answer for a pack that failed validation, so
    // a caller has to be able to tell that from a pack that was never there.
    expect(packContents(repository(), 'no-such-pack' as PackId)).toBeUndefined();
  });
});

describe('installedPacks', () => {
  it('lists every loaded pack in load order', () => {
    const packs = installedPacks(repository());

    expect(packs.map((pack) => pack.manifest.id)).toEqual([TEST_PACK_ID]);
  });
});

describe('issueBelongsTo', () => {
  const manifest = repository().getPack(TEST_PACK_ID)!;

  it('attributes an issue to the pack whose file it names', () => {
    expect(issueBelongsTo(manifest, 'items.jsonl')).toBe(true);
    // A source may arrive with the pack directory in front of it.
    expect(issueBelongsTo(manifest, 'test-es/items.jsonl')).toBe(true);
  });

  it('does not claim another pack’s file', () => {
    expect(issueBelongsTo(manifest, 'other-items.jsonl')).toBe(false);
    expect(issueBelongsTo(manifest, 'somewhere/else.jsonl')).toBe(false);
  });
});
