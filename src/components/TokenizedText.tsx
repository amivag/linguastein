import {
  isInspectable,
  isInspectableItem,
  needsSpaceBefore,
  WHOLE_ITEM_TOKEN,
  type LearningItem,
  type TokenId,
} from '../domain/content';
import styles from './TokenizedText.module.css';

interface TokenizedTextProps {
  readonly item: LearningItem;
  readonly className?: string | undefined;
  /** Omitted (or undefined) makes the text inert — words are then not tappable. */
  readonly onSelect?: ((tokenId: TokenId) => void) | undefined;
  /** Tokens currently open in the sheet; several when a phrase is selected. */
  readonly selected?: readonly TokenId[] | undefined;
  /**
   * The token a cloze exercise has blanked out. Rendered as the blank and left
   * inert, so the rest of the sentence can be inspected without the card handing
   * over the answer it is about to grade.
   */
  readonly blankTokenId?: TokenId | undefined;
  /**
   * The phrase to name in each word's accessible name, for a screen that shows
   * several at once.
   *
   * A list of sentences all containing `Tengo` otherwise offers a row of
   * controls called "About “Tengo”" that neither a screen reader nor an agent
   * can tell apart — the same problem the per-line play buttons in a passage
   * solved by naming their line. A practice card shows one phrase and passes
   * nothing, keeping its names short.
   */
  readonly contextLabel?: string | undefined;
}

/**
 * Renders target-language text as tappable words when the dataset annotates
 * tokens. Punctuation stays inert; spacing before it is suppressed so
 * `¿Dónde está el baño?` still reads correctly (spec §15 — order is data,
 * spacing is presentation).
 *
 * A word card is the other shape this has to render: it carries a lexeme and no
 * tokens, because the card *is* the word. It used to fall through to inert
 * text, which left the gloss, gender and example sentences the dataset holds
 * for it with nowhere to be opened from — so the whole text becomes the one
 * word to tap.
 *
 * Selection is a list rather than a single id: `tener que` means something its
 * two words do not, and the dataset annotates exactly that. A selected run is
 * marked as one continuous highlight, with the outer edges rounded, so it reads
 * as one thing rather than as two words that happen to be lit.
 */
export function TokenizedText({
  item,
  className,
  onSelect,
  selected,
  blankTokenId,
  contextLabel,
}: TokenizedTextProps) {
  const tokens = item.tokens ?? [];
  const wholeItem = tokens.length === 0 && isInspectableItem(item);
  const open = selected ?? [];

  if (!onSelect || (tokens.length === 0 && !wholeItem)) {
    return (
      <p className={className} lang="es">
        {item.text}
      </p>
    );
  }

  if (wholeItem) {
    return (
      <p className={className} lang="es">
        <WordButton
          text={item.text}
          tokenId={WHOLE_ITEM_TOKEN}
          onSelect={onSelect}
          selected={open.includes(WHOLE_ITEM_TOKEN)}
        />
      </p>
    );
  }

  return (
    <p className={className} lang="es">
      {tokens.map((token, index) => {
        const spaced = needsSpaceBefore(tokens[index - 1]?.text, token.text);
        const blanked = token.id === blankTokenId;

        if (blanked || !isInspectable(token)) {
          return (
            <span key={token.id}>
              {spaced ? ' ' : ''}
              {blanked ? '___' : token.text}
            </span>
          );
        }
        return (
          <span key={token.id}>
            {spaced ? ' ' : ''}
            <WordButton
              text={token.text}
              tokenId={token.id}
              onSelect={onSelect}
              selected={open.includes(token.id)}
              context={contextLabel}
              // Only the ends of a run are rounded, so a two-word selection
              // does not look like two separate one-word selections.
              edge={edgeOf(open, tokens, index)}
            />
          </span>
        );
      })}
    </p>
  );
}

type Edge = 'single' | 'start' | 'middle' | 'end';

/** Where this token sits within a selected run, for the highlight's shape. */
function edgeOf(
  open: readonly TokenId[],
  tokens: readonly { readonly id: TokenId }[],
  index: number,
): Edge {
  const isOpen = (position: number) => {
    const id = tokens[position]?.id;
    return id !== undefined && open.includes(id);
  };
  if (!isOpen(index)) return 'single';
  const before = isOpen(index - 1);
  const after = isOpen(index + 1);
  if (before && after) return 'middle';
  if (before) return 'end';
  if (after) return 'start';
  return 'single';
}

interface WordButtonProps {
  readonly text: string;
  readonly tokenId: TokenId;
  readonly onSelect: (tokenId: TokenId) => void;
  readonly selected: boolean;
  readonly edge?: Edge;
  readonly context?: string | undefined;
}

/**
 * One word you can open. Its accessible name is the contract screen readers and
 * agents pick a word by, so both shapes of text name a word the same way.
 */
function WordButton({
  text,
  tokenId,
  onSelect,
  selected,
  edge = 'single',
  context,
}: WordButtonProps) {
  return (
    <button
      type="button"
      className={`${styles.token} ${selected ? styles.selected : ''}`}
      data-edge={selected ? edge : undefined}
      onClick={() => onSelect(tokenId)}
      aria-label={context ? `About “${text}” in “${context}”` : `About “${text}”`}
      aria-expanded={selected}
      aria-haspopup="dialog"
    >
      {text}
    </button>
  );
}
