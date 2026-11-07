import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

/**
 * `tonal` is the accent at panel strength — an action in the app's voice that is
 * not claiming to be *the* action. It exists because the alternative, on a
 * screen with two things worth pressing, was two primary buttons.
 */
export type ButtonVariant =
  'default' | 'primary' | 'tonal' | 'danger' | 'option' | 'ghost' | 'correct' | 'incorrect';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly block?: boolean;
  readonly large?: boolean;
  /**
   * A square control carrying a glyph instead of a label — the header actions
   * on a dialog. Like `align`, it overrides the button's own padding, so it
   * lives here rather than winning a specificity race from another file.
   */
  readonly icon?: boolean;
  /**
   * A visible 1px boundary.
   *
   * Off by default: the resting outline around every control is what made the
   * app read as a form, and depth carries the boundary in almost every case.
   * Ask for it where WCAG 1.4.11 needs 3:1 and depth cannot supply it — a
   * control sitting on a surface it barely differs from.
   */
  readonly outline?: boolean;
  /**
   * `start` ranges the label left for a row of answers to pick from. It lives
   * here rather than in a screen's stylesheet because it overrides the button's
   * own layout, and a rule in another file would only win by import order.
   */
  readonly align?: 'center' | 'start';
}

/** Large, thumb-friendly by default: the app is used one-handed (spec §2.1). */
export function Button({
  variant = 'default',
  block = false,
  large = false,
  icon = false,
  outline = false,
  align = 'center',
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = [
    styles.button,
    variant !== 'default' ? styles[variant] : '',
    block ? styles.block : '',
    large ? styles.large : '',
    icon ? styles.icon : '',
    outline ? styles.outline : '',
    align === 'start' ? styles.alignStart : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return <button type={type} className={classes} {...rest} />;
}
