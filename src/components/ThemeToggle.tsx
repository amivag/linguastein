import { useServices } from '../app/services-context';
import { THEME_OPTIONS, type ThemePreference } from '../styles/themes';
import styles from './ThemeToggle.module.css';

interface ThemeToggleProps {
  /** `compact` is the header button; `full` is the settings control. */
  readonly variant?: 'compact' | 'full';
}

/**
 * System / light / dark. A radio group rather than a select, so the current
 * choice is visible at a glance and reachable with one tap or one arrow key.
 */
export function ThemeToggle({ variant = 'full' }: ThemeToggleProps) {
  const { preferences, updatePreferences } = useServices();
  const current = preferences.theme;

  const choose = (theme: ThemePreference) => updatePreferences({ theme });

  if (variant === 'compact') {
    // Cycles through the options; the label always states what is active.
    const index = THEME_OPTIONS.findIndex((option) => option.id === current);
    const next = THEME_OPTIONS[(index + 1) % THEME_OPTIONS.length]!;
    const active = THEME_OPTIONS[index] ?? THEME_OPTIONS[0]!;

    return (
      <button
        type="button"
        className={styles.compact}
        onClick={() => choose(next.id)}
        aria-label={`Theme: ${active.label}. Switch to ${next.label}`}
      >
        <span aria-hidden="true">{active.icon}</span>
      </button>
    );
  }

  return (
    <div className={styles.group} role="radiogroup" aria-label="Theme">
      {THEME_OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={current === option.id}
          className={`${styles.option} ${current === option.id ? styles.active : ''}`}
          onClick={() => choose(option.id)}
        >
          <span aria-hidden="true">{option.icon}</span> {option.label}
        </button>
      ))}
    </div>
  );
}
