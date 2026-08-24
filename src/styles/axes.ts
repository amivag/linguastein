/**
 * Every appearance axis, in one list.
 *
 * The five axes are declared in the modules that own their meaning — theme and
 * palette in `themes.ts`, and one file each for contrast, intensity and reading
 * size — because each of those files is also where the *reasoning* for its values
 * lives, and a registry is a bad place to keep an argument. This is only the
 * enumeration.
 *
 * It exists for one job that nothing else can do: **the pre-paint script**.
 * `index.html` cannot import TypeScript, so its inline script used to repeat every
 * axis's values as literal arrays, guarded by a test comparing the two lists. That
 * guard worked, and a guard is the wrong tool for a duplication you can simply
 * delete: `vite.config.ts` reads {@link prePaintAxes} and substitutes it into the
 * HTML at build *and* dev time, exactly as it already substitutes the app id. Add
 * an axis and the script picks it up with no edit to `index.html` and no test to
 * remember.
 *
 * Two constraints on anything added here, both structural rather than stylistic:
 *
 * - **No DOM at module scope, anywhere in the import graph.** A Vite config file
 *   imports this, and a config file runs in Node. Every axis's `apply` touches
 *   `document` *inside* a function, which is fine; a module-level
 *   `document.documentElement` anywhere below would break the build rather than
 *   the app, which is a confusing way to find out.
 * - **Serialisable.** What crosses into the HTML is JSON, so an axis contributes
 *   data and never a function. The one behaviour the script needs — resolving a
 *   value from an OS preference — travels as the `system` flag.
 */

import { CONTRAST_AXIS } from './contrast';
import { INTENSITY_AXIS } from './intensity';
import { READING_SIZE_AXIS } from './reading-size';
import { PALETTE_AXIS, THEME_AXIS } from './themes';
import type { AxisMetadata } from './appearance';

/**
 * Order matters only for legibility of the generated script; the axes are
 * independent by construction, which is the whole point of them being axes.
 */
export const APPEARANCE_AXES: readonly AxisMetadata[] = [
  THEME_AXIS,
  PALETTE_AXIS,
  CONTRAST_AXIS,
  INTENSITY_AXIS,
  READING_SIZE_AXIS,
];

export interface PrePaintAxis {
  /** The un-namespaced key; the script prefixes it with the app id itself. */
  readonly key: string;
  /** The `dataset` spelling, e.g. `readingSize` for `data-reading-size`. */
  readonly dataset: string;
  readonly values: readonly string[];
  readonly fallback: string;
  /** Whether an OS media query decides this axis. Only `theme` sets it. */
  readonly system: boolean;
}

/**
 * The axes as plain data, for the pre-paint script.
 *
 * A function rather than a constant so the build gets a fresh array it can
 * `JSON.stringify` without reaching into class-like objects, and so this module
 * has one obvious entry point for the config to call.
 */
export function prePaintAxes(): readonly PrePaintAxis[] {
  return APPEARANCE_AXES.map((axis) => ({
    key: axis.key,
    dataset: axis.datasetKey,
    values: [...axis.values],
    fallback: axis.fallback,
    system: axis.resolvesFromSystem ?? false,
  }));
}
