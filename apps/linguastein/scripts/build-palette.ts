#!/usr/bin/env tsx
/**
 * Authors palettes, so that nobody has to author colours.
 *
 * A palette in this app is 24 categorical hues and their tints, four meanings and
 * their tints, eleven neutrals and five shadows, per mode — and every one of them
 * has to clear WCAG AA against every ground the four contrast levels can produce,
 * at each of the three intensities. That is a few hundred constraints per palette.
 * Hand-tuning it converges on mud: the colours that are easy to find by eye are
 * the desaturated ones, because those are the ones with contrast to spare.
 *
 * So palettes are solved, not picked. You choose a handful of *hue angles* — the
 * palette's temperature, its accent, its second accent, where its categorical
 * wheel starts — and this finds values that clear the floors while staying as
 * close as possible to a shared target tone.
 *
 * Usage:
 *
 * ```sh
 * npm run build:palette -- new slate --neutral 250 --accent 252 --highlight 318 --wheel 200
 * npm run build:palette -- intensity        # refresh calm/vivid for every palette
 * ```
 *
 * `intensity` is the one to re-run after editing a palette by hand: the calm and
 * vivid blocks are derived from the authored hues, so an edited accent leaves them
 * stale until it does. `tests/a11y/contrast.test.ts` is the judge either way —
 * this script exists to make that test easy to pass, not to be trusted instead of
 * it.
 *
 * ## Porting this to another app
 *
 * Nothing here knows what the app is. It reads the contrast levels from
 * `src/styles/contrast/`, writes palettes to `src/styles/themes/`, and takes every
 * other decision from `SHAPE` below — the role list, the target tones, the
 * neutral positions on the ink→paper line. An app with a different role list edits
 * `SHAPE`; an app with the same one edits nothing.
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  chromaDistance,
  contrast,
  fromOklch,
  inGamut,
  mix,
  scaleChroma,
  type Hex,
} from './palette/colour.ts';

const THEME_DIR = resolve('src/styles/themes');
const CONTRAST_DIR = resolve('src/styles/contrast');

type Mode = 'dark' | 'light';

/**
 * Everything about this app's palette shape, in one object.
 *
 * The numbers are deliberately here and not spread through the code: they are the
 * design decisions, and an app scaffolded from this skeleton adjusts them rather
 * than reading the solver.
 */
const SHAPE = {
  /** How many categorical hues, and how far apart their tints sit from `paper`. */
  wheel: { count: 12, softShare: { dark: 0.16, light: 0.12 } },

  /**
   * The tone a family shares. Every hue is pulled off this only as far as the
   * contrast floors force it, which is what makes twelve hues read as a family
   * rather than as a rainbow — maximising chroma instead walks each one to the
   * edge of the sRGB gamut and the result is neon.
   */
  target: {
    wheel: { dark: { L: 0.72, C: 0.145 }, light: { L: 0.5, C: 0.15 } },
    meaning: { dark: { L: 0.74, C: 0.16 }, light: { L: 0.45, C: 0.17 } },
  },

  /**
   * Where the authored `normal` level sits on this palette's ink→paper line, as a
   * percentage of ink. It has to fall strictly between `soft` and `more` for both
   * body text and muted text, which `contrast.test.ts` asserts as the axis being
   * ordered.
   */
  normal: {
    dark: {
      bg: 5,
      'bg-tint': 8,
      surface: 8,
      'surface-raised': 12,
      'surface-sunken': 3,
      chrome: 7,
      border: 17,
      'border-strong': 48,
      track: 16,
      text: 92,
      'text-muted': 70,
    },
    light: {
      bg: 4,
      'bg-tint': 7,
      surface: 0,
      'surface-raised': 0,
      'surface-sunken': 7,
      chrome: 1,
      border: 12,
      'border-strong': 55,
      track: 16,
      text: 91,
      'text-muted': 69,
    },
  },

  /** The two hues that mean a verdict. Fixed, because their meaning is. */
  verdict: { success: 152, danger: 26 },

  /** Chroma multipliers for the two non-default intensities. */
  intensity: { calm: 0.55, vivid: 1.45 },

  /**
   * Floors. `text` carries a margin over the 4.5 the test asserts, because the
   * test rounds to two decimals and a value solved at exactly 4.5 can land at
   * 4.4951 — passing here and failing there.
   */
  floor: { text: 4.56, nonText: 3, meaning: 0.063 },
} as const;

