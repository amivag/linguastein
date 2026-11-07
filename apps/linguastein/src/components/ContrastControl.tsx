import { useServices } from '../app/services-context';
import { CONTRAST_OPTIONS, type ContrastLevel } from '../styles/contrast';
import styles from './ContrastControl.module.css';

/**
 * How far apart the palette's neutrals sit — four steps, quiet to maximum.
 *
 * Four buttons rather than a range input, for the same reason text size is: a
 * slider hides which stop it is on until you read a number off it, and every
 * stop here has a name. It is still one axis, so the steps are laid out in
 * order and share a track.
 *
 * Each step previews itself. The sample carries `data-contrast` for that level
 * and `data-palette` for the palette in use, so the two words in it are painted
 * by the same stylesheets the page uses — and Soft cannot advertise a legibility
 * it does not deliver, because the same files are what the contrast test checks.
 */
export function ContrastControl() {
  const { preferences, updatePreferences } = useServices();
  const current = preferences.contrast;

  const choose = (contrast: ContrastLevel) => updatePreferences({ contrast });

  return (
    <div className={styles.group} role="radiogroup" aria-label="Contrast">
      {CONTRAST_OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={current === option.id}
          aria-label={option.label}
          className={`${styles.option} ${current === option.id ? styles.active : ''}`}
          onClick={() => choose(option.id)}
        >
          <span
            className={styles.sample}
            data-palette={preferences.palette}
            data-contrast={option.id}
            aria-hidden="true"
          >
            <span className={styles.sampleText}>Aa</span>
            <span className={styles.sampleMuted}>Aa</span>
          </span>
          <span aria-hidden="true">{option.shortLabel}</span>
        </button>
      ))}
    </div>
  );
}
