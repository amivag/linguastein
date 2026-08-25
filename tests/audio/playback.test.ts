/**
 * Reading the playing state against what is on screen: which line is speaking,
 * and which word inside it.
 *
 * The mapping from a character offset to a token is the whole of the karaoke
 * highlight, and it is deliberately pure — the engine's event shape stops at the
 * provider seam, and nothing above it knows how a boundary arrived.
 */

import { describe, expect, it } from 'vitest';
import { isSpeaking, speakingToken, type PlaybackState } from '../../src/audio';
import { wordAt } from '../../src/audio/web-speech-provider';
import { WHOLE_ITEM_TOKEN, type ItemId } from '../../src/domain/content';
import { id, testRepository } from '../fixtures/pack';

const repository = testRepository();
const sentence = repository.getItem(id<ItemId>('test-es:item:001'))!;
const other = repository.getItem(id<ItemId>('test-es:item:002'))!;
const word = repository.getItem(id<ItemId>('test-es:item:004'))!;

function playing(overrides: Partial<PlaybackState> = {}): PlaybackState {
  return {
    itemId: sentence.id,
    text: sentence.text,
    index: 0,
    total: 1,
    paused: false,
    ...overrides,
  };
}

describe('what is speaking', () => {
  it('matches an item by id', () => {
    expect(isSpeaking(playing(), sentence)).toBe(true);
    expect(isSpeaking(playing(), other)).toBe(false);
    expect(isSpeaking(null, sentence)).toBe(false);
  });

  it('falls back to the text for a phrase spoken outside any item', () => {
    // A response palette and a variation both speak a bare string, and both are
    // shown as the phrase they came from.
    const bare: PlaybackState = { text: sentence.text, index: 0, total: 1, paused: false };

    expect(isSpeaking(bare, sentence)).toBe(true);
    expect(isSpeaking(bare, other)).toBe(false);
  });
});

describe('the word being spoken', () => {
  // `Tengo que trabajar.` — t1 at 0, t2 at 6, t3 at 10.
  it('finds the token the offsets land in', () => {
    expect(speakingToken(playing({ span: { start: 0, end: 5 } }), sentence)).toBe('t1');
    expect(speakingToken(playing({ span: { start: 10, end: 18 } }), sentence)).toBe('t3');
  });

  it('takes the first token a span overlaps, so a clause still lights a word', () => {
    // Engines that report a phrase rather than a word, and offsets that sit a
    // character out, are both common enough to be worth surviving.
    expect(speakingToken(playing({ span: { start: 5, end: 12 } }), sentence)).toBe('t2');
  });

  it('says nothing when the engine reports no boundaries', () => {
    expect(speakingToken(playing(), sentence)).toBeUndefined();
  });

  it('says nothing about a phrase that is not the one playing', () => {
    expect(speakingToken(playing({ span: { start: 0, end: 5 } }), other)).toBeUndefined();
  });

  it('lights a word card whole, boundaries or not', () => {
    const card = playing({ itemId: word.id, text: word.text });

    expect(speakingToken(card, word)).toBe(WHOLE_ITEM_TOKEN);
  });
});

describe('the word an engine reports', () => {
  it('trusts a length where the engine gives one', () => {
    expect(wordAt('Tengo que trabajar.', 10, 8)).toEqual({ start: 10, end: 18 });
  });

  it('measures the word itself where it does not', () => {
    // Safari has never set `charLength`; a zero there used to leave the
    // highlight one character wide.
    expect(wordAt('Tengo que trabajar.', 10, 0)).toEqual({ start: 10, end: 19 });
    expect(wordAt('Tengo que trabajar.', 0, 0)).toEqual({ start: 0, end: 5 });
  });
});