const NEUTRAL_ROLES = Object.keys(SHAPE.normal.dark) as (keyof typeof SHAPE.normal.dark)[];
const MEANING_ROLES = ['accent', 'highlight', 'success', 'danger'] as const;

// ---------------------------------------------------------------- reading state

/**
 * Custom properties declared in a stylesheet, later declarations winning.
 *
 * Takes CSS rather than a path, and that is load-bearing rather than tidy: a
 * palette file now ends with the `calm` and `vivid` blocks this script generates,
 * so reading the *file* hands back the vivid values as though they were the
 * palette. Regenerating then scaled the already-scaled hues — `#9e151b` became
 * `#d00000`, clipped at the gamut edge, and the calm block came out more saturated
 * than the authored palette. Every caller here passes the stripped base for that
 * reason.
 */
function declarationsFrom(css: string): Record<string, string> {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out: Record<string, string> = {};
  for (const [, name, value] of stripped.matchAll(/(--color-[\w-]+)\s*:\s*([^;}]+);/g)) {
    out[name!] = value!.trim();
  }
  return out;
}

function declarations(file: string, directory = THEME_DIR): Record<string, string> {
  return declarationsFrom(readFileSync(resolve(directory, file), 'utf8'));
}

/**
 * Every value a neutral role takes across the four contrast levels.
 *
 * This is the reason a palette cannot be solved against one background: a hue has
 * to clear the *lightest* surface a level can produce as well as the darkest, and
 * which of those binds differs per mode.
 */
function neutralVariants(role: string, mode: Mode, ink: Hex, paper: Hex): readonly Hex[] {
  const share = SHAPE.normal[mode][role as keyof (typeof SHAPE.normal)[Mode]];
  const values: Hex[] = share === undefined ? [] : [mix(ink, share / 100, paper)];

  for (const level of ['soft', 'more', 'max']) {
    const expression = declarations(`${level}-${mode}.css`, CONTRAST_DIR)[`--color-${role}`];
    if (!expression) continue;
    const inkShare = /var\(--color-ink\)\s*([\d.]+)%/.exec(expression);
    if (inkShare) values.push(mix(ink, Number(inkShare[1]) / 100, paper));
    else if (expression === 'var(--color-paper)') values.push(paper);
    else if (expression === 'var(--color-ink)') values.push(ink);
  }

  return values;
}

interface Grounds {
  readonly ink: Hex;
  readonly paper: Hex;
  /** Everything a hue can be drawn on top of, at any contrast level. */
  readonly backgrounds: readonly Hex[];
  readonly surfaces: readonly Hex[];
  readonly tracks: readonly Hex[];
  readonly texts: readonly Hex[];
}

function groundsFor(ink: Hex, paper: Hex, mode: Mode): Grounds {
  const of = (role: string) => neutralVariants(role, mode, ink, paper);
  return {
    ink,
    paper,
    backgrounds: [
      ...of('surface'),
      ...of('bg'),
      ...of('chrome'),
      ...of('bg-tint'),
      ...of('surface-raised'),
      ...of('surface-sunken'),
    ],
    surfaces: of('surface'),
    tracks: of('track'),
    texts: of('text'),
  };
}

// -------------------------------------------------------------------- the solve

type Check = readonly [Hex, number];
const clears = (checks: readonly Check[]) => (candidate: Hex) =>
  checks.every(([other, minimum]) => contrast(candidate, other) >= minimum);

interface Solved {
  readonly value: Hex;
  readonly soft: Hex;
}

/**
 * The candidate closest to the target tone among those clearing every floor.
 *
 * Chroma is weighted three times as heavily as lightness: a hue that has to sit a
 * little lighter still belongs to the family, one that has to give up half its
 * saturation does not.
 */
