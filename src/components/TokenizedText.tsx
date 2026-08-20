import {
  isInspectable,
  isInspectableItem,
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
  readonly selected?: TokenId | null | undefined;
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
 */
export function TokenizedText({ item, className, onSelect, selected }: TokenizedTextProps) {
  const tokens = item.tokens ?? [];
  const wholeItem = tokens.length === 0 && isInspectableItem(item);

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
          selected={selected}
        />
      </p>
    );
  }

  return (
    <p className={className} lang="es">
      {tokens.map((token, index) => {
        const spaced = index > 0 && needsSpace(tokens[index - 1]?.text, token.text);
        if (!isInspectable(token)) {
          return (
            <span key={token.id}>
              {spaced ? ' ' : ''}
              {token.text}
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
              selected={selected}
            />
          </span>
        );
      })}
    </p>
  );
}

interface WordButtonProps {
  readonly text: string;
  readonly tokenId: TokenId;
  readonly onSelect: (tokenId: TokenId) => void;
  readonly selected?: TokenId | null | undefined;
}

/**
 * One word you can open. Its accessible name is the contract screen readers and
 * agents pick a word by, so both shapes of text name a word the same way.
 */
function WordButton({ text, tokenId, onSelect, selected }: WordButtonProps) {
  const open = selected === tokenId;

  return (
    <button
      type="button"
      className={`${styles.token} ${open ? styles.selected : ''}`}
      onClick={() => onSelect(tokenId)}
      aria-label={`About “${text}”`}
      aria-expanded={open}
      aria-haspopup="dialog"
    >
      {text}
    </button>
  );
}

const NO_SPACE_BEFORE = new Set(['.', ',', '!', '?', ';', ':', '»', ')']);
const NO_SPACE_AFTER = new Set(['¿', '¡', '«', '(']);

function needsSpace(previous: string | undefined, current: string): boolean {
  if (previous === undefined) return false;
  if (NO_SPACE_BEFORE.has(current)) return false;
  return !NO_SPACE_AFTER.has(previous);
}
