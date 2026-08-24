import { useServices } from '../app/services-context';
import { INTENSITY_OPTIONS, type Intensity } from '../styles/intensity';
import { KIND_HUE_COUNT } from '../styles/kinds';
import styles from './IntensityControl.module.css';

/**
 * How loud the palette's hues are — three steps, calm to vivid.
 *
 * The sibling of {@link ContrastControl}, and deliberately built the same way:
 * three buttons in a shared track, because it is one axis with three named stops
 * rather than three actions. The two controls sit next to each other in Settings
 * and answer the two halves of "this is too much" — the neutrals being too sharp,
 * and the colours being too loud — which used to be one compromise nobody could
 * adjust.
 *
 * Each step previews itself, and the preview is the *categorical wheel* rather
 * than the accent: what this axis actually changes for a learner is how a page of
 * thirty-six coloured categories reads, and a single accent swatch would show
 * almost no difference between calm and vivid. The dots carry `data-intensity` and
 * `data-palette`, so they are painted by the same stylesheets the page uses —
 * nothing here is a hard-coded colour, which is what stops a swatch advertising a
 * palette that does not exist.
 */
export function IntensityControl() {
  const { preferences, updatePreferences } = useServices();
  const current = preferences.intensity;

  const choose = (intensity: Intensity) => updatePreferences({ intensity });

  // Six of the twelve, evenly spaced round the wheel: enough to read the change,
  // few enough to stay legible at this size. Derived from the count so a wider
  // wheel does not leave this showing half of it.
  const sampled = Array.from({ length: 6 }, (_, index) => 1 + index * (KIND_HUE_COUNT / 6));

  return (
    <div className={styles.group} role="radiogroup" aria-label="Colour intensity">
      {INTENSITY_OPTIONS.map((option) => (
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
            data-intensity={option.id}
            aria-hidden="true"
          >
            {sampled.map((hue) => (
              <span key={hue} className={styles.dot} data-kind={hue} />
            ))}
          </span>
          <span aria-hidden="true">{option.shortLabel}</span>
        </button>
      ))}
    </div>
  );
}
