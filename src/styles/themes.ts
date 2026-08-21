/**
 * The theme registry.
 *
 * Adding a theme is two steps: create `src/styles/themes/<id>.css` declaring
 * the colour roles under `[data-theme='<id>']`, import it in `global.css`, and
 * add an entry here. The settings UI, the quick toggle and the contrast test
 * all read from this list, so nothing else needs touching.
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
 * Where the resolved preference is cached for the pre-paint script.
 *
 * Derived rather than typed out. It used to be a literal here *and* a literal in
 * `index.html`, with a comment asking the reader to keep them in sync — which is
 * a contract no test could check and nothing would report breaking. `index.html`
 * now carries a `%APP_ID%` placeholder that the build substitutes from the same
 * constant, so there is one spelling and it cannot drift.
 */
export const THEME_STORAGE_KEY = storageKey('theme');

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === 'string' && (THEME_PREFERENCES as readonly string[]).includes(value);
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
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Private browsing can refuse storage; the theme still applies this session.
  }
  return resolved;
}
