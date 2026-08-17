import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

export type ButtonVariant = 'default' | 'primary' | 'ghost' | 'correct' | 'incorrect';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly block?: boolean;
  readonly large?: boolean;
}

/** Large, thumb-friendly by default: the app is used one-handed (spec §2.1). */
export function Button({
  variant = 'default',
  block = false,
  large = false,
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = [
    styles.button,
    variant !== 'default' ? styles[variant] : '',
    block ? styles.block : '',
    large ? styles.large : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return <button type={type} className={classes} {...rest} />;
}
