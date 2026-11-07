/**
 * Colour maths for the palette tools: sRGB, OKLab, OKLCH and WCAG contrast.
 *
 * Pure functions over hex strings, no filesystem and no opinions about palettes.
 * It lives under `scripts/` rather than in `src/` because nothing the app ships
 * needs it: a palette is *authored* by this arithmetic and then read as flat hex,
 * which is the whole reason `tests/a11y/contrast.test.ts` can check a stylesheet
 * without running a browser.
 *
 * `contrast.test.ts` deliberately carries its own small copy of the ratio and the
 * OKLab conversion. That duplication is the point: the test is the authority on
 * whether a palette is legible, and a test that imported its arithmetic from the
 * generator would agree with the generator by construction — including when both
 * are wrong. Two implementations that disagree is a signal; one implementation
 * checking itself is not.
 */

export type Hex = string;

/** sRGB transfer functions, in both directions. */
const encode = (channel: number): number =>
  channel <= 0.0031308 ? 12.92 * channel : 1.055 * Math.pow(channel, 1 / 2.4) - 0.055;
const decode = (channel: number): number =>
  channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);

export function channels(hex: Hex): readonly [number, number, number] {
  const digits = hex.replace('#', '');
  const full =
    digits.length === 3 ? [...digits].map((digit) => `${digit}${digit}`).join('') : digits;
  const [r, g, b] = [0, 2, 4].map((index) => parseInt(full.slice(index, index + 2), 16));
  return [r!, g!, b!];
}

export function toHex(rgb: readonly [number, number, number]): Hex {
  return `#${rgb
    .map((value) =>
      Math.round(Math.min(255, Math.max(0, value)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

/** Relative luminance (WCAG 2.x). */
export function luminance(hex: Hex): number {
  const [r, g, b] = channels(hex).map((value) => decode(value / 255));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

export function contrast(a: Hex, b: Hex): number {
  const first = luminance(a);
  const second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

/**
 * `color-mix(in srgb, a <share>%, b)` — a plain per-channel interpolation of the
 * gamma-encoded values, which is what the browser does and every colour in this
 * app being opaque is what makes it that simple.
 */
export function mix(a: Hex, share: number, b: Hex): Hex {
  const first = channels(a);
  const second = channels(b);
  return toHex([
    first[0] * share + second[0] * (1 - share),
    first[1] * share + second[1] * (1 - share),
    first[2] * share + second[2] * (1 - share),
  ]);
}

export type Oklab = readonly [number, number, number];

export function toOklab(hex: Hex): Oklab {
  const [r, g, b] = channels(hex).map((value) => decode(value / 255));
  const l = Math.cbrt(0.4122214708 * r! + 0.5363325363 * g! + 0.0514459929 * b!);
  const m = Math.cbrt(0.2119034982 * r! + 0.6806995451 * g! + 0.1073969566 * b!);
  const s = Math.cbrt(0.0883024619 * r! + 0.2817188376 * g! + 0.6299787005 * b!);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** Linear-light sRGB, unclamped — so a caller can ask whether it is in gamut. */
function oklabToLinear([L, a, b]: Oklab): readonly [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

export function fromOklab(lab: Oklab): Hex {
  const linear = oklabToLinear(lab);
  return toHex([
    encode(Math.min(1, Math.max(0, linear[0]))) * 255,
    encode(Math.min(1, Math.max(0, linear[1]))) * 255,
    encode(Math.min(1, Math.max(0, linear[2]))) * 255,
  ]);
}

/**
 * Whether an OKLCH triple has an sRGB representation at all.
 *
 * Asked rather than clamped, because clamping silently changes the hue: an
 * out-of-gamut blue clamps to a different blue, and a search that accepted it
 * would report a chroma it did not deliver.
 */
export function inGamut(L: number, C: number, hue: number): boolean {
  const radians = (hue * Math.PI) / 180;
  const linear = oklabToLinear([L, C * Math.cos(radians), C * Math.sin(radians)]);
  return linear.every((value) => value >= -0.0005 && value <= 1.0005);
}

export function fromOklch(L: number, C: number, hue: number): Hex {
  const radians = (hue * Math.PI) / 180;
  return fromOklab([L, C * Math.cos(radians), C * Math.sin(radians)]);
}

/** The same colour with its chroma scaled; lightness and hue untouched. */
export function scaleChroma(hex: Hex, factor: number): Hex {
  const [L, a, b] = toOklab(hex);
  return fromOklab([L, a * factor, b * factor]);
}

/**
 * How far apart two colours are in hue and chroma, ignoring lightness.
 *
 * Lightness is excluded on purpose: it is the contrast axis's variable, so two
 * roles differing only in it are the *same colour* at two brightnesses — which is
 * exactly the confusion `--color-accent` and `--color-danger` must not create.
 * A WCAG ratio cannot see this, because it is a lightness comparison.
 */
export function chromaDistance(a: Hex, b: Hex): number {
  const first = toOklab(a);
  const second = toOklab(b);
  return Math.hypot(first[1] - second[1], first[2] - second[2]);
}
