import { ContrastControl } from '../../components/ContrastControl';
import { IntensityControl } from '../../components/IntensityControl';
import { Icon } from '../../components/Icon';
import { PaletteControl } from '../../components/PaletteControl';
import { ReadingSizeControl } from '../../components/ReadingSizeControl';
import { ThemeToggle } from '../../components/ThemeToggle';
import styles from './Settings.module.css';

/**
 * Five independent axes, in the order they narrow each other.
 *
 * Light or dark first, because it is the one the operating system has an opinion
 * about. Then the palette, then the two axes that adjust it — how far apart its
 * neutrals sit, and how loud its hues are — then the type scale. They are
 * deliberately not one control: a learner who wants large type in a warm palette
 * at high contrast with quiet colour should not have to find a theme called
 * `sand-large-more-calm`, which is what a combined id would have needed.
 *
 * Contrast and intensity sit next to each other because they are the two halves of
 * the same complaint. "This is too much" can mean the greys are too sharp or the
 * colour-coding is too loud, and one control for both meant every learner got the
 * same compromise. They cannot interfere: a contrast level restates only neutrals
 * and an intensity only hues, which `contrast.test.ts` asserts rather than assumes.
 *
 * Every combination is a real, checked combination — each palette is held to WCAG
 * AA at every contrast level *and* every intensity — so there is no pairing here
 * that produces something illegible.
 */
export function AppearanceSettings() {
  return (
    <>
      <div className={styles.field}>
        <span className={styles.label}>
          <Icon name="theme" size="sm" className={styles.labelIcon} />
          Theme
        </span>
        <ThemeToggle />
        <span className={styles.hint}>
          System follows your device setting and switches with it.
        </span>
      </div>

      <div className={styles.field}>
        <span className={styles.label}>
          <Icon name="tune" size="sm" className={styles.labelIcon} />
          Colours
        </span>
        <PaletteControl />
        <span className={styles.hint}>
          Each palette has a light and a dark version, so this choice survives the theme switching
          around it.
        </span>
      </div>

      <div className={styles.field}>
        <span className={styles.label}>
          <Icon name="contrast" size="sm" className={styles.labelIcon} />
          Contrast
        </span>
        <ContrastControl />
        <span className={styles.hint}>
          How far apart the greys sit. Soft is quieter, not less legible — every step still meets
          the same minimum.
        </span>
      </div>

      <div className={styles.field}>
        <span className={styles.label}>
          <Icon name="tune" size="sm" className={styles.labelIcon} />
          Colour intensity
        </span>
        <IntensityControl />
        <span className={styles.hint}>
          How strong the colours are. Calm keeps the coding and turns the volume down; every step
          still meets the same minimum.
        </span>
      </div>

      <div className={styles.field}>
        <span className={styles.label}>
          <Icon name="word" size="sm" className={styles.labelIcon} />
          Text size
        </span>
        <ReadingSizeControl />
        <span className={styles.hint}>
          Changes text throughout the app. It is separate from your colours and contrast.
        </span>
      </div>
    </>
  );
}
