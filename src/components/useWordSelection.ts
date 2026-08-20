import { useCallback, useMemo, useState } from 'react';
import type { ItemId, TokenId } from '../domain/content';

const NONE: readonly TokenId[] = [];

export interface WordSelection {
  /** The item whose words are open, or `null` when the sheet is shut. */
  readonly item: ItemId | null;
  /** The open run of tokens: one word, or several for a phrase. */
  readonly tokens: readonly TokenId[];
  /** What to hand `TokenizedText` for a given item, which is nothing for the rest. */
  tokensFor(itemId: ItemId): readonly TokenId[];
  /** Open one word, replacing whatever was open before. */
  open(itemId: ItemId, tokenId: TokenId): void;
  /** Grow or shrink the open run, staying on the same item. */
  set(tokenIds: readonly TokenId[]): void;
  close(): void;
}

/**
 * Which word — or run of words — is currently open, across a screen that may
 * show many phrases at once.
 *
 * Every screen that renders target-language text needs exactly this state, and
 * it was previously re-invented per screen: a `TokenId | null` in a practice
 * card, an `{item, token}` pair in a passage, and nothing at all in Browse,
 * which is why words were not tappable there. One hook means adding inspection
 * to a screen is two lines rather than a small design exercise, and that the
 * selection can be a *span* everywhere at once.
 *
 * The item is part of the state on purpose: a list shows several phrases, and
 * token ids are item-scoped (`t1` in every one of them), so a selection without
 * its item would light up the first word of every row.
 */
export function useWordSelection(): WordSelection {
  const [state, setState] = useState<{ item: ItemId; tokens: readonly TokenId[] } | null>(null);

  const tokensFor = useCallback(
    (itemId: ItemId) => (state?.item === itemId ? state.tokens : NONE),
    [state],
  );

  const open = useCallback((itemId: ItemId, tokenId: TokenId) => {
    setState({ item: itemId, tokens: [tokenId] });
  }, []);

  const set = useCallback((tokens: readonly TokenId[]) => {
    setState((current) => {
      if (!current) return current;
      // An empty run would leave the sheet open with nothing to describe.
      return tokens.length === 0 ? null : { item: current.item, tokens };
    });
  }, []);

  const close = useCallback(() => setState(null), []);

  return useMemo(
    () => ({
      item: state?.item ?? null,
      tokens: state?.tokens ?? NONE,
      tokensFor,
      open,
      set,
      close,
    }),
    [state, tokensFor, open, set, close],
  );
}