function solve({
  hue,
  mode,
  paper,
  target,
  passes,
}: {
  readonly hue: number;
  readonly mode: Mode;
  readonly paper: Hex;
  readonly target: { readonly L: number; readonly C: number };
  readonly passes: (candidate: Hex, soft: Hex) => boolean;
}): Solved {
  const share = SHAPE.wheel.softShare[mode];
  let best: (Solved & { readonly cost: number }) | undefined;

  for (let step = 0; step < 80; step += 1) {
    const L = mode === 'dark' ? 0.5 + step * 0.006 : 0.72 - step * 0.006;
    if (L <= 0.02 || L >= 0.99) continue;

    for (let C = 0.02; C <= 0.32; C += 0.002) {
      if (!inGamut(L, C, hue)) break;
      const value = fromOklch(L, C, hue);
      const soft = mix(value, share, paper);
      if (!passes(value, soft)) continue;

      const cost = Math.abs(L - target.L) + 3 * Math.abs(C - target.C);
      if (!best || cost < best.cost) best = { value, soft, cost };
    }
  }

  if (!best) throw new Error(`no solution for hue ${hue} in ${mode}`);
  return { value: best.value, soft: best.soft };
}

// ------------------------------------------------------------ a whole new palette

interface Spec {
  readonly name: string;
  /** Hue angle of the neutrals' cast, and how much of it there is. */
  readonly neutral: number;
  readonly neutralChroma: number;
  readonly accent: number;
  readonly highlight: number;
  /** Where the categorical wheel starts. */
  readonly wheel: number;
}

function palette(spec: Spec, mode: Mode): string {
  const cast = spec.neutralChroma;
  const ink =
    mode === 'dark'
      ? fromOklch(0.99, cast * 0.3, spec.neutral)
      : fromOklch(0.09, cast * 0.5, spec.neutral);
  const paper =
    mode === 'dark'
      ? fromOklch(0.13, cast * 0.6, spec.neutral)
      : fromOklch(0.995, cast * 0.35, spec.neutral);

  const grounds = groundsFor(ink, paper, mode);
  const neutral = (role: string) =>
    mix(ink, SHAPE.normal[mode][role as keyof (typeof SHAPE.normal)[Mode]]! / 100, paper);

  /** A hue used as text on every ground, whose own tint must carry text too. */
  const meaning = (hue: number, isAccent = false) =>
    solve({
      hue,
      mode,
      paper,
      target: SHAPE.target.meaning[mode],
      passes: (candidate, soft) =>
        clears([
          ...grounds.backgrounds.map((ground): Check => [ground, SHAPE.floor.text]),
          ...(isAccent ? grounds.tracks.map((track): Check => [track, SHAPE.floor.nonText]) : []),
          [soft, SHAPE.floor.text],
        ])(candidate) && grounds.texts.every((text) => contrast(text, soft) >= SHAPE.floor.text),
    });

  const accent = meaning(spec.accent, true);
  const highlight = meaning(spec.highlight);
  const success = meaning(SHAPE.verdict.success);
  const danger = meaning(SHAPE.verdict.danger);

  const wheel = Array.from({ length: SHAPE.wheel.count }, (_, index) =>
    solve({
      hue: (spec.wheel + (index * 360) / SHAPE.wheel.count) % 360,
      mode,
      paper,
      target: SHAPE.target.wheel[mode],
      passes: (candidate, soft) =>
        clears([
          ...grounds.surfaces.map((surface): Check => [surface, SHAPE.floor.text]),
          [soft, SHAPE.floor.text],
        ])(candidate) && grounds.texts.every((text) => contrast(text, soft) >= SHAPE.floor.text),
    }),
  );

  const softPercent = SHAPE.wheel.softShare[mode] * 100;
  const shadowInk = channelList(mode === 'dark' ? '#000000' : neutral('text'));
  const accentInk = channelList(accent.value);
  const dark = mode === 'dark';

  return `${selectorFor(spec.name, mode)} {
  color-scheme: ${mode};

  --color-ink: ${ink};
  --color-paper: ${paper};

${NEUTRAL_ROLES.map((role) => `  --color-${role}: ${neutral(role)};`).join('\n')}

  --color-accent: ${accent.value};
  --color-accent-contrast: ${dark ? mix(accent.value, 0.18, paper) : paper};
  --color-accent-soft: ${accent.soft};
  --color-accent-edge: ${dark ? mix(accent.value, 0.62, paper) : mix(accent.value, 0.72, ink)};
  --color-highlight: ${highlight.value};
  --color-highlight-soft: ${highlight.soft};
  --color-success: ${success.value};
  --color-success-soft: ${success.soft};
  --color-danger: ${danger.value};
  --color-danger-soft: ${danger.soft};

${wheel
  .map(
    (solved, index) =>
      `  --color-kind-${index + 1}: ${solved.value};\n  --color-kind-${index + 1}-soft: color-mix(in srgb, var(--color-kind-${index + 1}) ${softPercent}%, var(--color-paper));`,
  )
  .join('\n')}

  --shadow-sm: 0 1px 2px rgb(${shadowInk} / ${dark ? '40%' : '6%'});
  --shadow-md: 0 ${dark ? '8px 24px' : '6px 18px'} rgb(${shadowInk} / ${dark ? '35%' : '8%'});
  --shadow-lg: 0 -8px 48px rgb(${shadowInk} / ${dark ? '55%' : '18%'});
  --shadow-inset: inset 0 1px 2px rgb(${shadowInk} / ${dark ? '30%' : '8%'});
  --shadow-accent: 0 6px 20px rgb(${accentInk} / ${dark ? '22%' : '24%'});

  --backdrop: rgb(${shadowInk} / ${dark ? '55%' : '40%'});
}
`;
}

