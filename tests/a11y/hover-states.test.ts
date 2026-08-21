/**
 * Hover must not repaint a control in a colour its label was never chosen for.
 *
 * `.button:hover` used to set one shared background. It ties on specificity with
 * `.primary:hover`, so a hovered primary button kept the accent-coloured label
 * from `.primary` on the surface background from the hover rule — white on white
 * in the light theme, and the button vanished.
 *
 * Controls whose background changes with a variant now route every background
 * through a single custom property, and hover tints *that*. jsdom cannot resolve
 * `:hover` through the cascade, so the rule is asserted against the stylesheet
 * itself; the palette behind it is checked in `contrast.test.ts`.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(process.cwd(), 'src');

/** Stylesheet, and the property every one of its backgrounds must flow through. */
const VARIANT_CONTROLS: readonly [file: string, token: string][] = [
  ['src/components/Button.module.css', '--button-bg'],
  ['src/components/ThemeToggle.module.css', '--control-bg'],
  ['src/components/Chip.module.css', '--chip-bg'],
];

function withoutComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Every `background` / `background-color` value the sheet sets. */
function backgroundValues(css: string): string[] {
  const pattern = /(?:^|[;{}\s])background(?:-color)?\s*:\s*([^;}]+)/g;
  return [...withoutComments(css).matchAll(pattern)].map(([, value]) => value!.trim());
}

describe.each(VARIANT_CONTROLS)('%s', (file, token) => {
  const css = readFileSync(resolve(process.cwd(), file), 'utf8');

  it('paints a background at all', () => {
    expect(backgroundValues(css).length).toBeGreaterThan(0);
  });

  it(`routes every background through ${token}`, () => {
    const detached = backgroundValues(css).filter((value) => !value.includes(`var(${token}`));
    expect(detached).toEqual([]);
  });

  it('gives hover a background of its own, so the state is visible', () => {
    const hoverRules = [...withoutComments(css).matchAll(/[^{}]*:hover[^{}]*\{([^}]*)\}/g)];
    const tinting = hoverRules.filter(([, body]) => /background/.test(body!));
    expect(tinting.length).toBeGreaterThan(0);
  });
});

/** Every stylesheet under `src`, so a rule cannot be escaped by moving a file. */
function stylesheets(directory = SRC): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return stylesheets(path);
    return path.endsWith('.css') ? [relative(SRC, path).replaceAll('\\', '/')] : [];
  });
}

/**
 * The other route out of the same trap: a control whose state is an *attribute*,
 * so `[aria-pressed='true']:hover` outranks `.chip:hover` outright and no custom
 * property is needed to keep the two apart.
 *
 * Discovered rather than listed. This used to name `CategoryPicker.module.css`,
 * and when the tile it described moved into the shared `Chip` the assertions
 * would have kept passing against a file that no longer styled a control —
 * which is the failure mode a path-pinned test has. Any stylesheet that styles a
 * pressed control is now held to the rule, and a new one is covered the moment
 * it appears.
 */
const PRESSED = stylesheets().filter((file) =>
  withoutComments(readFileSync(join(SRC, file), 'utf8')).includes("[aria-pressed='true']"),
);

describe('controls whose selected state is an ARIA attribute', () => {
  it('finds them at all', () => {
    // A silent zero would make every assertion below vacuously true.
    expect(PRESSED.length).toBeGreaterThan(0);
  });

  describe.each(PRESSED)('%s', (file) => {
    const css = withoutComments(readFileSync(join(SRC, file), 'utf8'));

    /** Declaration block of the rule whose selector contains `needle`. */
    function block(needle: string): string {
      const rule = css.split('}').find((part) => part.includes(needle) && part.includes('{'));
      return rule?.slice(rule.indexOf('{') + 1) ?? '';
    }

    it('sets a text colour wherever it sets the selected background', () => {
      // A rule that repaints one without the other is how a control ends up
      // with the wrong pair — the failure the tests above exist to prevent.
      const selected = block("[aria-pressed='true']");
      expect(selected).toMatch(/background|--\w[\w-]*-bg/);
      expect(selected).toMatch(/color:/);
    });

    it('exposes selection as ARIA state rather than a class', () => {
      // A `.selected` class would tie with `.chip:hover` on specificity, which
      // is exactly the bug the controls above needed a custom property to escape.
      expect(css).not.toMatch(/\.selected\b/);
    });

    it('gives the selected control its own hover, so it cannot fall back', () => {
      expect(css).toContain("[aria-pressed='true']:hover");
    });

    it('keeps every colour on a role token', () => {
      const literals = [...css.matchAll(/(?:background|color|border-color)\s*:\s*([^;}]+)/g)]
        .map(([, value]) => value!.trim())
        .filter((value) => !/var\(--(color-|\w[\w-]*-bg)/.test(value) && value !== 'inherit');
      expect(literals).toEqual([]);
    });
  });
});
