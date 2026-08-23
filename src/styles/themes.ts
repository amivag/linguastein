/**
 * The appearance registry: light or dark, and which palette.
 *
 * Three axes decide how the app looks, and they are deliberately separate
 * rather than combined into one theme id — see `docs/theming.md`. A combined id
 * would need `dark-teal-large-more` and would multiply with every palette added.
 *
 * - `data-theme` — light or dark, this file
 * - `data-palette` — which set of hues, this file
 * - `data-contrast` — how far apart they sit, `contrast.ts`
 * - `data-reading-size` — type scale, `reading-size.ts`
 *
 * Adding a palette is three steps: create `src/styles/themes/<id>-dark.css` and
 * `<id>-light.css` declaring every colour role, import both in `global.css`, and
 * add an entry to `PALETTE_OPTIONS`. The settings picker, the style guide and
 * the contrast test all read from these lists, so nothing else needs touching —
 * and the test refuses a palette whose two files are not both there.
 */

import { storageKey } from '../app/identity';

export const THEME_PREFERENCES = ['system', 'dark', 'light'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

/** A concrete theme, i.e. `system` already resolved against the OS setting. */
export type ThemeId = Exclude<ThemePreference, 'system'>;

export interface ThemeOption {
  readonly id: ThemePreference;
  readonly label: string;
  /**
   * Shown next to the label; decorative, so it stays out of the a11y tree.
   *
   * A name from the icon set rather than a glyph. It is typed as a plain string
   * because this module is imported by the contrast test and by the pre-paint
   * path, and neither should have to pull in React to know a theme exists —
   * `Icon` validates the name at the call site.
   */
  readonly icon: 'themeSystem' | 'themeLight' | 'themeDark';
}

export const THEME_OPTIONS: readonly ThemeOption[] = [
  { id: 'system', label: 'System', icon: 'themeSystem' },
  { id: 'light', label: 'Light', icon: 'themeLight' },
  { id: 'dark', label: 'Dark', icon: 'themeDark' },
];

/**
 * The palettes on offer, in the order the picker shows them.
 *
 * `indigo` is first and is what an unset `data-palette` resolves to, which is
 * why its two files carry the bare `[data-theme='…']` selector as well.
 */
export const PALETTES = ['indigo', 'teal', 'plum', 'sand'] as const;
export type PaletteId = (typeof PALETTES)[number];

export const DEFAULT_PALETTE: PaletteId = 'indigo';

export interface PaletteOption {
  readonly id: PaletteId;
  readonly label: string;
  /** One line on what changes, for the hint under the picker. */
  readonly description: string;
}

export const PALETTE_OPTIONS: readonly PaletteOption[] = [
  { id: 'indigo', label: 'Indigo', description: 'Cool indigo with a warm amber second voice.' },
  { id: 'teal', label: 'Teal', description: 'Green-cast greys and a deep teal accent.' },
  { id: 'plum', label: 'Plum', description: 'Violet greys and a fuchsia accent.' },
  { id: 'sand', label: 'Sand', description: 'Warm paper and bronze, with a cool highlight.' },
];

/** Where each resolved axis is cached for the pre-paint script. */
export const THEME_STORAGE_KEY = storageKey('theme');
export const PALETTE_STORAGE_KEY = storageKey('palette');

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === 'string' && (THEME_PREFERENCES as readonly string[]).includes(value);
}

export function isPaletteId(value: unknown): value is PaletteId {
  return typeof value === 'string' && (PALETTES as readonly string[]).includes(value);
}

export function resolveTheme(preference: ThemePreference, prefersDark: boolean): ThemeId {
  if (preference === 'system') return prefersDark ? 'dark' : 'light';
  return preference;
}

/**
 * Applies a theme to the document and mirrors the choice to localStorage so the
 * pre-paint script can restore it on the next load without a flash of the wrong
 * theme. IndexedDB stays the source of truth for preferences; this is a cache.
 */
export function applyTheme(preference: ThemePreference, prefersDark: boolean): ThemeId {
  const resolved = resolveTheme(preference, prefersDark);
  document.documentElement.dataset['theme'] = resolved;
  cache(THEME_STORAGE_KEY, preference);
  return resolved;
}

/**
 * Applies a palette. Always written out, including the default, so a decorative
 * element can override it locally to preview another one — the picker's swatches
 * are real palettes rather than hard-coded colours.
 */
export function applyPalette(palette: PaletteId): void {
  document.documentElement.dataset['palette'] = palette;
  cache(PALETTE_STORAGE_KEY, palette);
}

function cache(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private browsing can refuse storage; the choice still applies this session.
  }
}
