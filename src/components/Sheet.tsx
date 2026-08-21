import type { ReactNode } from 'react';
import { Button } from './Button';
import { Icon } from './Icon';
import { useFocusTrap } from './useFocusTrap';
import styles from './Sheet.module.css';

interface SheetProps {
  /** The dialog's accessible name, and its visible heading. */
  readonly title: string;
  readonly onClose: () => void;
  /**
   * Lands on the dialog element, for an `aria-expanded` control to point its
   * `aria-controls` at.
   *
   * It exists because the alternative was wrapping the sheet in a `<div id=…>`
   * at the call site — and that wrapper is a *flow* element. Inside a grid it
   * collects a `gap` even with nothing but a fixed child in it, so opening the
   * practice picker pushed the rest of Home down by 12px: the exact failure the
   * component exists to prevent, reintroduced by the markup around it. Pointing
   * at the dialog is also the more accurate relationship to describe.
   */
  readonly id?: string;
  readonly children: ReactNode;
  /**
   * Kept between the header and the scrolling body — for a control that changes
   * *what* the sheet is about, which must not be something you scroll back up
   * to find.
   */
  readonly pinned?: ReactNode;
  /** Extra glyph buttons in the header, before the close button. */
  readonly actions?: ReactNode;
  /**
   * Replaces the plain heading, for a sheet whose subject needs more than a
   * line of text — the word entry shows the Spanish in the display face with its
   * lemma underneath. `title` is still what names the dialog, so the accessible
   * name does not depend on how the heading happens to be marked up.
   */
  readonly heading?: ReactNode;
  /** `wide` for a reference entry, `narrow` for a menu of choices. */
  readonly width?: 'narrow' | 'wide';
  /**
   * Where it sits once there is a pointer and room for one. `header` hangs it
   * from the app header, for a control that lives up there; `center` puts it
   * over the middle of the page, for one that does not.
   *
   * On a phone both are the same thing — a sheet against the bottom edge, in
   * reach of a thumb — which is the whole point of the component.
   */
  readonly anchor?: 'header' | 'center';
}

/**
 * A dialog that arrives over the page instead of growing inside it.
 *
 * This is the design language's third rule made into a component: **overlay,
 * never push**. A disclosure panel in normal flow moves everything below it, so
 * opening a filter shoves the button you were reaching for off the screen — and
 * the page's height becomes a function of which panels happen to be open. A
 * sheet leaves the layout alone.
 *
 * On a phone it is a sheet against the bottom edge, where the thumb is. On a
 * pointer device it becomes a panel — hanging from the header, or centred —
 * because a slab across the bottom of a large monitor is neither.
 *
 * The header and the way out are pinned and only the body scrolls, so a long
 * entry can never push the close button off the screen.
 *
 * It replaces the hand-rolled copies of the same overlay that VoicePresence and
 * WordInfoSheet each carried: the backdrop, the `rise`/`fade` pair, the `82dvh`
 * cap, the `overscroll-behavior: contain` that stops a flick carrying on into
 * the page behind, and the safe-area padding at the bottom. Those were the
 * parts most likely to be left out of the third copy.
 */
export function Sheet({
  title,
  onClose,
  children,
  pinned,
  actions,
  heading,
  id,
  width = 'narrow',
  anchor = 'center',
}: SheetProps) {
  const sheetRef = useFocusTrap<HTMLDivElement>(onClose);
  // Spelled out rather than `styles[anchor]`: this file's stylesheet already has
  // a `.header` of its own, and indexing by the prop name would have collided
  // with it. Named variants keep the two apart at the point it matters.
  const anchored = anchor === 'header' ? styles.anchorHeader : styles.anchorCenter;

  return (
    <div className={`${styles.overlay} ${anchored}`}>
      {/* Not a button: a screen reader user leaves by Escape or by the close
          control, and an extra focusable stop before the dialog's own content
          is noise. The click target is for a pointer. */}
      <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />
      <div
        ref={sheetRef}
        id={id}
        className={`${styles.sheet} ${styles[width]}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <header className={styles.header}>
          {/* Decoration: the dialog is already named, and a handle that
              announced itself would be one more thing to hear first. */}
          <span className={styles.grip} aria-hidden="true" />
          {heading ?? <h2 className={styles.title}>{title}</h2>}
          {actions}
          <Button variant="ghost" icon onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </Button>
        </header>

        {pinned !== undefined && <div className={styles.pinned}>{pinned}</div>}

        <div className={styles.body}>{children}</div>
      </div>
    </div>
  );
}
