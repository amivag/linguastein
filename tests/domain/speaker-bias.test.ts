/**
 * The learner's own form leads. It never excludes the other one.
 *
 * This is the distinction the feature turns on, and it is easy to lose in a
 * refactor: `Estoy cansado` and `Estoy cansada` are both Spanish, and a learner
 * who is only ever shown their own half cannot understand the other half when
 * somebody says it to them. So the setting decides what is met *first*, and a
 * long enough session still contains both — the same rule `focus` follows, for a
 * sharper reason.
 */

import { describe, expect, it } from 'vitest';
import type { ItemId, LearningItem, PackId, SpeakerGender } from '../../src/domain/content';
import { ContentRepository } from '../../src/domain/content';
import { planSession } from '../../src/domain/sessions';
import type { SessionConfig } from '../../src/domain/sessions';

const pack = (): PackId => 'bias-es' as PackId;

function sentence(local: string, gender?: SpeakerGender): LearningItem {
  return {
    id: `bias-es:item:${local}` as ItemId,
    pack: pack(),
    type: 'sentence',
    text: `sentence ${local}`,
    level: 'a1',
    ...(gender ? { speakerGender: gender } : {}),
  };
}

/** Four unmarked sentences and one marked pair, which is the pack's own ratio. */
const ITEMS: readonly LearningItem[] = [
  sentence('001', 'feminine'),
  sentence('002'),
  sentence('003'),
  sentence('004', 'masculine'),
  sentence('005'),
  sentence('006'),
];

const repository = ContentRepository.from([
  {
    manifest: {
      id: pack(),
      name: 'Bias',
      targetLanguage: 'es',
      version: '1.0.0',
      levels: ['a1'],
      referenceLanguages: ['en'],
      files: [],
    },
    items: ITEMS,
    lexemes: [],
    senses: [],
    forms: [],
    skills: [],
    translations: [],
    passages: [],
    audio: [],
  },
]);

function plan(speakerGender: SpeakerGender | undefined, size: number): readonly ItemId[] {
  const config: SessionConfig = {
    mode: 'practice',
    filter: {},
    size: { kind: 'items', count: size },
    ordering: 'smart',
    exerciseKinds: ['reveal'],
    referenceLanguage: 'en',
    pronunciationLocale: 'es-ES',
    seed: 7,
    ...(speakerGender ? { speakerGender } : {}),
  };

  return planSession({ repository, config, progress: new Map(), now: 1 }).itemIds;
}

const at = (ids: readonly ItemId[], local: string) =>
  ids.indexOf(`bias-es:item:${local}` as ItemId);

describe('the learner’s own form', () => {
  it('is met before the other one', () => {
    const masculine = plan('masculine', 6);
    const feminine = plan('feminine', 6);

    expect(at(masculine, '004')).toBeLessThan(at(masculine, '001'));
    expect(at(feminine, '001')).toBeLessThan(at(feminine, '004'));
  });

  it('does not push the other one out of a session that has room for it', () => {
    // The assertion the whole design rests on. A filter would have made this
    // list five long and nothing would have said which sentence went missing.
    expect(plan('masculine', 6)).toHaveLength(6);
    expect(plan('masculine', 6)).toContain('bias-es:item:001' as ItemId);
  });

  it('leaves unmarked content where it was', () => {
    // Nearly all content is unmarked, and demoting the *other* gender is the
    // whole of the intent: an unmarked sentence must not be reordered around a
    // marked one it has nothing to do with.
    const unbiased = plan(undefined, 6);
    const biased = plan('masculine', 6);

    const unmarked = (ids: readonly ItemId[]) =>
      ids.filter((entry) => !['001', '004'].some((local) => entry.endsWith(local)));

    expect(unmarked(biased)).toEqual(unmarked(unbiased));
  });

  it('changes nothing at all for a learner who has not said', () => {
    expect(plan(undefined, 6)).toEqual(plan(undefined, 6));
    // Same seed, same deal — the setting is the only thing that could differ,
    // and unsaid means it does not participate.
    expect(plan(undefined, 3)).toEqual(plan(undefined, 3));
  });
});
