/**
 * Checks that hold *between* packs, which no per-pack pass can see.
 *
 * This is the add-on failure mode. A URL addresses a passage and a skill by
 * their **local** id — `/es/all/read/700001`, `?skill=preterite` — deliberately,
 * so a shared link does not carry a pack namespace it will outlive. That makes
 * `passageByLocalId` and `skillByLocalId` first-match-wins, which is free with
 * one pack and silently wrong with two.
 */

import { describe, expect, it } from 'vitest';
import { validateAcrossPacks } from '../../src/data/validation';
import type { ContentPack, PassageId, SkillId } from '../../src/domain/content';
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
