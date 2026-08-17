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

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Stylesheet, and the property every one of its backgrounds must flow through. */
const VARIANT_CONTROLS: readonly [file: string, token: string][] = [
  ['src/components/Button.module.css', '--button-bg'],
  ['src/components/ThemeToggle.module.css', '--control-bg'],
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
