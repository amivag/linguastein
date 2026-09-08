import { Link } from 'react-router';
import styles from './Breadcrumb.module.css';

export interface Crumb {
  readonly label: string;
  /** Where the crumb goes. A place in this app is an address, so it is a link. */
  readonly to: string;
}

/**
 * The chain of places above the screen you are on.
 *
 * The header used to say only what a screen was *called*, which on the screens
 * that hide the tab bar left nothing at all saying what kind of thing it was: a
 * mission opened on “Order at a café” drawn large, with no word anywhere on it
 * that said *mission*, and — since `AppNav` is hidden there — no visible route
 * back to the list it came from. The single Back button walked history, which is
 * however many taps the learner happened to make.
 *
 * So the trail carries both facts at once, and that is why it is one control
 * rather than a kind label plus a set of links: the last crumb *is* the answer to
 * "what am I inside", and it is also the way out of it.
 *
 * **The current screen is not repeated as a crumb**, though the WAI-ARIA pattern
 * allows it. The `<h1>` directly below is the current page and carries its
 * accessible name already; a final `aria-current` crumb would announce the same
 * words twice in a row to the two audiences — screen readers and agents — that
 * this app treats as one. Every crumb here is therefore somewhere you can go.
 */
export function Breadcrumb({ items }: { readonly items: readonly Crumb[] }) {
  if (items.length === 0) return null;

  return (
    <nav className={styles.trail} aria-label="Breadcrumb">
      <ol className={styles.list}>
        {items.map((crumb, index) => (
          <li key={crumb.to} className={styles.crumb}>
            {/* In the markup rather than in `content`, so what separates two
                crumbs is a decoration a screen reader is told to skip rather
                than a character it may or may not read out. */}
            {index > 0 && (
              <span aria-hidden="true" className={styles.separator}>
                ›
              </span>
            )}
            <Link to={crumb.to} className={styles.link}>
              {crumb.label}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
