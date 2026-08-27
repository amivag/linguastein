/**
 * A curriculum reference resolved inside the course that asked for it.
 *
 * A URL addresses a passage and a skill by their **local** id —
 * `/es/all/read/700001`, `?skill=preterite` — deliberately, so a shared link does
 * not carry a pack namespace it will outlive. With one pack that is free. With a
 * second *language* it is guaranteed to collide: two packs from one generator both
 * number their passages from `700001` and their sentences from `000001`, so
 * `validateAcrossPacks` refused to let `core-es` + `core-de` load at all.
 *
 * `docs/tasks/pack-addressing.md` §3 decided the split. Across languages the path
 * already disambiguates — `/de/a1/read/700001` cannot mean the Spanish passage —
 * so a caller that holds a course passes its packs and the bare id is unambiguous
 * again at no cost to link spelling. Within one language nothing in the path helps,
 * so that stays a build-time error.
 *
 * The two properties that make it safe are asserted below and neither is obvious:
 * scoping **narrows** rather than prefers, so a ref naming nothing in scope
 * resolves to nothing rather than to a match in another language; and an
 * unscoped call still refuses to guess.
 */

import { describe, expect, it } from 'vitest';
import { ContentRepository } from '../../src/domain/content';
import { packsOfLanguage } from '../../src/domain/content';
import type { ContentPack, ItemId, PackId, PassageId, SkillId } from '../../src/domain/content';
import { id } from '../fixtures/pack';

/** Two packs of two languages, numbering their content identically. */
function pack(packId: string, language: string): ContentPack {
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
    items: [
      {
        id: id<ItemId>(`${packId}:item:000001`),
        pack: owner,
        type: 'sentence',
        text: `${language} sentence`,
        level: 'a1',
      },
    ],
    lexemes: [],
    senses: [],
    forms: [],
    skills: [{ id: id<SkillId>(`${packId}:skill:preterite`), kind: 'grammar', label: language }],
    translations: [],
    passages: [
      {
        id: id<PassageId>(`${packId}:passage:700001`),
        pack: owner,
        kind: 'text',
        title: `${language} text`,
        items: [],
      },
    ],
    audio: [],
  };
}

const repository = ContentRepository.from([pack('core-es', 'es'), pack('core-de', 'de')]);
const spanish = packsOfLanguage(repository, 'es');
const german = packsOfLanguage(repository, 'de');

describe('a bare reference with two languages loaded', () => {
  it('resolves to the course that asked, for each course', () => {
    expect(repository.passageByRef('700001', spanish)?.id).toBe('core-es:passage:700001');
    expect(repository.passageByRef('700001', german)?.id).toBe('core-de:passage:700001');

    expect(repository.skillByRef('preterite', spanish)?.id).toBe('core-es:skill:preterite');
    expect(repository.skillByRef('preterite', german)?.id).toBe('core-de:skill:preterite');
  });

  it('resolves a mission item the same way, which is where it bites hardest', () => {
    // No *link* addresses an item by local id, but the mission definitions do —
    // `{ item: '001147' }` in a response palette — so every Spanish mission would
    // have resolved against whichever pack the catalog listed first.
    expect(repository.itemByLocalId('000001', spanish)?.id).toBe('core-es:item:000001');
    expect(repository.itemByLocalId('000001', german)?.id).toBe('core-de:item:000001');
  });

  it('refuses to guess when no course was named', () => {
    // The unscoped path is unchanged: contested and bare resolves to nothing, and
    // `resolvePassage` says which packs claimed it.
    expect(repository.passageByRef('700001')).toBeUndefined();

    const contested = repository.resolvePassage('700001');
    expect(contested.kind).toBe('ambiguous');
    expect(contested.kind === 'ambiguous' && contested.packs).toEqual(['core-es', 'core-de']);
  });

  it('narrows rather than prefers, so a scope cannot reach past itself', () => {
    // The property that makes scoping safe rather than merely convenient. If a
    // miss widened to the other packs, `/de/a1/read/700002` would open a Spanish
    // text — which is the failure the whole scheme exists to prevent.
    const onlyGerman = ContentRepository.from([pack('core-de', 'de')]);
    expect(onlyGerman.passageByRef('700001', packsOfLanguage(onlyGerman, 'es'))).toBeUndefined();
    expect(repository.itemByLocalId('000001', [])).toBeUndefined();
  });

  it('still honours a qualified reference, scope or no scope', () => {
    expect(repository.passageByRef('core-de:700001')?.id).toBe('core-de:passage:700001');
    // Qualified *and* out of scope is a miss: the scope is the narrower claim.
    expect(repository.passageByRef('core-de:700001', spanish)).toBeUndefined();
  });
});

describe('the packs a language owns', () => {
  it('is every pack of that language and nothing else', () => {
    expect(spanish).toEqual(['core-es']);
    expect(german).toEqual(['core-de']);
    expect(packsOfLanguage(repository, 'fr')).toEqual([]);
  });
});
