/**
 * Motion is a design token and an accessibility contract, in that order.
 *
 * Before the scale existed the tree had `--transition-fast` used twice, `120ms
 * ease` typed out three times, and one lone `200ms ease` — four spellings of two
 * ideas, and no way to change either. These tests keep durations and curves in
 * `primitives.css` where a theme cannot reach them, and keep the global
 * `prefers-reduced-motion` collapse in place so a component never has to
 * remember it.
 *
 * jsdom cannot resolve the cascade, so the stylesheets are read as text — the
 * same approach `contrast.test.ts` takes to the palette.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(process.cwd(), 'src');
const PRIMITIVES = 'styles/primitives.css';
const GLOBAL = 'styles/global.css';

function stylesheets(directory = SRC): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return stylesheets(path);
    return path.endsWith('.css') ? [relative(SRC, path).replaceAll('\\', '/')] : [];
  });
}

const read = (file: string) => readFileSync(join(SRC, file), 'utf8');
const withoutComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** The `prefers-reduced-motion` block, which is *meant* to hard-code a duration. */
function withoutReducedMotion(css: string): string {
  return css.replace(/@media\s*\(prefers-reduced-motion[\s\S]*?\n\}/g, '');
}

const files = stylesheets();

describe('the motion scale', () => {
  it('finds the stylesheets at all', () => {
    // A silent zero here would make every assertion below vacuously true.
    expect(files.length).toBeGreaterThan(5);
    expect(files).toContain(PRIMITIVES);
  });

  it('declares durations and curves in primitives, where a theme cannot reach them', () => {
    const primitives = read(PRIMITIVES);
    for (const token of [
      '--duration-fast',
      '--duration-base',
      '--duration-slow',
      '--ease-out',
      '--ease-spring',
      '--transition-fast',
      '--transition-base',
    ]) {
      expect(primitives, token).toContain(`${token}:`);
    }
  });

  it('keeps themes colour-only', () => {
    // A theme that changed a duration would be a bug in the theme system, not a
    // bold design choice: themes are swapped at runtime and motion is not.
    const themes = files.filter((file) => file.startsWith('styles/themes/'));
    expect(themes.length).toBeGreaterThan(0);

    for (const theme of themes) {
      const css = withoutComments(read(theme));
      expect(css, theme).not.toMatch(/transition|animation|duration|cubic-bezier/);
    }
  });

  it('never hard-codes a duration outside the scale', () => {
    const offenders = files
      .filter((file) => file !== PRIMITIVES)
      .flatMap((file) => {
        const css = withoutReducedMotion(withoutComments(read(file)));
        return [...css.matchAll(/(\d*\.?\d+)m?s\b/g)].map(([match]) => `${file}: ${match}`);
      });

    expect(offenders).toEqual([]);
  });

  it('never hard-codes an easing curve outside the scale', () => {
    const offenders = files
      .filter((file) => file !== PRIMITIVES)
      .filter((file) => /cubic-bezier|\bease(-in|-out|-in-out)?\b/.test(withoutComments(read(file))))
      .map((file) => file);

    expect(offenders).toEqual([]);
  });

  it('collapses every animation under prefers-reduced-motion, once, globally', () => {
    // The reason a component may add motion freely: it is already handled. Delete
    // this block and every transition in the app becomes an accessibility bug at
    // the same moment.
    const css = read(GLOBAL);
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    expect(css).toMatch(/animation-duration:\s*0\.01ms\s*!important/);
    expect(css).toMatch(/transition-duration:\s*0\.01ms\s*!important/);
  });
});
