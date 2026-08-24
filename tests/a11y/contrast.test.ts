/**
 * Colour contrast, checked against the stylesheets themselves.
 *
 * axe cannot check contrast under jsdom — it needs real layout — so the palette
 * is verified here. Nothing is listed by hand: palettes are discovered from
 * `src/styles/themes/` and contrast levels from `src/styles/contrast/`, and
 * every *combination* of the two is checked. A palette added later is held to
 * WCAG AA at every level a learner can select it with, which is the only version
 * of this guarantee worth having — a palette that passes at Normal and fails at
 * Soft is a palette that fails.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONTRAST_LEVELS, DEFAULT_CONTRAST } from '../../src/styles/contrast';
import { DEFAULT_INTENSITY, INTENSITIES } from '../../src/styles/intensity';
import { prePaintAxes } from '../../src/styles/axes';
import { KIND_HUE_COUNT } from '../../src/styles/kinds';
import { PALETTES, THEME_PREFERENCES } from '../../src/styles/themes';
import { READING_SIZES } from '../../src/styles/reading-size';

const THEME_DIR = resolve(process.cwd(), 'src/styles/themes');
const CONTRAST_DIR = resolve(process.cwd(), 'src/styles/contrast');
const GLOBAL_CSS = resolve(process.cwd(), 'src/styles/global.css');
const INDEX_HTML = resolve(process.cwd(), 'index.html');

const MODES = ['dark', 'light'] as const;
type Mode = (typeof MODES)[number];

/** Levels that have a stylesheet: `normal` is the palette as authored. */
const OVERLAID = CONTRAST_LEVELS.filter((level) => level !== DEFAULT_CONTRAST);

function cssFiles(directory: string): string[] {
  return readdirSync(directory)
    .filter((file) => file.endsWith('.css'))
    .sort();
}

/**
 * Declared custom properties, later declarations winning, comments stripped.
 *
 * `intensity` selects which block of a palette file is read, and it has to be
 * asked for explicitly. A palette file now holds three: the authored one, plus a
 * `calm` and a `vivid` restatement of its hues — see `src/styles/intensity.ts`
 * for why those live here rather than in a directory of their own. Reading the
 * file as one flat list would silently return `vivid` for every palette, since it
 * is last, and every assertion below would then be checking one intensity while
 * claiming to check the default.
 */
function declarations(file: string, intensity: string = DEFAULT_INTENSITY): Record<string, string> {
  const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const values: Record<string, string> = {};

  for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const declared = /\[data-intensity='([\w-]+)'\]/.exec(selector!)?.[1];
    // A block with no `data-intensity` is the palette as authored, which *is* the
    // default intensity; one that names an intensity applies only to that one.
    if (declared !== undefined && declared !== intensity) continue;
    for (const [, name, value] of body!.matchAll(/(--color-[\w-]+)\s*:\s*([^;}]+);/g)) {
      values[name!] = value!.trim();
    }
  }

  return values;
}

function channels(hex: string): readonly number[] {
  const digits = hex.replace('#', '');
  const full =
    digits.length === 3 ? [...digits].map((digit) => `${digit}${digit}`).join('') : digits;
  return [0, 2, 4].map((index) => parseInt(full.slice(index, index + 2), 16));
}

