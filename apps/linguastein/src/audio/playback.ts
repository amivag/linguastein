/**
 * Reading the playing state against what is on screen.
 *
 * Pure functions rather than component code, because both questions a screen
 * asks — "is this line the one speaking?" and "which word is it on?" — have
 * exactly one right answer and three callers each.
 */

import {
  deriveTokenSpans,
  WHOLE_ITEM_TOKEN,
  type LearningItem,
  type TokenId,
} from '../domain/content';
import type { PlaybackState } from './types';

/**
 * Whether this item is the one being spoken.
 *
 * Identity is an id when an item started the playback and the text otherwise:
 * half the callers speak a bare string — a response palette, a variation, a
 * voice sample — that belongs to no item. Matching on text is what lets those
 * light up the phrase they came from; the id is preferred where there is one,
 * so two rows carrying the same sentence cannot both claim it.
 */
export function isSpeaking(state: PlaybackState | null, item: LearningItem): boolean {
  if (state === null) return false;
  return state.itemId === undefined ? state.text === item.text : state.itemId === item.id;
}

/**
 * The token the voice is on, or nothing — which is the common case and not a
 * failure: an engine that reports no word boundaries, an item with no
 * annotation, or simply a phrase that is not the one playing. The caller shows
 * the line as playing either way and treats the word as the bonus it is.
 */
export function speakingToken(
  state: PlaybackState | null,
  item: LearningItem,
): TokenId | undefined {
  if (!isSpeaking(state, item)) return undefined;
  const tokens = item.tokens ?? [];
  // A word card *is* its word, so it lights as a whole and does not need the
  // engine to have said where it is — the same reading `TokenizedText` makes of
  // an item with no tokens to tap.
  if (tokens.length === 0) return WHOLE_ITEM_TOKEN;

  const span = state?.span;
  if (span === undefined) return undefined;

  // Overlap rather than containment: an engine that reports a whole clause, or
  // one whose offsets sit a character out on a leading `¿`, should still light
  // the word it is on rather than nothing at all.
  return deriveTokenSpans(item.text, tokens).find(
    (token) => token.start < span.end && span.start < token.end,
  )?.id;
}
