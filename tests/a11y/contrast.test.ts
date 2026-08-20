/**
 * Colour contrast, checked against the theme files themselves.
 *
 * axe cannot check contrast under jsdom — it needs real layout — so the palette
 * is verified here. Themes are discovered from `src/styles/themes/`, so a theme
 * added later is held to the same WCAG AA bar without touching this file.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const THEME_DIR = resolve(process.cwd(), 'src/styles/themes');

function themeFiles(): string[] {
  return readdirSync(THEME_DIR)
    .filter((file) => file.endsWith('.css'))
    .sort();
}

function tokensOf(file: string): Record<string, string> {
  const css = readFileSync(resolve(THEME_DIR, file), 'utf8');
  const values: Record<string, string> = {};
  for (const [, name, value] of css.matchAll(/(--color-[\w-]+):\s*(#[0-9a-fA-F]{6});/g)) {
    values[name!] = value!;
  }
  return values;
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255);
  const [r, g, b] = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

export function contrast(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Foreground role, background role, minimum ratio, what it is used for. */
const PAIRS: readonly [string, string, number, string][] = [
  ['--color-text', '--color-bg', 4.5, 'body text'],
  ['--color-text', '--color-surface', 4.5, 'card text'],
  ['--color-text-muted', '--color-surface', 4.5, 'hints and labels'],
  ['--color-text-muted', '--color-bg', 4.5, 'secondary text'],
  ['--color-accent', '--color-bg', 4.5, 'links'],
  ['--color-accent-contrast', '--color-accent', 4.5, 'primary button label'],
  ['--color-success', '--color-surface', 4.5, 'revealed translation'],
  ['--color-danger', '--color-surface', 4.5, 'incorrect answer feedback'],
  ['--color-text', '--color-surface-sunken', 4.5, 'an answer on a sunken row'],
  ['--color-text-muted', '--color-surface-sunken', 4.5, 'labels on a sunken row'],
  ['--color-border-strong', '--color-surface-sunken', 3, 'outlines on a sunken row'],
  ['--color-border-strong', '--color-surface', 3, 'button and input outlines'],
  ['--color-border-strong', '--color-bg', 3, 'controls on the page background'],
  ['--color-border', '--color-surface', 1.2, 'decorative separators'],
  // The tinted wash at the top of the page is behind ordinary content, so it is
  // held to the same bar as the page itself.
  ['--color-text', '--color-bg-tint', 4.5, 'text on the page wash'],
  ['--color-text-muted', '--color-bg-tint', 4.5, 'labels on the page wash'],
  ['--color-border-strong', '--color-bg-tint', 3, 'controls on the page wash'],
  // Accent- and warm-tinted panels carry body text, so they are backgrounds
  // with a contract rather than decoration.
  ['--color-text', '--color-accent-soft', 4.5, 'text on an accent-tinted panel'],
  ['--color-text', '--color-highlight-soft', 4.5, 'text on a warm-tinted panel'],
  // The second accent is used as text and as an icon, in both themes — which is
  // the hard half of adding a warm hue to a light palette.
  ['--color-highlight', '--color-surface', 4.5, 'the warm accent on a card'],
  ['--color-highlight', '--color-bg', 4.5, 'the warm accent on the page'],
  ['--color-highlight', '--color-highlight-soft', 4.5, 'the warm accent on its own panel'],
];

/** Every role a theme must define; the app breaks silently without them. */
const REQUIRED_ROLES = [...new Set(PAIRS.flatMap(([a, b]) => [a, b]))];

describe('themes', () => {
  it('ships at least the dark and light themes', () => {
    expect(themeFiles()).toEqual(expect.arrayContaining(['dark.css', 'light.css']));
  });

  describe.each(themeFiles())('%s', (file) => {
    const tokens = tokensOf(file);

    it('declares every colour role', () => {
      const missing = REQUIRED_ROLES.filter((role) => !(role in tokens));
      expect(missing).toEqual([]);
    });

    it.each(PAIRS)('%s on %s meets %s:1 (%s)', (foreground, background, minimum) => {
      const ratio = contrast(tokens[foreground]!, tokens[background]!);
      expect(Number(ratio.toFixed(2))).toBeGreaterThanOrEqual(minimum);
    });
  });
});
