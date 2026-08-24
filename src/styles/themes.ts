/**
 * The appearance registry: light or dark, and which palette.
 *
 * Five axes decide how the app looks, and they are deliberately separate rather
 * than combined into one theme id — see `docs/theming.md`. A combined id would
 * need `dark-teal-large-more-vivid` and would multiply with every palette added.
 *
 * - `data-theme` — light or dark, this file
 * - `data-palette` — which set of hues, this file
 * - `data-contrast` — how far apart the neutrals sit, `contrast.ts`
 * - `data-intensity` — how loud the hues are, `intensity.ts`
 * - `data-reading-size` — type scale, `reading-size.ts`
 *
 * All five are declared through one mechanism (`appearance.ts`) and listed in one
 * registry (`axes.ts`), which is what the build injects into the pre-paint script.
 *
 * Adding a palette is three steps: generate `src/styles/themes/<id>-dark.css` and
 * `<id>-light.css` with `npm run build:palette`, import both in `global.css`, and
 * add an entry to `PALETTES` and `PALETTE_OPTIONS`. The settings picker, the style
 * guide, the pre-paint script and the contrast test all read from these lists, so
 * nothing else needs touching — and the test refuses a palette whose two files are
 * not both there, or which ships without its intensity blocks.
 */

import { defineAxis } from './appearance';

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
export const PALETTES = ['indigo', 'teal', 'plum', 'sand', 'slate', 'rose', 'olive'] as const;
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
  {
    id: 'slate',
    label: 'Slate',
    description: 'Neutral greys, a clear blue accent and a magenta second voice.',
  },
  {
    id: 'rose',
    label: 'Rose',
    description: 'Warm pink-shaded neutrals, a deep rose accent and a teal highlight.',
  },
  {
    id: 'olive',
    label: 'Olive',
    description: 'Green-shaded neutrals, a deep olive accent and a violet highlight.',
  },
];

/**
 * The two axes this file owns.
 *
 * `theme` is the one axis whose stored value is not the value written to the
 * document: `system` is a *preference*, and what the root carries is always a
 * resolved `light` or `dark`. So it keeps its own `applyTheme` below and takes
 * only the key, the validator and the value list from the shared mechanism —
 * `resolvesFromSystem` is what tells the pre-paint script to ask the media query
 * rather than hard-coding the word "theme".
 */
export const THEME_AXIS = defineAxis({
  key: 'theme',
  values: THEME_PREFERENCES,
  fallback: 'system' as ThemePreference,
  resolvesFromSystem: true,
});

export const PALETTE_AXIS = defineAxis({
  key: 'palette',
  values: PALETTES,
  fallback: DEFAULT_PALETTE,
});

/** Where each resolved axis is cached for the pre-paint script. */
export const THEME_STORAGE_KEY = THEME_AXIS.storageKey;
export const PALETTE_STORAGE_KEY = PALETTE_AXIS.storageKey;

export const isThemePreference = THEME_AXIS.is;
export const isPaletteId = PALETTE_AXIS.is;

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
  // Written through the axis, so the one spelling of `data-theme` is the one the
  // registry hands the pre-paint script. `THEME_AXIS.apply` cannot be used
  // directly: it would store the resolved value where the *preference* belongs,
  // and `system` would stop following the OS after the first load.
  writeRoot(THEME_AXIS.datasetKey, resolved);
  cache(THEME_STORAGE_KEY, preference);
  return resolved;
}

/**
 * Applies a palette. Always written out, including the default, so a decorative
 * element can override it locally to preview another one — the picker's swatches
 * are real palettes rather than hard-coded colours.
 */
export const applyPalette = PALETTE_AXIS.apply;

/*
 * Only `applyTheme` still needs these two: every other axis writes and caches
 * through `AppearanceAxis.apply`, and theme is the exception because the value it
 * puts on the document and the value it stores are deliberately different.
 *
 * Both reach the browser through `globalThis` for the reason `appearance.ts`
 * records — this module is in the import graph the Vite config reads, and that
 * project compiles without the DOM lib on purpose.
 */
interface ThemeHost {
  readonly document?: { readonly documentElement: { readonly dataset: Record<string, string> } };
  readonly localStorage?: { setItem: (key: string, value: string) => void };
}

function writeRoot(datasetKey: string, value: string): void {
  const { document } = globalThis as ThemeHost;
  if (!document) return;
  document.documentElement.dataset[datasetKey] = value;
}

function cache(key: string, value: string): void {
  try {
    (globalThis as ThemeHost).localStorage?.setItem(key, value);
  } catch {
    // Private browsing can refuse storage; the choice still applies this session.
  }
}