function toHex(values: readonly number[]): string {
  return `#${values.map((value) => Math.round(value).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Resolves a declared value to a flat hex.
 *
 * A contrast level is expressed as a mix along the palette's own axis rather
 * than as a colour, which is what keeps it palette-agnostic — so the check has
 * to do the arithmetic the browser does. `in srgb` is a plain per-channel
 * interpolation of the gamma-encoded values, and every colour in the app is
 * opaque, so there is no alpha to premultiply.
 */
function flatten(value: string, tokens: Record<string, string>, seen: ReadonlySet<string>): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('#')) return trimmed;

  const reference = /^var\(\s*(--[\w-]+)\s*\)$/.exec(trimmed);
  if (reference) {
    const name = reference[1]!;
    if (seen.has(name)) throw new Error(`${name} refers to itself`);
    const target = tokens[name];
    if (target === undefined) throw new Error(`${name} is not declared`);
    return flatten(target, tokens, new Set([...seen, name]));
  }

  const mix = /^color-mix\(\s*in srgb\s*,\s*(.+?)\s+([\d.]+)%\s*,\s*(.+?)\s*\)$/.exec(trimmed);
  if (mix) {
    const first = channels(flatten(mix[1]!, tokens, seen));
    const share = Number(mix[2]) / 100;
    const second = channels(flatten(mix[3]!, tokens, seen));
    return toHex(first.map((channel, index) => channel * share + second[index]! * (1 - share)));
  }

  throw new Error(`cannot resolve ${trimmed}`);
}

function flattenAll(raw: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.keys(raw).map((name) => [name, flatten(raw[name]!, raw, new Set([name]))]),
  );
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex)
    .map((value) => value / 255)
    .map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
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
  // A control resting on a card — a segmented option, a swatch, a chip. It
  // carries a label of its own, so it is a background with a contract too.
  ['--color-text', '--color-surface-raised', 4.5, 'a control sitting on a card'],
  ['--color-text-muted', '--color-surface-raised', 4.5, 'a label on a raised control'],
  ['--color-border-strong', '--color-surface-raised', 3, 'a field on a raised control'],
  // The tinted wash at the top of the page is behind ordinary content, so it is
  // held to the same bar as the page itself.
  ['--color-text', '--color-bg-tint', 4.5, 'text on the page wash'],
  ['--color-text-muted', '--color-bg-tint', 4.5, 'labels on the page wash'],
  ['--color-border-strong', '--color-bg-tint', 3, 'controls on the page wash'],
  // Accent- and warm-tinted panels carry body text, so they are backgrounds
  // with a contract rather than decoration. They are also the pairing a contrast
  // level cannot help with: the level moves the text and leaves the tint where
  // the palette put it, so the palette has to leave the room.
  ['--color-text', '--color-accent-soft', 4.5, 'text on an accent-tinted panel'],
  ['--color-text-muted', '--color-accent-soft', 4.5, 'a muted label on an accent-tinted panel'],
  ['--color-text', '--color-highlight-soft', 4.5, 'text on a warm-tinted panel'],
  // The accent badge — a step number, a mission's position, an icon in its own
  // tint. It carries a digit often enough to be held to text contrast rather
  // than to the 3:1 a glyph alone would need.
  ['--color-accent', '--color-accent-soft', 4.5, 'an accent badge on its own tint'],
  // The second accent is used as text and as an icon, in both modes — which is
  // the hard half of adding a warm hue to a light palette.
  ['--color-highlight', '--color-surface', 4.5, 'the second accent on a card'],
  ['--color-highlight', '--color-bg', 4.5, 'the second accent on the page'],
  ['--color-highlight', '--color-highlight-soft', 4.5, 'the second accent on its own panel'],
  // Verdict tints. A learner reads *both* the verdict word and the expected
  // answer off these, so each panel is checked against its own hue and against
  // body text.
  ['--color-success', '--color-success-soft', 4.5, 'a correct verdict on its panel'],
  ['--color-text', '--color-success-soft', 4.5, 'body text on a correct verdict'],
  ['--color-danger', '--color-danger-soft', 4.5, 'an incorrect verdict on its panel'],
  ['--color-text', '--color-danger-soft', 4.5, 'body text on an incorrect verdict'],
  // The header and the tab bar. Declared opaque and mixed towards transparent
  // where they are used, so this is a proxy rather than the literal painted
  // colour — an honest one only while that mix stays above ~90%.
  ['--color-text', '--color-chrome', 4.5, 'a title in the header'],
  ['--color-text-muted', '--color-chrome', 4.5, 'an inactive tab label'],
  ['--color-accent', '--color-chrome', 4.5, 'the active tab'],
  ['--color-border-strong', '--color-chrome', 3, 'a control in the header'],
  // A progress bar carries session position, so the fill has to be legible
  // against its own groove (WCAG 1.4.11 non-text contrast).
  ['--color-accent', '--color-track', 3, 'a progress bar against its track'],
  // The ends of the contrast axis. Nothing is painted with them directly; every
  // level is a mix along the line between them, so a palette whose ends sit
  // close together has no axis to offer and Maximum would mean nothing.
  ['--color-ink', '--color-paper', 12, 'the ends of the contrast axis'],
  /*
   * The categorical family, generated rather than written out: six hues times
   * three pairings is eighteen rows that would otherwise differ only by a digit,
   * and a hand-kept list is how the seventh hue ships unchecked.
   *
   * `KIND_HUE_COUNT` is imported from the module the app assigns hues with, so
   * the count cannot drift between what a palette declares and what a screen can
   * ask for — a hue the app uses but no palette defines is an unstyled badge, and
   * `REQUIRED_ROLES` below turns that into a failure rather than a grey disc.
   *
   * Three pairings, because a badge is used both ways round: the hue fills the
   * disc and the tint carries the glyph in a light palette, and a tinted panel
   * has to carry body text wherever one is used. All three are held to 4.5:1
   * rather than to the 3:1 a glyph alone would need, since these badges carry
   * digits — a mission's position, a set's count.
   */
  ...Array.from({ length: KIND_HUE_COUNT }, (_, index) => index + 1).flatMap(
    (hue): readonly [string, string, number, string][] => [
      [`--color-kind-${hue}`, '--color-surface', 4.5, `categorical hue ${hue} on a card`],
      [
        `--color-kind-${hue}`,
        `--color-kind-${hue}-soft`,
        4.5,
        `categorical hue ${hue} on its own badge`,
      ],
      ['--color-text', `--color-kind-${hue}-soft`, 4.5, `body text on categorical tint ${hue}`],
      /*
       * The tint is a *ground* now, not only a badge fill: a row of material on
       * Home is painted in it and carries a muted note under its label. That
       * pairing went unchecked when the tint was only ever behind a glyph, which
       * is precisely how a component invents a background nothing verifies.
       */
      [
        '--color-text-muted',
        `--color-kind-${hue}-soft`,
        4.5,
        `a muted label on categorical tint ${hue}`,
      ],
    ],
  ),
];

/**
 * OKLab, for the one question a contrast ratio cannot answer.
 *
 * WCAG contrast is a *lightness* comparison, so two colours can pass every floor
 * in this file and still be the same colour to look at — a crimson accent against
 * a crimson danger differ in luminance by nothing that matters and in meaning by
 * everything. This is the perceptual space, so the distance below is measured in
 * it rather than in sRGB, where a fixed step means different things per hue.
 */
function oklab(hex: string): readonly [number, number, number] {
  const [r, g, b] = channels(hex)
    .map((value) => value / 255)
    .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  const l = Math.cbrt(0.4122214708 * r! + 0.5363325363 * g! + 0.0514459929 * b!);
  const m = Math.cbrt(0.2119034982 * r! + 0.6806995451 * g! + 0.1073969566 * b!);
  const s = Math.cbrt(0.0883024619 * r! + 0.2817188376 * g! + 0.6299787005 * b!);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/**
 * How far apart two roles are in hue and chroma, ignoring lightness.
 *
 * Lightness is deliberately excluded: it is the contrast axis's variable, so two
 * roles that differ only in it are the *same colour* at two brightnesses — which
 * is exactly the confusion this measures. A learner distinguishes the primary
 * button from an incorrect verdict by hue, not by how light it is.
 */
function chromaDistance(a: string, b: string): number {
  const [, aA, aB] = oklab(a);
  const [, bA, bB] = oklab(b);
  return Math.hypot(aA - bA, aB - bB);
}

/**
 * The floor for "these two must not be mistaken for each other".
 *
 * Measured rather than chosen, and set immediately beneath the tightest thing
 * already shipped: Teal leaves 0.0637 between its deep teal accent and its green
 * success, which is legible but is as close as this app goes. So the floor sits
 * just under it. Nothing new may be tighter than the tightest existing palette,
 * and Teal itself is on the line rather than grandfathered past it.
 *
 * It caught three palettes on the day it was written. A generated Ember put a
 * crimson accent 0.011 from `danger`, a generated Forest put a green accent 0.012
 * from `success`, and a generated Slate put a coral highlight 0.011 from
 * `danger` — every one of which passed every contrast floor above, because
 * lightness was never the problem. Two of the three had to be redesigned rather
 * than nudged: a palette whose identity *is* crimson cannot coexist with a
 * crimson verdict.
 */
const MEANING_DISTANCE = 0.063;

/**
 * The floor, per intensity.
 *
 * Calm exists to pull chroma out of every hue, which necessarily pulls them all
 * towards the same grey — so holding it to the same separation as Normal would be
 * asking the axis not to work. It gets the floor scaled by the same factor the
 * generator scales chroma by, which is the honest statement: *calm may be quieter,
 * and it may not be proportionally more confusing than normal.*
 *
 * Vivid keeps Normal's floor rather than a raised one. More chroma should mean
 * more separation, but it is clipped at the sRGB gamut, and two hues that both
 * clip land closer together than they started — so the floor stays where it is and
 * Vivid has to clear it like everything else.
 */
function distanceFloor(intensity: string): number {
  return intensity === 'calm' ? Number((MEANING_DISTANCE * 0.55).toFixed(4)) : MEANING_DISTANCE;
}

/** The pairs whose meanings must never be confused with one another. */
const DISTINCT: readonly [string, string][] = [
  ['--color-accent', '--color-success'],
  ['--color-accent', '--color-danger'],
  ['--color-accent', '--color-highlight'],
  ['--color-highlight', '--color-success'],
  ['--color-highlight', '--color-danger'],
  ['--color-success', '--color-danger'],
];

/** Every role a palette must define; the app breaks silently without them. */
const REQUIRED_ROLES = [...new Set(PAIRS.flatMap(([a, b]) => [a, b]))];

const paletteFiles = cssFiles(THEME_DIR);
const levelFiles = cssFiles(CONTRAST_DIR);

const modeOf = (file: string): Mode => file.replace('.css', '').split('-')[1]! as Mode;

/** Palette tokens at one intensity, with a level's overrides applied. */
function combination(
  paletteFile: string,
  level: string,
  intensity: string = DEFAULT_INTENSITY,
): Record<string, string> {
  const base = declarations(resolve(THEME_DIR, paletteFile), intensity);
  const overlay =
    level === DEFAULT_CONTRAST
      ? {}
      : declarations(resolve(CONTRAST_DIR, `${level}-${modeOf(paletteFile)}.css`));
  /*
   * The level goes on top, and the two cannot fight: a level restates only
   * neutrals and an intensity only hues, which is the invariant that lets this be
   * a spread rather than a merge strategy. The two assertions at the bottom of
   * this file are what keep it true.
   */
  return flattenAll({ ...base, ...overlay });
}

describe('the appearance registry and the stylesheets agree', () => {
  it('ships one file per palette per mode, and no orphans', () => {
    const expected = PALETTES.flatMap((palette) => MODES.map((mode) => `${palette}-${mode}.css`));
    expect(paletteFiles).toEqual([...expected].sort());
  });

  it('ships one file per contrast level per mode, except the default', () => {
    const expected = OVERLAID.flatMap((level) => MODES.map((mode) => `${level}-${mode}.css`));
    expect(levelFiles).toEqual([...expected].sort());
  });

  it('imports every palette before every contrast level', () => {
    /*
     * A palette and a level tie on specificity, so the later import is what
     * wins. A level restates what a palette declared — reverse the order and
     * every level silently stops applying, which looks exactly like a level
     * nobody ever authored.
     */
    const css = readFileSync(GLOBAL_CSS, 'utf8');

    expect(paletteFiles.filter((file) => !css.includes(`themes/${file}`))).toEqual([]);
    expect(levelFiles.filter((file) => !css.includes(`contrast/${file}`))).toEqual([]);

    const lastPalette = Math.max(...paletteFiles.map((file) => css.indexOf(`themes/${file}`)));
    const firstLevel = Math.min(...levelFiles.map((file) => css.indexOf(`contrast/${file}`)));
    expect(lastPalette).toBeLessThan(firstLevel);
  });

  it('takes its pre-paint values from the registry rather than a copy of it', () => {
    /*
     * This used to be a drift test. The pre-paint script cannot import a module,
     * so it repeated every axis's values as literal arrays and this compared the
     * two lists — which worked, and was a guard around a duplication that did not
     * have to exist. `vite.config.ts` now substitutes `%APPEARANCE_AXES%` from
     * `src/styles/axes.ts` at build and dev time, exactly as it substitutes the
     * app id, so there is one list.
     *
     * What is left to check is that nobody puts the copy back. A literal axis
     * array in the HTML would work — and would silently stop tracking the
     * registry the moment a value was added, which is the failure the old test
     * existed to catch and the new arrangement makes impossible.
     */
    const html = readFileSync(INDEX_HTML, 'utf8');
    const literal = (values: readonly string[]) =>
      `[${values.map((value) => `'${value}'`).join(', ')}]`;

    expect(html).toContain('%APPEARANCE_AXES%');
    for (const values of [
      THEME_PREFERENCES,
      PALETTES,
      CONTRAST_LEVELS,
      READING_SIZES,
      INTENSITIES,
    ]) {
      expect(html, 'an axis is spelled out in the HTML again').not.toContain(literal(values));
    }
  });

  it('offers every axis to the pre-paint script', () => {
    /*
     * The registry is what the HTML gets, so an axis missing from it is an axis
     * that applies only after boot — a flash of the wrong colours, and the one
     * failure mode this whole arrangement exists to prevent. Checked by value
     * rather than by count so the message names what is missing.
     */
    const axes = prePaintAxes();
    const byKey = new Map(axes.map((axis) => [axis.key, axis]));

    expect([...byKey.keys()].sort()).toEqual(
      ['contrast', 'intensity', 'palette', 'reading-size', 'theme'].sort(),
    );
    expect(byKey.get('palette')?.values).toEqual([...PALETTES]);
    expect(byKey.get('contrast')?.values).toEqual([...CONTRAST_LEVELS]);
    expect(byKey.get('intensity')?.values).toEqual([...INTENSITIES]);
    expect(byKey.get('reading-size')?.values).toEqual([...READING_SIZES]);
    // `data-reading-size` is the attribute; `readingSize` is how `dataset` spells
    // it, and the script assigns through `dataset`. A mismatch here is a stylesheet
    // that never matches anything.
    expect(byKey.get('reading-size')?.dataset).toBe('readingSize');
    // Only the theme resolves against an OS preference, and the script branches on
    // this flag rather than on the axis's name.
    expect(axes.filter((axis) => axis.system).map((axis) => axis.key)).toEqual(['theme']);
  });
});

describe.each(paletteFiles)('%s', (file) => {
  it('declares every colour role', () => {
    const declared = declarations(resolve(THEME_DIR, file));
    const missing = REQUIRED_ROLES.filter((role) => !(role in declared));
    expect(missing).toEqual([]);
  });

  it('meets every contrast minimum at every level a learner can pick', () => {
    /*
     * Collected rather than one case per pairing: four contrast levels times
     * three intensities times sixty-odd pairings times a palette is far too many
     * test names, and a failure is easier to act on as a list of what broke than
     * as the first assertion to throw.
     */
    const failures = CONTRAST_LEVELS.flatMap((level) =>
      INTENSITIES.flatMap((intensity) => {
        const tokens = combination(file, level, intensity);
        return PAIRS.flatMap(([foreground, background, minimum, use]) => {
          const ratio = contrast(tokens[foreground]!, tokens[background]!);
          if (Number(ratio.toFixed(2)) >= minimum) return [];
          return [
            `${level}/${intensity}: ${foreground} on ${background} = ${ratio.toFixed(2)}, needs ${minimum} (${use})`,
          ];
        });
      }),
    );

    expect(failures).toEqual([]);
  });

  it('keeps every colour that means something apart from every other', () => {
    /*
     * Rule 5 of the design language says four hues carry four meanings. That is
     * only true while a learner can tell them apart, and no floor above this one
     * checks it: contrast is a lightness comparison, and these six pairs can each
     * pass it while being the same colour.
     *
     * Checked once per intensity and not per contrast level, because a level may
     * not touch a hue — so if this holds for the three intensities it holds
     * everywhere. Calm is the interesting one: pulling chroma out of every hue
     * pulls them all towards the same grey, which is exactly how two meanings
     * converge.
     */
    const failures = INTENSITIES.flatMap((intensity) => {
      const tokens = combination(file, DEFAULT_CONTRAST, intensity);
      const floor = distanceFloor(intensity);
      return DISTINCT.flatMap(([first, second]) => {
        const distance = chromaDistance(tokens[first]!, tokens[second]!);
        if (distance >= floor) return [];
        return [
          `${intensity}: ${first} and ${second} are ${distance.toFixed(3)} apart, needs ${floor}`,
        ];
      });
    });

    expect(failures).toEqual([]);
  });

  it('gets sharper with every step up the contrast axis', () => {
    /*
     * The axis has to mean what it says. Without this a level could be authored
     * "softer" and come out sharper than the default, and nothing would notice —
     * every floor above would still pass. Body text and muted text are the two
     * roles a level moves furthest, so they are what is compared.
     */
    const readings = CONTRAST_LEVELS.map((level) => {
      const tokens = combination(file, level);
      return {
        level,
        text: contrast(tokens['--color-text']!, tokens['--color-bg']!),
        muted: contrast(tokens['--color-text-muted']!, tokens['--color-surface']!),
      };
    });

    for (const [index, reading] of readings.entries()) {
      const previous = readings[index - 1];
      if (!previous) continue;
      expect(reading.text, `${previous.level} to ${reading.level}, body text`).toBeGreaterThan(
        previous.text,
      );
      expect(reading.muted, `${previous.level} to ${reading.level}, muted text`).toBeGreaterThan(
        previous.muted,
      );
    }
  });
});

describe.each(levelFiles)('%s', (file) => {
  const declared = Object.keys(declarations(resolve(CONTRAST_DIR, file)));

  it('restates roles the palettes declare, and invents none', () => {
    // A typo in a role name is invisible: the declaration simply does nothing,
    // and the level quietly has one fewer step than it claims to.
    expect(declared.filter((role) => !REQUIRED_ROLES.includes(role))).toEqual([]);
    expect(declared.length).toBeGreaterThan(0);
  });

  it('leaves every hue to the palette', () => {
    /*
     * This is the reason a level works for a palette written after it. A level
     * that set `--color-accent` would make Sand's bronze indigo at Maximum, and
     * the failure would look like a palette bug rather than a level bug.
     */
    expect(
      declared.filter((role) => /accent|highlight|success|danger|ink|paper/.test(role)),
    ).toEqual([]);
  });
});

describe.each(paletteFiles)('%s intensity blocks', (file) => {
  /** Roles a contrast level owns, and which an intensity must therefore not set. */
  const NEUTRALS = [
    '--color-bg',
    '--color-bg-tint',
    '--color-surface',
    '--color-surface-raised',
    '--color-surface-sunken',
    '--color-chrome',
    '--color-border',
    '--color-border-strong',
    '--color-track',
    '--color-text',
    '--color-text-muted',
    '--color-ink',
    '--color-paper',
  ];

  it('ships a block for every intensity a learner can pick', () => {
    /*
     * Unlike a contrast level, an intensity is not palette-agnostic — it is a
     * transformation of this palette's own hues, so only this palette can express
     * it (see `src/styles/intensity.ts`). The cost of that is exactly this test:
     * a palette added without its two blocks would silently be stuck at one
     * volume while the picker offered three.
     */
    const css = readFileSync(resolve(THEME_DIR, file), 'utf8');
    for (const intensity of INTENSITIES) {
      if (intensity === DEFAULT_INTENSITY) continue;
      expect(css, `${file} declares no ${intensity} block`).toContain(
        `[data-intensity='${intensity}']`,
      );
    }
  });

  it('leaves every neutral to the contrast axis', () => {
    /*
     * The invariant that lets a level and an intensity compose instead of
     * fighting: one owns the neutrals, the other owns the hues. An intensity that
     * set `--color-surface` would silently override whichever contrast level the
     * learner had chosen, and the failure would look like a broken contrast level.
     */
    const css = readFileSync(resolve(THEME_DIR, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const offences: string[] = [];

    for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      if (!/\[data-intensity='/.test(selector!)) continue;
      // Whitespace out, then a plain substring test: a role name is not a regex,
      // and building one per role invites escaping bugs for no benefit.
      const declared = body!.replace(/\s+/g, '');
      for (const role of NEUTRALS) {
        if (declared.includes(`${role}:`)) offences.push(role);
      }
    }

    expect([...new Set(offences)]).toEqual([]);
  });

  it('actually changes the hues it claims to', () => {
    // A block that parsed but changed nothing would pass every other assertion
    // here and leave the picker offering three identical choices.
    const normal = combination(file, DEFAULT_CONTRAST, DEFAULT_INTENSITY);
    for (const intensity of INTENSITIES) {
      if (intensity === DEFAULT_INTENSITY) continue;
      const other = combination(file, DEFAULT_CONTRAST, intensity);
      const moved = Object.keys(normal).filter((role) => normal[role] !== other[role]);
      expect(moved.length, `${intensity} moved nothing`).toBeGreaterThan(6);
    }
  });
});
