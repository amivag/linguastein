import { isInspectable, type LearningItem, type TokenId } from '../../domain/content';
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
 */
export function TokenizedText({ item, className, onSelect, selected }: TokenizedTextProps) {
  const tokens = item.tokens ?? [];

  if (tokens.length === 0 || !onSelect) {
    return (
      <p className={className} lang="es">
        {item.text}
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
            <button
              type="button"
              className={`${styles.token} ${selected === token.id ? styles.selected : ''}`}
              onClick={() => onSelect(token.id)}
              aria-label={`About “${token.text}”`}
            >
              {token.text}
            </button>
          </span>
        );
      })}
    </p>
  );
}

const NO_SPACE_BEFORE = new Set(['.', ',', '!', '?', ';', ':', '»', ')']);
const NO_SPACE_AFTER = new Set(['¿', '¡', '«', '(']);

function needsSpace(previous: string | undefined, current: string): boolean {
  if (previous === undefined) return false;
  if (NO_SPACE_BEFORE.has(current)) return false;
  return !NO_SPACE_AFTER.has(previous);
}
