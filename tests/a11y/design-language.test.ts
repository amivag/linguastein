/**
 * The design language, as an assertion rather than a document.
 *
 * `docs/design-language.md` explains the rules; this is what keeps them true.
 * The one it exists for is **depth, not outlines**: the app used to draw 1px
 * boundaries around cards, panels, rows, badges, banners and every button, which
 * is the single reason it read as a form rather than as an app. That is trivially
 * easy to reintroduce one component at a time, and nothing else would notice.
 *
 * A border is not banned. It is *enumerated* — every one left in the tree is
 * listed below with the reason it earns its place, so adding one is a decision
 * someone has to write down rather than a default someone reaches for.
 *
 * Stylesheets are read as text, the same approach `contrast.test.ts` and
 * `motion.test.ts` take: jsdom cannot resolve the cascade, and the rule being
 * protected is about what the source says anyway.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(process.cwd(), 'src');

function stylesheets(directory = SRC): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return stylesheets(path);
    return path.endsWith('.css') ? [relative(SRC, path).replaceAll('\\', '/')] : [];
  });
}

const read = (file: string) => readFileSync(join(SRC, file), 'utf8');
const withoutComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * Every border in the app, and why it is allowed to be there.
 *
 * Add an entry only with a reason of this kind: something that has no fill and
 * no label of its own, or two runs of identical text that need separating.
 * "It looks better with an outline" is the reasoning this file exists to stop.
 */
const ALLOWED: readonly { file: string; reason: string }[] = [
  {
    file: 'styles/global.css',
    reason:
      'Native fields — select, input, textarea. A field has no fill and no label inside it, so the boundary genuinely is the only thing identifying it as a control, which is exactly what WCAG 1.4.11 asks 3:1 of.',
  },
  {
    file: 'components/Transcript.module.css',
    reason:
      'The rule between the sentences of a *text*. Two runs of prose in the same colour at the same size, and nothing but a line separates them. It moved here from Read.module.css with the markup: one component now draws both a passage and a mission exchange, and only the prose half of it rules a line — a dialogue is bubbles, which separate themselves.',
  },
];

/**
 * Border declarations, with the value captured so it can be judged separately.
 *
 * Both halves of this pattern were wrong when written the obvious way, and both
 * failures were silent inflations of the offender list rather than misses:
 *
 * - `(?<![-\w])` is what stops it matching inside `--color-border`, so a theme
 *   declaring the *role* is not reported as drawing a border.
 * - The value is captured and tested afterwards rather than excluded by a
 *   lookahead. A lookahead behind `\s*` backtracks: with `border: 0`, the `\s*`
 *   gives up its space so the lookahead sees ` 0` instead of `0`, passes, and
 *   every `border: 0` in the tree is reported as a border.
 */
const BORDER = /(?<![-\w])border(-top|-right|-bottom|-left|-block|-inline)?\s*:([^;}]+)/g;

/** Whether a declared value actually draws a line. */
function draws(value: string): boolean {
  const trimmed = value.trim();
  return trimmed !== '0' && trimmed !== 'none';
}

/** Every border-drawing declaration in one stylesheet, as `file: declaration`. */
function borders(file: string, css: string): string[] {
  return [...css.matchAll(BORDER)]
    .filter(([, , value]) => draws(value ?? ''))
    .map(([declaration]) => `${file}: ${declaration.trim()}`);
}

const files = stylesheets();

describe('depth, not outlines', () => {
  it('finds the stylesheets at all', () => {
    // A silent zero would make the assertion below vacuously true, which is how
    // a guard like this quietly stops guarding anything.
    expect(files.length).toBeGreaterThan(10);
  });

  it('draws a border only where one is written down as earning it', () => {
    const allowed = new Set(ALLOWED.map((entry) => entry.file));
    const offenders = files
      .filter((file) => !allowed.has(file))
      .flatMap((file) => borders(file, withoutComments(read(file))));

    expect(offenders).toEqual([]);
  });

  it('still draws the borders it says it needs', () => {
    // The other half: an allowance that stops being used is an allowance that
    // should be deleted, and a rule nobody can violate is not being tested.
    for (const entry of ALLOWED) {
      const drawn = borders(entry.file, withoutComments(read(entry.file)));
      expect(drawn.length, `${entry.file} — ${entry.reason}`).toBeGreaterThan(0);
    }
  });
});

describe('colour comes from a role', () => {
  it('never hard-codes a colour outside the themes', () => {
    /*
     * A hex or an `rgb()` in a component is how the same idea ends up four
     * slightly different shades across an app, and it is invisible to
     * `contrast.test.ts` — which only checks the theme files, so a colour that
     * never reaches one is never checked at all.
     */
    const offenders = files
      .filter((file) => !file.startsWith('styles/themes/'))
      .flatMap((file) => {
        const css = withoutComments(read(file));
        return [...css.matchAll(/#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/g)].map(
          ([match]) => `${file}: ${match}`,
        );
      });

    expect(offenders).toEqual([]);
  });
});

describe('overlay, never push', () => {
  it('routes every modal panel through the one Sheet', () => {
    /*
     * `Sheet` is what makes "a control that expands opens *over* the page" true
     * rather than aspirational, and it also carries the parts a hand-rolled copy
     * forgets: the viewport cap, `overscroll-behavior: contain`, the safe-area
     * padding, and an animation with no fill mode so a non-compositing renderer
     * does not strand the panel mid-keyframe.
     *
     * Two files used to each have their own copy. The guard is that no third
     * appears: only `Sheet.module.css` may pin a full-viewport overlay.
     */
    const overlays = files.filter((file) => {
      const css = withoutComments(read(file));
      return /position:\s*fixed[^}]*inset:\s*0|inset:\s*0[^}]*position:\s*fixed/.test(css);
    });

    expect(overlays).toEqual(['components/Sheet.module.css']);
  });
});