const channelList = (hex: Hex) => channelsOf(hex).join(' ');
const channelsOf = (hex: Hex) => {
  const digits = hex.replace('#', '');
  return [0, 2, 4].map((index) => parseInt(digits.slice(index, index + 2), 16));
};

/**
 * The selectors a palette block needs, and why there are three.
 *
 * The bare `[data-theme]` one is what makes a palette work before the pre-paint
 * script has run; the descendant one is what lets a settings swatch *preview* a
 * palette while another is active, by declaring that palette's roles on itself.
 */
function selectorFor(name: string, mode: Mode): string {
  return [
    `[data-theme='${mode}'][data-palette='${name}']`,
    `[data-theme='${mode}'] [data-palette='${name}']`,
  ].join(',\n');
}

// ---------------------------------------------------------------- the intensities

/**
 * One chroma factor for all four meanings, walked back until they stay apart.
 *
 * Per-palette rather than per-role, because the constraint is *pairwise*: scaling
 * one role until it clears its neighbours only moves the problem to the neighbour.
 *
 * The separation floor is why this exists at all. Pushing chroma towards the sRGB
 * gamut edge makes two hues *converge*, because both clip — a vivid Indigo put its
 * amber highlight 0.061 from its red danger where the authored palette had them
 * 0.079 apart, which passed every contrast floor and would have made the primary
 * action and the wrong-answer verdict the same colour.
 */
