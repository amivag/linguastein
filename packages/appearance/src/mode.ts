import type { createAppearance } from './axis.ts';

export const THEME_PREFERENCES = ['system', 'dark', 'light'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type ThemeId = Exclude<ThemePreference, 'system'>;
export interface ThemeOption {
  readonly id: ThemePreference;
  readonly label: string;
  readonly icon: 'themeSystem' | 'themeLight' | 'themeDark';
}
export const THEME_OPTIONS: readonly ThemeOption[] = [
  { id: 'system', label: 'System', icon: 'themeSystem' },
  { id: 'light', label: 'Light', icon: 'themeLight' },
  { id: 'dark', label: 'Dark', icon: 'themeDark' },
];
export function resolveTheme(preference: ThemePreference, prefersDark: boolean): ThemeId {
  return preference === 'system' ? (prefersDark ? 'dark' : 'light') : preference;
}
export function createThemeMode(appearance: ReturnType<typeof createAppearance>) {
  const axis = appearance.defineAxis({
    key: 'theme',
    values: THEME_PREFERENCES,
    fallback: 'system' as ThemePreference,
    resolvesFromSystem: true,
  });
  return {
    axis,
    apply(preference: ThemePreference, prefersDark: boolean): ThemeId {
      const resolved = resolveTheme(preference, prefersDark);
      axis.apply(preference, resolved);
      return resolved;
    },
  };
}
