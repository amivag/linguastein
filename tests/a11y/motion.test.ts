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
      .filter((file) =>
        /cubic-bezier|\bease(-in|-out|-in-out)?\b/.test(withoutComments(read(file))),
      )
      .map((file) => file);

    expect(offenders).toEqual([]);
  });

  it('gives a navigation a transition, and gives the chrome none', () => {
    /*
     * A screen used to replace the last one between two frames, which on a phone
     * is indistinguishable from a reload. The entrance is on `main` rather than on
     * the shell, and that placement is the whole design: every screen renders its
     * own `AppShell`, so a navigation remounts `main` and the animation plays,
     * while a change to the query string keeps the same screen mounted and does
     * not re-animate a filtered list.
     *
     * The header is deliberately outside it — the way back and the voice control
     * are the same on both sides of a navigation, so animating them would report
     * a change that did not happen.
     */
    const css = withoutComments(read('components/AppShell.module.css'));
    const main = css.slice(css.indexOf('.main {'));
    expect(main.slice(0, main.indexOf('}'))).toMatch(/animation:\s*\w+\s+var\(--transition-/);
    expect(css).toMatch(/@keyframes\s+\w+/);

    const header = css.slice(css.indexOf('.header {'));
    expect(header.slice(0, header.indexOf('}'))).not.toMatch(/animation/);
  });

  it('declares the press pair, and only in primitives', () => {
    const primitives = read(PRIMITIVES);
    expect(primitives).toContain('--duration-instant:');
    expect(primitives).toContain('--transition-press:');
  });

  /*
   * One press idiom.
   *
   * The app had two. A chip, a nav pill and a play control dipped by `scale`;
   * a button travelled downwards onto a hard-edged shadow acting as a keycap
   * edge; a card un-lifted from its hover; and Home's course rows — the screen a
   * learner lands on — had no press state at all. Four answers to one question,
   * and only the first of them works on a full-width row, where there is no edge
   * to push onto and two pixels of travel are invisible.
   *
   * So: a press is a scale. The assertion is not "everything scales" — plenty of
   * rules are pressed and want no geometry — but that nothing presses by *moving*,
   * because that is the metaphor that cannot coexist with the other one.
   */
  describe('a press is a scale, never a travel', () => {
    /** Every `:active` rule in the tree, as selector plus body. */
    const pressed = files.flatMap((file) => {
      const css = withoutComments(read(file));
      return [...css.matchAll(/([^{}]*:active[^{}]*)\{([^}]*)\}/g)].map(([, selector, body]) => ({
        file,
        selector: selector!.trim(),
        body: body!,
      }));
    });

    it('finds the pressed rules at all', () => {
      // A silent zero would make both assertions below vacuously true.
      expect(pressed.length).toBeGreaterThan(5);
    });

    it('never translates a control on press', () => {
      /*
       * A reset is allowed and is the only allowed value: a card that lifted on
       * hover has to come back down before it scales, or the press reads as the
       * card retreating. Anything else is the keycap coming back.
       */
      const moving = pressed
        .filter(({ body }) => /(?<![-\w])translate\s*:/.test(body))
        .filter(({ body }) => {
          const value = /(?<![-\w])translate\s*:([^;}]+)/.exec(body)?.[1]?.trim();
          return value !== 'none' && value !== '0 0' && value !== '0';
        })
        .map(({ file, selector }) => `${file}: ${selector}`);

      expect(moving).toEqual([]);
    });

    it('times the dip faster than the return, wherever it dips at all', () => {
      /*
       * The asymmetry is the idiom rather than a detail of it: the finger is down
       * before anything is drawn, so the dip has to land under the threshold where
       * it reads as motion, and the return is the only half with a chance to feel
       * physical. A rule that scales on the same timing as its rest state has the
       * shape of a press and not the feel of one.
       */
      const untimed = pressed
        .filter(({ body }) => /(?<![-\w])scale\s*:/.test(body))
        .filter(({ body }) => !body.includes('var(--transition-press)'))
        .map(({ file, selector }) => `${file}: ${selector}`);

      expect(untimed).toEqual([]);
    });

    it('is what the shared pressable recipe does, so a screen need not restate it', () => {
      // The recipe exists because this was written three times and one of the
      // three forgot the press. Cards and Home's rows both compose it now.
      const surfaces = withoutComments(read('styles/surfaces.module.css'));
      expect(surfaces).toMatch(/\.pressable:active\s*\{[^}]*scale:/);
      expect(withoutComments(read('features/home/HomeScreen.module.css'))).toMatch(
        /composes:[^;]*pressable/,
      );
    });
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