function meaningFactor(
  tokens: Record<string, string>,
  wanted: number,
  checksFor: (role: string) => readonly Check[],
): number {
  for (let step = 0; step <= 32; step += 1) {
    const factor = wanted + ((1 - wanted) * step) / 32;
    const scaled: Hex[] = [];
    let legible = true;

    for (const role of MEANING_ROLES) {
      const authored = tokens[`--color-${role}`];
      if (!authored?.startsWith('#')) continue;
      const candidate = scaleChroma(authored, factor);
      /*
       * The role's own tint is part of the constraint, not something to fix
       * afterwards. Scaling chroma preserves OKLab lightness but not WCAG
       * luminance, so a hue and its tint drift *towards* each other as both are
       * pushed — and no amount of rescaling the tint recovers it, because the
       * pairing is a lightness comparison and lightness is what did not move.
       * Checking against the authored tint is the conservative form: it is where
       * `safeScale` bottoms out, so a factor that clears it is a factor the tint
       * can be solved for.
       */
      const softAuthored = tokens[`--color-${role}-soft`];
      const withSoft: readonly Check[] = softAuthored?.startsWith('#')
        ? [...checksFor(role), [softAuthored, SHAPE.floor.text] as Check]
        : checksFor(role);
      if (!clears(withSoft)(candidate)) {
        legible = false;
        break;
      }
      scaled.push(candidate);
    }
    if (!legible) continue;

    const apart = scaled.every((a, x) =>
      scaled.every((b, y) => x >= y || chromaDistance(a, b) >= SHAPE.floor.meaning),
    );
    if (apart) return factor;
  }

  return 1;
}

/** The strongest scaling of one role that still clears every floor it is held to. */
function safeScale(value: Hex, wanted: number, passes: (candidate: Hex) => boolean): Hex {
  for (let step = 0; step <= 32; step += 1) {
    const candidate = scaleChroma(value, wanted + ((1 - wanted) * step) / 32);
    if (passes(candidate)) return candidate;
  }
  return value;
}

/**
 * Appends the `calm` and `vivid` blocks to one palette file.
 *
 * Idempotent: any existing intensity blocks are stripped first, so this can be
 * re-run after editing a palette by hand without stacking duplicates.
 */
function writeIntensities(file: string): void {
  const [name, mode] = file.replace('.css', '').split('-') as [string, Mode];
  const path = resolve(THEME_DIR, file);
  const existing = readFileSync(path, 'utf8');
  const base = stripIntensityBlocks(existing);

  // The authored palette, not the file: see `declarationsFrom`.
  const tokens = declarationsFrom(base);
  const ink = tokens['--color-ink']!;
  const paper = tokens['--color-paper']!;
  const grounds = groundsFor(ink, paper, mode);
  const share = SHAPE.wheel.softShare[mode];

  let css = base;

  for (const [intensity, wanted] of Object.entries(SHAPE.intensity)) {
    const checksFor = (role: string): readonly Check[] => [
      ...grounds.backgrounds.map((ground): Check => [ground, SHAPE.floor.text]),
      ...(role === 'accent'
        ? grounds.tracks.map((track): Check => [track, SHAPE.floor.nonText])
        : []),
    ];
    const factor = meaningFactor(tokens, wanted, checksFor);
    const lines: string[] = [];

    for (const role of MEANING_ROLES) {
      const authored = tokens[`--color-${role}`];
      if (!authored?.startsWith('#')) continue;
      const value = scaleChroma(authored, factor);
      lines.push(`  --color-${role}: ${value};`);

      const softAuthored = tokens[`--color-${role}-soft`];
      if (!softAuthored?.startsWith('#')) continue;
      lines.push(
        `  --color-${role}-soft: ${safeScale(
          softAuthored,
          factor,
          clears([
            [value, SHAPE.floor.text],
            ...grounds.texts.map((text): Check => [text, SHAPE.floor.text]),
          ]),
        )};`,
      );
    }

    const edge = tokens['--color-accent-edge'];
    if (edge?.startsWith('#')) lines.push(`  --color-accent-edge: ${scaleChroma(edge, factor)};`);

    for (let hue = 1; hue <= SHAPE.wheel.count; hue += 1) {
      const authored = tokens[`--color-kind-${hue}`];
      if (!authored?.startsWith('#')) continue;
      /*
       * The tint is checked against the *candidate*, not the authored hue's tint:
       * `-soft` is a `color-mix` of this very role, so scaling the hue moves the
       * tint with it. Comparing a scaled hue to an unscaled tint is how a vivid
       * badge shipped at 4.48:1 once.
       */
      lines.push(
        `  --color-kind-${hue}: ${safeScale(authored, wanted, (candidate) => {
          const soft = mix(candidate, share, paper);
          return (
            grounds.surfaces.every((s) => contrast(candidate, s) >= SHAPE.floor.text) &&
            contrast(candidate, soft) >= SHAPE.floor.text &&
            grounds.texts.every((text) => contrast(text, soft) >= SHAPE.floor.text)
          );
        })};`,
      );
    }

    css += `\n${INTENSITY_MARKER}\n${intensitySelector(name, mode, intensity)} {\n${lines.join('\n')}\n}\n`;
  }

  writeFileSync(path, css);
}

