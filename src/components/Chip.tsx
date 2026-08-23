import type { ButtonHTMLAttributes } from 'react';
import { kindHue } from '../styles/kinds';
import { Icon, type IconName } from './Icon';
import styles from './Chip.module.css';

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Written out as `aria-pressed` rather than kept as a class.
   *
   * Deliberate, and load-bearing: `[aria-pressed='true']:hover` outranks
   * `.chip:hover` outright, so the selected chip cannot fall back to the
   * unselected hover and end up wearing one state's text colour on another
   * state's background. A `.selected` class would tie on specificity and
   * reintroduce exactly that bug — the one `hover-states.test.ts` exists for.
   */
  readonly pressed?: boolean;
  /**
   * A quieter number after the label. It is what makes a chip a decision rather
   * than a label: "Food 42" is worth a tap and "Food 0" is a dead end, and a
   * learner should not have to press it to find out.
   */
  readonly count?: number;
  readonly icon?: IconName;
  /** `soft` is the warm variant, for a chip that offers rather than filters. */
  readonly tone?: 'neutral' | 'accent';
  /**
   * A stable id, if this chip should wear its category's colour as a dot.
   *
   * Opt-in rather than automatic, because a chip is also a level, a part of
   * speech and a session option — and a hue there would be colour that means
   * nothing, which is the failure mode the four semantic roles exist to avoid.
   * Only a list a learner is meant to *recognise* entries in asks for it.
   */
  readonly hue?: string;
}

/**
 * A pill you press to narrow something: a level, a category, a part of speech.
 *
 * One component because there were two — the level chip in `CourseBar` and the
 * topic tile in `CategoryPicker` — differing only in which of them remembered
 * the selected-hover rule. The count, the tap target and the ARIA state are the
 * parts that were easy to get subtly wrong twice.
 *
 * Filled when selected rather than outlined when not: a row of twelve outlined
 * pills is twelve boundaries competing for attention, and the one that matters
 * is which of them is *on*.
 */
export function Chip({
  pressed,
  count,
  icon,
  tone = 'neutral',
  hue,
  className,
  children,
  type = 'button',
  ...rest
}: ChipProps) {
  const classes = [styles.chip, tone === 'accent' ? styles.accent : '', className ?? '']
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type} className={classes} aria-pressed={pressed} {...rest}>
      {icon && <Icon name={icon} size="sm" />}
      {/* Decoration, and never the only signal: the label names the category,
          the count sizes it and `aria-pressed` carries the state. It stays in the
          layout when selected rather than being removed — a dot that disappears
          on press would reflow a wrapped row of thirty-five chips. */}
      {hue !== undefined && (
        <span className={styles.dot} data-kind={kindHue(hue)} aria-hidden="true" />
      )}
      <span className={styles.label}>{children}</span>
      {count !== undefined && (
        <span className={styles.count} aria-hidden="true">
          {count}
        </span>
      )}
    </button>
  );
}
