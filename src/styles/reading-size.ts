import { storageKey } from '../app/identity';

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

export const READING_SIZE_STORAGE_KEY = storageKey('reading-size');

/**
 * Reading size is independent of palette and contrast. Keeping it on the root
 * lets every rem-based type role scale together without component overrides.
 */
export function applyReadingSize(size: ReadingSize): void {
  document.documentElement.dataset['readingSize'] = size;
  try {
    localStorage.setItem(READING_SIZE_STORAGE_KEY, size);
  } catch {
    // The in-memory preference still applies when private browsing blocks storage.
  }
}
