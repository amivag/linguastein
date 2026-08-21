import { ICONS, type IconName, type IconSize } from './icons';
import styles from './Icon.module.css';

/* Re-exported so a call site needs one import to name an icon and render it.
   Types only — a value export here would break fast refresh for this file. */
export type { IconName, IconSize } from './icons';

interface IconProps {
  readonly name: IconName;
  readonly size?: IconSize;
  /**
   * An accessible name, for the rare icon that is not accompanied by one.
   *
   * Left off, the glyph is `aria-hidden` — which is right almost always, because
   * an icon in this app sits inside a control that already has a name, and a
   * second name on the glyph would make a screen reader read the button twice.
   * Set it only when the icon genuinely is the whole of the information, and
   * never to re-state a visible label beside it.
   */
  readonly label?: string;
  /**
   * Spelled `string | undefined` rather than left optional: under
   * `exactOptionalPropertyTypes` a CSS-module class resolves to
   * `string | undefined`, so `className={styles.thing}` would not type-check
   * against a plain `className?: string`.
   */
  readonly className?: string | undefined;
}

/**
 * A single glyph, sized and stroked from the primitives.
 *
 * Size and stroke are applied in CSS rather than through Lucide's `size` prop,
 * so both come from `--icon-*` tokens and cannot be typed as a number at a call
 * site. The colour is always inherited: an icon belongs to the text or the
 * control it sits in, so no icon needs a theme rule of its own.
 *
 * The set itself lives in `icons.ts`. Keeping the map out of this file is what
 * lets the style guide enumerate every name without importing a component, and
 * keeps the vendor import in exactly one place.
 */
export function Icon({ name, size = 'md', label, className }: IconProps) {
  // Indexed straight off the frozen map rather than through a helper: the React
  // Compiler has to see that the component is a stable module constant, and a
  // function returning one looks to it like a component built during render.
  const Glyph = ICONS[name];
  const classes = [styles.icon, styles[size], className ?? ''].filter(Boolean).join(' ');

  return (
    <Glyph
      className={classes}
      // Never focusable, in either tree: IE-era SVG focus behaviour still
      // surfaces in some assistive tech, and an icon is never a stop.
      focusable="false"
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    />
  );
}
