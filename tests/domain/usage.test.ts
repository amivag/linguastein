/**
 * Register, address and region are the difference between knowing a phrase and
 * knowing when it is safe to say it, so they are held to the same bar as the
 * rest of the content model.
 */

import { describe, expect, it } from 'vitest';
import { isUsableIn, regionCovers } from '../../src/domain/content';

describe('regionCovers', () => {
  it('matches a locale exactly', () => {
    expect(regionCovers('es-MX', 'es-MX')).toBe(true);
    expect(regionCovers('es-ES', 'es-MX')).toBe(false);
  });

  it('treats es-419 as covering Latin American locales', () => {
    expect(regionCovers('es-419', 'es-MX')).toBe(true);
    expect(regionCovers('es-419', 'es-AR')).toBe(true);
    expect(regionCovers('es-419', 'es-CO')).toBe(true);
    // Spain is not Latin America; `papa` should not be taught for Madrid.
    expect(regionCovers('es-419', 'es-ES')).toBe(false);
  });

  it('treats a bare language tag as everywhere that language is spoken', () => {
    expect(regionCovers('es', 'es-MX')).toBe(true);
    expect(regionCovers('es', 'en-GB')).toBe(false);
  });
});

describe('isUsableIn', () => {
  it('lets unmarked content through anywhere — the common case', () => {
    expect(isUsableIn(undefined, 'es-MX')).toBe(true);
    expect(isUsableIn([], 'es-ES')).toBe(true);
  });

  it('keeps regional content out of the wrong region', () => {
    expect(isUsableIn(['es-ES'], 'es-MX')).toBe(false);
    expect(isUsableIn(['es-ES'], 'es-ES')).toBe(true);
    expect(isUsableIn(['es-419'], 'es-AR')).toBe(true);
  });

  it('passes content marked for several regions if any one matches', () => {
    expect(isUsableIn(['es-ES', 'es-419'], 'es-CO')).toBe(true);
  });
});
