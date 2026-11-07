/** Compatibility exports bound to this app's palette catalog. */
import { APP_THEMES } from '../app/themes';
import { createThemeMode } from '@platform/appearance';
import { appearance, defineAxis } from './appearance';
export { THEME_PREFERENCES, THEME_OPTIONS, resolveTheme } from '@platform/appearance';
export type { ThemePreference, ThemeId, ThemeOption } from '@platform/appearance';

export const PALETTES = APP_THEMES.ids;
export type PaletteId = (typeof PALETTES)[number];
export const DEFAULT_PALETTE: PaletteId = APP_THEMES.defaultId;
export type PaletteOption = (typeof APP_THEMES.options)[number];
export const PALETTE_OPTIONS = APP_THEMES.options;

const mode = createThemeMode(appearance);
export const THEME_AXIS = mode.axis;
export const PALETTE_AXIS = defineAxis({
  key: 'palette',
  values: PALETTES,
  fallback: DEFAULT_PALETTE,
});
export const THEME_STORAGE_KEY = THEME_AXIS.storageKey;
export const PALETTE_STORAGE_KEY = PALETTE_AXIS.storageKey;
export const isThemePreference = THEME_AXIS.is;
export const isPaletteId = PALETTE_AXIS.is;
export const applyTheme = mode.apply;
export const applyPalette = PALETTE_AXIS.apply;
