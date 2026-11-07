import { Chip } from '../../components/Chip';
import { OTHER_INITIAL, type InitialFacet } from '../../domain/content';
import styles from './LetterIndex.module.css';

interface LetterIndexProps {
  readonly letters: readonly InitialFacet[];
  /** The selected letter; empty means no narrowing. */
  readonly selected: string;
  /**
   * A letter was pressed. Pressing the selected one again clears it, exactly as
   * a category tile does. The explicit "Any" control also clears it, so the
   * current scope is visible without relying on that shortcut.
   */
  readonly onToggle: (letter: string) => void;
}

/**
 * A compact alphabet grid: the way into the middle of a long list without
 * knowing what is in it.
 *
 * Only the letters the pack has something for, which is what keeps this a row of
 * decisions rather than twenty-six taps of which a third are dead ends. The
 * counts are in the accessible names but not on the chips: a number beside each
 * of twenty-something single letters is a paragraph of digits, and with the empty
 * letters already dropped there is nothing left for it to warn about.
 *
 * The grid deliberately includes "Any". Together with the populated Spanish
 * initials that makes balanced rows at the common breakpoints, gives the
 * selection a visible reset, and avoids hiding letters behind a horizontal
 * scrollbar.
 */
export function LetterIndex({ letters, selected, onToggle }: LetterIndexProps) {
  // One letter is not a choice, and no letters means an empty course.
  if (letters.length < 2) return null;

  return (
    <section className={styles.index} aria-label="Letters">
      <h2 className={styles.heading}>Starts with</h2>
      <ul className={styles.row}>
        <li>
          <Chip
            className={styles.letter}
            aria-label="Any starting letter"
            pressed={selected === ''}
            onClick={() => onToggle('')}
          >
            Any
          </Chip>
        </li>
        {letters.map(({ letter, count }) => (
          <li key={letter}>
            <Chip
              className={styles.letter}
              // Spelled out rather than left to the glyph: a control named "C"
              // says nothing about what pressing it does, to a screen reader or
              // to an agent, and the size of the letter is the thing worth
              // knowing before the tap.
              aria-label={`${describe(letter)}, ${count} ${count === 1 ? 'item' : 'items'}`}
              pressed={letter === selected}
              onClick={() => onToggle(letter)}
            >
              {letter}
            </Chip>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** `#` is a bucket rather than a letter, so it is named instead of read out. */
function describe(letter: string): string {
  return letter === OTHER_INITIAL ? 'Other' : `Starting with ${letter}`;
}
