import { ContrastControl } from '../../components/ContrastControl';
import { Icon } from '../../components/Icon';
import { PaletteControl } from '../../components/PaletteControl';
import { ReadingSizeControl } from '../../components/ReadingSizeControl';
import { ThemeToggle } from '../../components/ThemeToggle';
import styles from './Settings.module.css';

/**
 * Four independent axes, in the order they narrow each other.
 *
 * Light or dark first, because it is the one the operating system has an opinion
 * about. Then the palette, then how far apart that palette's neutrals sit, then
 * the type scale. They are deliberately not one control: a learner who wants
 * large type in a warm palette at high contrast should not have to find a theme
 * called `sand-large-more`, which is what a combined id would have needed.
 *
 * Every combination is a real, checked combination — `contrast.test.ts` holds
 * each palette to WCAG AA at each contrast level — so there is no pairing here
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
