import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

export type ButtonVariant = 'default' | 'primary' | 'option' | 'ghost' | 'correct' | 'incorrect';

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
    align === 'start' ? styles.alignStart : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return <button type={type} className={classes} {...rest} />;
}
