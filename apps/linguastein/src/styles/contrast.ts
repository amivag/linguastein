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

import { defineAxis } from './appearance';

export const CONTRAST_LEVELS = ['soft', 'normal', 'more', 'max'] as const;
export type ContrastLevel = (typeof CONTRAST_LEVELS)[number];

export const DEFAULT_CONTRAST: ContrastLevel = 'normal';

/**
 * The axis itself, declared through the shared mechanism in `appearance.ts`.
 *
 * The names below are re-exported rather than removed: they are what forty call
 * sites and three tests already say, and the point of the refactor was to delete
 * the *duplicated mechanism*, not to make every screen learn a new spelling.
 */
export const CONTRAST_AXIS = defineAxis({
  key: 'contrast',
  values: CONTRAST_LEVELS,
  fallback: DEFAULT_CONTRAST,
});

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

export const CONTRAST_STORAGE_KEY = CONTRAST_AXIS.storageKey;

export const isContrastLevel = CONTRAST_AXIS.is;

/** See `AppearanceAxis.apply` for why `normal` is written out like any other. */
export const applyContrast = CONTRAST_AXIS.apply;