/** Marks a generated block, so re-running can find and replace its own output. */
const INTENSITY_MARKER = '/* generated: intensity — npm run build:palette -- intensity */';

function stripIntensityBlocks(css: string): string {
  const marker = css.indexOf(INTENSITY_MARKER);
  return marker === -1 ? css.trimEnd() + '\n' : css.slice(0, marker).trimEnd() + '\n';
}

function intensitySelector(name: string, mode: Mode, intensity: string): string {
  const isDefault = name === 'indigo';
  return [
    ...(isDefault ? [`[data-theme='${mode}'][data-intensity='${intensity}']`] : []),
    `[data-theme='${mode}'][data-palette='${name}'][data-intensity='${intensity}']`,
    `[data-theme='${mode}'] [data-palette='${name}'][data-intensity='${intensity}']`,
  ].join(',\n');
}

// ------------------------------------------------------------------------- CLI

function flag(name: string, fallback?: number): number {
  const index = process.argv.indexOf(`--${name}`);
  const value = index === -1 ? undefined : Number(process.argv[index + 1]);
  if (value === undefined || Number.isNaN(value)) {
    if (fallback !== undefined) return fallback;
    throw new Error(`--${name} <degrees> is required`);
  }
  return value;
}

const command = process.argv[2];

if (command === 'new') {
  const name = process.argv[3];
  if (!name) throw new Error('usage: build:palette -- new <name> --neutral <deg> --accent <deg> …');

  const spec: Spec = {
    name,
    neutral: flag('neutral'),
    neutralChroma: flag('cast', 0.02),
    accent: flag('accent'),
    highlight: flag('highlight'),
    wheel: flag('wheel', 200),
  };

  for (const mode of ['dark', 'light'] as const) {
    const header = `/**
 * ${name[0]!.toUpperCase()}${name.slice(1)}, ${mode}.
 *
 * Generated by \`npm run build:palette\`. The neutrals are positions on this
 * palette's own ink→paper line; every hue is the candidate closest to the family's
 * target tone among those clearing WCAG AA against every ground the four contrast
 * levels can produce. Each \`-soft\` is a mix of its own hue with \`paper\`, which no
 * contrast level may touch — so a tint cannot drift from the hue it belongs to.
 *
 * The role list, and why there are exactly these, is documented in
 * \`indigo-dark.css\`. Contrast is asserted in \`tests/a11y/contrast.test.ts\`.
 */

`;
    writeFileSync(resolve(THEME_DIR, `${name}-${mode}.css`), header + palette(spec, mode));
    console.log(`wrote ${name}-${mode}.css`);
  }

  for (const mode of ['dark', 'light'] as const) writeIntensities(`${name}-${mode}.css`);
  console.log(
    `\nNow: import both files in src/styles/global.css and add '${name}' to PALETTES and\n` +
      `PALETTE_OPTIONS in src/styles/themes.ts, then run: npx vitest run tests/a11y/contrast.test.ts`,
  );
} else if (command === 'intensity') {
  for (const file of readdirSync(THEME_DIR)
    .filter((name) => name.endsWith('.css'))
    .sort()) {
    writeIntensities(file);
    console.log(`refreshed calm + vivid in ${file}`);
  }
} else {
  console.error(
    'usage:\n' +
      '  npm run build:palette -- new <name> --neutral <deg> --accent <deg> --highlight <deg> [--wheel <deg>] [--cast <chroma>]\n' +
      '  npm run build:palette -- intensity',
  );
  process.exitCode = 1;
}
