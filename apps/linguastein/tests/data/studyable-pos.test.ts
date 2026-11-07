/**
 * `STUDYABLE_POS` must name only categories the app can actually show.
 *
 * Two lists decide whether a part of speech is a set a learner can pick:
 * `CARD_POS` in the build (`{ADJ, NUM}`) decides which rows get an id and so
 * which become word cards, and `STUDYABLE_POS` in the domain decides which are
 * offered. `ADV` was in the second and absent from the first, so Study derived
 * an Adverbs tile, counted it with the filter that tile links to, got zero, and
 * dropped it. Every rule worked as designed; the outcome was a list calling
 * fifty-six adverbs studiable while nothing could reach one.
 *
 * That is invisible to review by construction — the symptom is a tile that never
 * appears — so it needs an assertion rather than a reader. Removing `ADV` fixed
 * today's instance; this is what stops the next one, in either direction: adding
 * a tag with no cards behind it, or giving cards to a tag nobody can pick.
 *
 * Read against the pack that ships, not against `CARD_POS`, because a card also
 * needs an example sentence and a lexeme that resolves. The question is whether
 * a learner choosing this category finds anything, and only the pack answers it.
 */

import { describe, expect, it } from 'vitest';
import { POS_TAGS, STUDYABLE_POS, type PartOfSpeech } from '../../src/domain/content/annotation';
import { shippedRecords } from '../fixtures/dataset';

interface Lexeme {
  readonly id: string;
  readonly pos: string;
}

interface Item {
  readonly type?: string;
  readonly lexemes?: readonly string[];
}

/** Part of speech of every lexeme the pack ships, by id. */
const posById = new Map<string, string>();
for (const file of ['nouns', 'verbs', 'modifiers'] as const) {
  for (const lexeme of shippedRecords<Lexeme>(file)) posById.set(lexeme.id, lexeme.pos);
}

/** How many word cards the pack ships for each part of speech. */
const cardsByPos = new Map<string, number>();
for (const card of shippedRecords<Item>('vocabulary')) {
  if (card.type !== 'word') continue;
  for (const id of card.lexemes ?? []) {
    const pos = posById.get(id);
    if (pos === undefined) continue;
    cardsByPos.set(pos, (cardsByPos.get(pos) ?? 0) + 1);
  }
}

const cardsFor = (pos: PartOfSpeech) => cardsByPos.get(pos) ?? 0;

describe('the studiable parts of speech', () => {
  it('offers no category the shipped pack cannot fill', () => {
    const empty = STUDYABLE_POS.filter((pos) => cardsFor(pos) === 0);
    expect(
      empty,
      'a part of speech in STUDYABLE_POS with no word cards behind it is a category ' +
        'Study derives, counts as zero and silently drops — either give it cards or ' +
        'take it off the list, and say which in docs/tasks/function-words.md',
    ).toEqual([]);
  });

  it('names every part of speech the pack does give cards to', () => {
    // The other direction, and the one that would go unnoticed longest: cards
    // exist, a learner has no way to ask for them, and nothing looks wrong.
    const carded = POS_TAGS.filter((pos) => cardsFor(pos) > 0);
    const offered = new Set<string>(STUDYABLE_POS);
    expect(
      carded.filter((pos) => !offered.has(pos)),
      'these parts of speech have word cards in the pack and are not offered as a set',
    ).toEqual([]);
  });

  it('is a subset of the tag inventory, so a slug always round-trips', () => {
    expect(POS_TAGS).toEqual(expect.arrayContaining([...STUDYABLE_POS]));
  });
});
