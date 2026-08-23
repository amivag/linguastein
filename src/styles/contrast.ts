/**
 * The contrast axis: how far apart a palette's neutrals sit.
 *
 * Its own axis rather than a set of palettes, for the reason `docs/theming.md`
 * gives: encoding it into the theme id would mean `dark-teal-more` and a new
 * file for every combination. A level restates the neutral roles as positions
 * along the palette's own `paper` → `ink` line, so it works for palettes written
 * after it and never touches a hue.
 *
 * Every level is a level a learner can pick, so every level is held to WCAG AA:
 * `tests/a11y/contrast.test.ts` checks each palette against each level, and
 * asserts they come out in this order. Soft is quieter, not less legible.
 */

import { storageKey } from '../app/identity';

export const CONTRAST_LEVELS = ['soft', 'normal', 'more', 'max'] as const;
export type ContrastLevel = (typeof CONTRAST_LEVELS)[number];

export const DEFAULT_CONTRAST: ContrastLevel = 'normal';

export interface ContrastOption {
  readonly id: ContrastLevel;
  /** Shown in the control; the full label is the accessible name. */
  readonly shortLabel: string;
  readonly label: string;
}

export const CONTRAST_OPTIONS: readonly ContrastOption[] = [
  { id: 'soft', shortLabel: 'Soft', label: 'Soft contrast' },
  { id: 'normal', shortLabel: 'Normal', label: 'Normal contrast' },
  { id: 'more', shortLabel: 'More', label: 'More contrast' },
  { id: 'max', shortLabel: 'Max', label: 'Maximum contrast' },
];

export const CONTRAST_STORAGE_KEY = storageKey('contrast');

export function isContrastLevel(value: unknown): value is ContrastLevel {
  return typeof value === 'string' && (CONTRAST_LEVELS as readonly string[]).includes(value);
}

/**
 * `normal` is written out like any other level even though no stylesheet
 * matches it. A missing attribute and an explicit `normal` then mean the same
 * thing, which is what lets the pickers pass a level down to a preview swatch
 * without a special case.
 */
export function applyContrast(level: ContrastLevel): void {
  document.documentElement.dataset['contrast'] = level;
  try {
    localStorage.setItem(CONTRAST_STORAGE_KEY, level);
  } catch {
    // The in-memory preference still applies when private browsing blocks storage.
  }
}
