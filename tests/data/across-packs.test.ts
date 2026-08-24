/**
 * Checks that hold *between* packs, which no per-pack pass can see.
 *
 * This is the add-on failure mode. A URL addresses a passage and a skill by
 * their **local** id — `/es/all/read/700001`, `?skill=preterite` — deliberately,
 * so a shared link does not carry a pack namespace it will outlive. That used to
 * make the lookups first-match-wins: free with one pack, silently wrong with two.
 *
 * Two things hold it now, and they are complementary rather than redundant.
 * `validateAcrossPacks` refuses to *ship* a collision, which covers packs built
 * together. `resolveRef` refuses to *guess* on one, which covers the case
 * validation cannot see — a learner installing two packs whose authors never met.
 */

import { describe, expect, it } from 'vitest';
import { validateAcrossPacks } from '../../src/data/validation';
import { ContentRepository } from '../../src/domain/content';
import type { ContentPack, ItemId, PassageId, SkillId } from '../../src/domain/content';
import { id, TEST_PACK, TEST_PACK_FR } from '../fixtures/pack';

const withPassage = (pack: ContentPack, local: string): ContentPack => ({
  ...pack,
  passages: [
    ...pack.passages,
    {
      id: id<PassageId>(`${pack.manifest.id}:passage:${local}`),
      pack: pack.manifest.id,
      kind: 'text',
      title: `Passage ${local}`,
      items: [],
    },
  ],
});

const withSkill = (pack: ContentPack, local: string): ContentPack => ({
  ...pack,
  skills: [
    ...pack.skills,
    {
      id: id<SkillId>(`${pack.manifest.id}:skill:${local}`),
      kind: 'pattern',
      label: local,
    },
  ],
});

const withItem = (pack: ContentPack, local: string): ContentPack => ({
  ...pack,
  items: [
    ...pack.items,
    {
      id: id<ItemId>(`${pack.manifest.id}:item:${local}`),
      pack: pack.manifest.id,
      type: 'sentence',
      text: `Item ${local}`,
      level: 'a1',
    },
  ],
});

describe('validateAcrossPacks', () => {
  it('passes when local ids are unique across the packs', () => {
    expect(validateAcrossPacks([TEST_PACK, TEST_PACK_FR])).toEqual([]);
  });

  it('passes for a single pack whatever it contains', () => {
    expect(validateAcrossPacks([withPassage(TEST_PACK, '700001')])).toEqual([]);
  });

  /**
   * The worst failure shape available: not an error, not an empty screen, but
   * confidently the wrong text. So it is an error at validation time instead.
   */
  it('rejects two packs claiming one passage local id', () => {
    const issues = validateAcrossPacks([
      withPassage(TEST_PACK, '700001'),
      withPassage(TEST_PACK_FR, '700001'),
    ]);

    expect(issues).toHaveLength(1);
    expect(issues[0]?.severity).toBe('error');
    expect(issues[0]?.message).toContain('passage local id "700001"');
    expect(issues[0]?.source).toContain('test-es');
    expect(issues[0]?.source).toContain('test-fr');
  });

  /**
   * Items collide the most readily of the three and were checked the last.
   *
   * No *link* addresses an item by local id, which is why this was missed: the
   * caller is `src/app/missions.ts`, where a response palette names its
   * sentences as `{ item: '001147' }` and `itemByLocalId` takes the first
   * match. Two packs from one generator both number from `000001`, so a second
   * language does not merely risk this — it guarantees it on item one.
   */
  it('rejects two packs claiming one item local id', () => {
    const issues = validateAcrossPacks([
      withItem(TEST_PACK, '001147'),
      withItem(TEST_PACK_FR, '001147'),
    ]);

    expect(issues).toHaveLength(1);
    expect(issues[0]?.severity).toBe('error');
    expect(issues[0]?.message).toContain('item local id "001147"');
    expect(issues[0]?.source).toContain('test-es');
    expect(issues[0]?.source).toContain('test-fr');
  });

  it('rejects two packs claiming one skill local id', () => {
    const issues = validateAcrossPacks([
      withSkill(TEST_PACK, 'preterite'),
      withSkill(TEST_PACK_FR, 'preterite'),
    ]);

    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toContain('skill local id "preterite"');
  });

  it('leaves a repeat inside one pack to the per-pack integrity check', () => {
    // Reported against the pack that has it, with the id that is duplicated —
    // saying it twice, once here, would send a reader looking for a second bug.
    const doubled = withPassage(withPassage(TEST_PACK, '700001'), '700001');

    expect(validateAcrossPacks([doubled])).toEqual([]);
  });
});

/**
 * Resolving a reference once two packs can answer it.
 *
 * `validateAcrossPacks` above refuses to *ship* a collision, but a learner can
 * install two packs the pack authors never saw together, so the resolver has to
 * hold on its own.
 */
describe('resolving a content reference', () => {
  const twoPacks = () =>
    ContentRepository.from([withPassage(TEST_PACK, '700001'), withPassage(TEST_PACK_FR, '700001')]);

  it('resolves a bare reference while exactly one pack claims it', () => {
    const one = ContentRepository.from([withPassage(TEST_PACK, '700001')]);
    expect(one.passageByRef('700001')?.id).toBe('test-es:passage:700001');
  });

  it('resolves a qualified reference to the pack it names', () => {
    const both = twoPacks();
    expect(both.passageByRef('test-es:700001')?.id).toBe('test-es:passage:700001');
    expect(both.passageByRef('test-fr:700001')?.id).toBe('test-fr:passage:700001');
  });

  /**
   * The whole point. `find(id => id.endsWith(':passage:700001'))` returned
   * whichever pack loaded first — confidently the wrong text, which is worse
   * than an error because nothing announces it.
   */
  it('refuses to guess when a bare reference is contested', () => {
    const both = twoPacks();
    expect(both.passageByRef('700001')).toBeUndefined();

    const resolved = both.resolvePassage('700001');
    expect(resolved.kind).toBe('ambiguous');
    // Named, so a screen can say which packs rather than only that it failed.
    expect(resolved.kind === 'ambiguous' && resolved.packs).toEqual(['test-es', 'test-fr']);
  });

  it('separates "no pack has this" from "several do"', () => {
    const both = twoPacks();
    expect(both.resolvePassage('nope').kind).toBe('missing');
    expect(both.resolvePassage('test-es:nope').kind).toBe('missing');
    expect(both.resolvePassage('no-such-pack:700001').kind).toBe('missing');
  });

  it('treats an empty reference as missing rather than matching everything', () => {
    expect(twoPacks().resolvePassage('').kind).toBe('missing');
    expect(twoPacks().resolvePassage('   ').kind).toBe('missing');
  });

  it('applies the same rules to skills, which collide more readily', () => {
    // Skill slugs are English-ish words, so two Spanish packs colliding on
    // `preterite` is close to certain where passage ids are merely likely.
    const both = ContentRepository.from([
      withSkill(TEST_PACK, 'preterite'),
      withSkill(TEST_PACK_FR, 'preterite'),
    ]);
    expect(both.skillByRef('preterite')).toBeUndefined();
    expect(both.resolveSkill('preterite').kind).toBe('ambiguous');
    expect(both.skillByRef('test-fr:preterite')?.id).toBe('test-fr:skill:preterite');
  });
});
