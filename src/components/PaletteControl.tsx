import { useServices } from '../app/services-context';
import { PALETTE_OPTIONS, type PaletteId } from '../styles/themes';
import styles from './PaletteControl.module.css';

/**
 * Which set of hues the chosen light or dark theme is drawn with.
 *
 * The swatches are the real palettes rather than pictures of them: each one is a
 * decorative element carrying `data-palette`, and every palette file declares
 * its roles for a descendant with that attribute as well as for the document.
 * So a swatch is painted by the same stylesheet the page would be painted by —
 * no colour is duplicated into a component, and a palette added later shows up
 * here correctly with nothing to update.
 *
 * The current contrast level rides along on the swatch for the same reason: a
 * preview that ignored it would advertise a page the learner will not get.
 */
export function PaletteControl() {
  const { preferences, updatePreferences } = useServices();
  const current = preferences.palette;
  const active = PALETTE_OPTIONS.find((option) => option.id === current);

  const choose = (palette: PaletteId) => updatePreferences({ palette });

  return (
    <>
      <div className={styles.group} role="radiogroup" aria-label="Colour palette">
        {PALETTE_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={current === option.id}
            className={`${styles.option} ${current === option.id ? styles.active : ''}`}
            onClick={() => choose(option.id)}
          >
            <span
              className={styles.swatch}
              data-palette={option.id}
              data-contrast={preferences.contrast}
              aria-hidden="true"
            >
              <span className={styles.swatchAccent} />
              <span className={styles.swatchHighlight} />
              <span className={styles.swatchText} />
            </span>
            {option.label}
          </button>
        ))}
      </div>
      {/* One description rather than four: the words belong to the choice that is
          active, and four of them under four swatches is a wall of prose on the
          screen a learner spends least time on. */}
      {active && <p className={styles.description}>{active.description}</p>}
    </>
  );
}
