import { defineAxis } from './appearance';

export const READING_SIZES = ['small', 'medium', 'large'] as const;
export type ReadingSize = (typeof READING_SIZES)[number];

export interface ReadingSizeOption {
  readonly id: ReadingSize;
  readonly shortLabel: 'S' | 'M' | 'L';
  readonly label: string;
}

export const READING_SIZE_OPTIONS: readonly ReadingSizeOption[] = [
  { id: 'small', shortLabel: 'S', label: 'Small' },
  { id: 'medium', shortLabel: 'M', label: 'Medium' },
  { id: 'large', shortLabel: 'L', label: 'Large' },
];

/**
 * Reading size is independent of palette, contrast and intensity. Keeping it on
 * the root lets every rem-based type role scale together without per-component
 * overrides.
 */
export const READING_SIZE_AXIS = defineAxis({
  key: 'reading-size',
  values: READING_SIZES,
  fallback: 'small' as ReadingSize,
});

export const READING_SIZE_STORAGE_KEY = READING_SIZE_AXIS.storageKey;
export const applyReadingSize = READING_SIZE_AXIS.apply;
export const isReadingSize = READING_SIZE_AXIS.is;
