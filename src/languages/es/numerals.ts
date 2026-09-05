/**
 * Spanish numerals.
 *
 * Numbers are generated from rules, never authored, and for a stronger reason
 * than verb forms: a learner's actual question is "how do I say 1042?", and
 * there is no number of rows that answers it. What they need is the handful of
 * rules that generate every number under a billion — `y` joins tens to units
 * but never hundreds to tens, the teens and twenties are written solid, `uno`
 * apocopates before a masculine noun, hundreds agree in gender, `cien` becomes
 * `ciento` only in compounds.
 *
 * Language-specific logic lives under `src/languages/<tag>/` so the engine in
 * `src/domain` stays language-agnostic. Used at dataset build time to seed the
 * number cards, and at runtime by the numeral drill, whose targets are generated
 * and so cannot exist in any pack.
 *
 * Briefed in `docs/tasks/numerals.md`.
 */

import type { Gender } from '../../domain/content';
import { randomInt, type Rng } from '../../utils/random';

/**
 * How the numeral is being used, which is what decides its form. `veintiún
 * libros` but `tengo veintiuno`; `doscientas casas` but `doscientos euros`.
 *
 * Defaults to a standalone masculine numeral — counting out loud, which is how
 * a number is read when nothing follows it.
 */
export interface Agreement {
  readonly gender?: Gender;
  /** True when a noun follows immediately, which is what apocopates `uno`. */
  readonly beforeNoun?: boolean;
}

/**
 * A rule a given number exercises. These are the practisable units: an attempt
 * on 1042 is evidence about `y-joining` and `mil-millon`, not about 1042, which
 * is what lets an unbounded drill record progress against stable ids at all.
 */
export const NUMERAL_RULES = [
  'teens',
  'twenties',
  'y-joining',
  'apocopation',
  'hundreds-agreement',
  'cien-ciento',
  'mil-millon',
] as const;
export type NumeralRule = (typeof NUMERAL_RULES)[number];

/** Highest number this module spells. Above it, Spanish needs `millardo`/`mil millones`. */
export const MAX_CARDINAL = 999_999_999;

// ── irreducible tables ──────────────────────────────────────────────────────
// Kept short and exhaustive on purpose: these are the forms no rule predicts,
// so they must be readable rather than trusted. Everything else composes.

const UNITS = [
  'cero',
  'uno',
  'dos',
  'tres',
  'cuatro',
  'cinco',
  'seis',
  'siete',
  'ocho',
  'nueve',
  'diez',
  'once',
  'doce',
  'trece',
  'catorce',
  'quince',
] as const;

/** 16–19. Written solid, and only `dieciséis` takes an accent. */
const TEENS = ['dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'] as const;

/** 21–29. Written solid; `veintidós`, `veintitrés` and `veintiséis` accented. */
const TWENTIES = [
  'veintiuno',
  'veintidós',
  'veintitrés',
  'veinticuatro',
  'veinticinco',
  'veintiséis',
  'veintisiete',
  'veintiocho',
  'veintinueve',
] as const;

/** Indexed by tens digit, so `TENS[3]` is 30. */
const TENS = [
  '',
  '',
  'veinte',
  'treinta',
  'cuarenta',
  'cincuenta',
  'sesenta',
  'setenta',
  'ochenta',
  'noventa',
] as const;

/**
 * Indexed by hundreds digit. `quinientos`, `setecientos` and `novecientos` are
 * the three that are not simply the unit plus `-cientos`.
 */
const HUNDREDS = [
  '',
  'ciento',
  'doscientos',
  'trescientos',
  'cuatrocientos',
  'quinientos',
  'seiscientos',
  'setecientos',
  'ochocientos',
  'novecientos',
] as const;

/** 1st–20th. `undécimo`/`duodécimo` are RAE's first forms; `décimo primero` and
 * `décimo segundo` are also accepted and deliberately not produced here, so the
 * module never has to choose between two spellings at generation time. */
const ORDINALS = [
  '',
  'primero',
  'segundo',
  'tercero',
  'cuarto',
  'quinto',
  'sexto',
  'séptimo',
  'octavo',
  'noveno',
  'décimo',
  'undécimo',
  'duodécimo',
  'decimotercero',
  'decimocuarto',
  'decimoquinto',
  'decimosexto',
  'decimoséptimo',
  'decimoctavo',
  'decimonoveno',
  'vigésimo',
] as const;

export const MAX_ORDINAL = ORDINALS.length - 1;

// ── cardinals ───────────────────────────────────────────────────────────────

/**
 * Spells a cardinal: `spellCardinal(1042)` gives `mil cuarenta y dos`.
 *
 * Throws on a number it cannot spell rather than returning a plausible wrong
 * answer — a drill that silently asks for an unspellable number would mark a
 * correct learner wrong.
 */
export function spellCardinal(value: number, agreement: Agreement = {}): string {
  if (!Number.isInteger(value)) throw new RangeError(`not an integer: ${value}`);
  if (value < 0 || value > MAX_CARDINAL) throw new RangeError(`out of range: ${value}`);

  const spelled = cardinal(value, agreement);

  // `un millón de personas`, but `un millón doscientas mil personas` — the `de`
  // appears only when the number stops at the millions, because otherwise the
  // lower part is what the noun attaches to.
  if (agreement.beforeNoun && value >= 1_000_000 && value % 1_000_000 === 0) {
    return `${spelled} de`;
  }
  return spelled;
}

/**
 * Agreement plus one thing only the composer knows: whether this numeral is
 * multiplying `mil`/`millones` rather than counting the noun.
 *
 * The distinction is real, and it is the asymmetry between the two scale words.
 * `millón` is a noun, so a numeral in front of it agrees with *it* — `doscientos
 * millones de casas`, never `doscientas`. `mil` is not a noun, so a numeral
 * reaches straight through it to what is being counted — `doscientas mil
 * personas`. Either way `uno` takes the masculine short form, because what it
 * immediately precedes is the scale word: `veintiún mil personas`.
 */
interface Context extends Agreement {
  readonly multiplier?: boolean;
}

function cardinal(value: number, agreement: Context): string {
  if (value >= 1_000_000) return millions(value, agreement);
  if (value >= 1000) return thousands(value, agreement);
  return underThousand(value, agreement);
}

function millions(value: number, agreement: Context): string {
  const count = Math.floor(value / 1_000_000);
  const rest = value % 1_000_000;
  // A million is a noun, so it is counted rather than used as a bare multiplier:
  // `un millón`, never `mil` for a thousand's `mil`. It does not agree in
  // gender — `un millón de casas`, not `una millón`.
  const head =
    count === 1
      ? 'un millón'
      : `${cardinal(count, { beforeNoun: true, multiplier: true })} millones`;
  return rest === 0 ? head : `${head} ${cardinal(rest, agreement)}`;
}

function thousands(value: number, agreement: Context): string {
  const count = Math.floor(value / 1000);
  const rest = value % 1000;
  // `mil`, never `un mil` — the one place Spanish drops the counter entirely.
  // Above one, the multiplier sits before a noun-like word and so apocopates:
  // 21,000 is `veintiún mil`.
  const head =
    count === 1
      ? 'mil'
      : `${cardinal(count, { ...agreement, beforeNoun: true, multiplier: true })} mil`;
  return rest === 0 ? head : `${head} ${underThousand(rest, agreement)}`;
}

function underThousand(value: number, agreement: Context): string {
  if (value === 100) return 'cien';
  if (value < 100) return underHundred(value, agreement);

  const digit = Math.floor(value / 100);
  const rest = value % 100;
  const head = agree(HUNDREDS[digit]!, agreement.gender);
  return rest === 0 ? head : `${head} ${underHundred(rest, agreement)}`;
}

function underHundred(value: number, agreement: Context): string {
  if (value < 16) return unit(value, agreement);
  if (value < 20) return TEENS[value - 16]!;
  if (value === 20) return 'veinte';
  if (value < 30) {
    const word = TWENTIES[value - 21]!;
    /*
     * Only `veintiuno` changes shape. The whole twenties range used to go
     * through `apocopate`, which drops the last two letters and adds an `n` —
     * so `veinticuatro mil` came out as `veinticuatn mil`, and
     * `veintidós casas` as `veintidóa casas`.
     *
     * Invisible until something asked for a number nobody had authored: the
     * build generates numeral lemmas in their citation form, where neither
     * `beforeNoun` nor a gender is set and `apocopate` returns the word
     * untouched. `tests/domain/numeral-drill.test.ts` found it by spelling and
     * re-reading every value in a range, which is the check a table of examples
     * cannot make.
     */
    return value === 21 ? apocopate(word, agreement) : word;
  }

  const tens = TENS[Math.floor(value / 10)]!;
  const rest = value % 10;
  // `y` joins tens to units and nothing else: `treinta y uno`, but `ciento uno`.
  return rest === 0 ? tens : `${tens} y ${unit(rest, agreement)}`;
}

/** `uno` is the only unit that changes shape, so the rest pass straight through. */
function unit(value: number, agreement: Context): string {
  return value === 1 ? apocopate('uno', agreement) : UNITS[value]!;
}

/**
 * `uno` → `un` before a masculine noun, `una` in the feminine.
 *
 * The masculine drop is what apocopation means here; the feminine form is a
 * plain agreement and applies whether or not a noun follows, which is why
 * `veintiuna` is right in both `tengo veintiuna` and `veintiuna casas`.
 */
function apocopate(form: string, agreement: Context): string {
  if (agreement.gender === 'feminine' && !agreement.multiplier) {
    return `${form.slice(0, -1)}a`;
  }
  if (!agreement.beforeNoun || agreement.gender === 'neuter') return form;

  const short = `${form.slice(0, -2)}n`;
  // veintiuno → veintiún: losing the syllable moves the stress onto the `u`,
  // which then has to be written. The check is on the ending rather than the
  // whole word so it still fires inside a longer number.
  return short.endsWith('veintiun') ? `${short.slice(0, -8)}veintiún` : short;
}

/**
 * Hundreds are the only multiplier that agrees: `doscientas casas`.
 *
 * Matched on `-ientos` rather than `-cientos`, because `quinientos` is `quin-` +
 * `-ientos` and the narrower test silently left it masculine.
 */
function agree(form: string, gender: Gender | undefined): string {
  if (gender !== 'feminine' || !form.endsWith('ientos')) return form;
  return `${form.slice(0, -2)}as`;
}

// ── reading a numeral back ──────────────────────────────────────────────────

/**
 * Every word that carries a value, including the agreement forms, since a
 * learner may reasonably type `veintiún` or `doscientas`. Built from the tables
 * above rather than listed again, so the two cannot disagree about a spelling.
 */
const VALUES: ReadonlyMap<string, number> = (() => {
  const values = new Map<string, number>();
  UNITS.forEach((word, value) => values.set(word, value));
  TEENS.forEach((word, index) => values.set(word, 16 + index));
  TWENTIES.forEach((word, index) => values.set(word, 21 + index));
  TENS.forEach((word, index) => word && values.set(word, index * 10));
  HUNDREDS.forEach((word, index) => word && values.set(word, index * 100));

  values.set('cien', 100);
  // Agreement forms of the two words that have them.
  values.set('un', 1);
  values.set('una', 1);
  values.set('veintiún', 21);
  values.set('veintiuna', 21);
  for (const [word, value] of [...values]) {
    if (word.endsWith('ientos')) values.set(`${word.slice(0, -2)}as`, value);
  }
  return values;
})();

/** Multipliers, largest first, which is also the only order they may appear in. */
const SCALES: readonly [word: string, factor: number][] = [
  ['millones', 1_000_000],
  ['millón', 1_000_000],
  ['mil', 1000],
];

/**
 * Reads a spelled numeral back to a number, or `null` if it is not one.
 *
 * The exact inverse of {@link spellCardinal} — a property the tests assert over
 * every integer it can spell. Needed in both directions: a drill that asks for
 * `136` has to accept what the learner typed, and one that asks what
 * `ciento treinta y seis` means has to check the digits they answered with.
 *
 * Strict about structure, because a parser that returns a number for nonsense
 * would mark a nonsense answer correct: `mil mil` is rejected rather than read
 * as two thousand.
 */
export function parseCardinal(text: string): number | null {
  const words = text
    .toLowerCase()
    .normalize('NFC')
    .split(/[\s,]+/)
    .filter((word) => word.length > 0);
  if (words.length === 0) return null;

  let total = 0;
  let group = 0;
  let counted = false;
  // Scales must descend: `mil` may follow `millón`, never the reverse, and
  // neither may repeat.
  let ceiling = Infinity;

  for (const word of words) {
    // `y` joins tens to units and carries no value of its own.
    if (word === 'y') continue;

    const scale = SCALES.find(([spelling]) => spelling === word);
    if (scale) {
      const [, factor] = scale;
      if (factor >= ceiling) return null;
      ceiling = factor;
      // A bare `mil` means one thousand: the counter Spanish leaves unsaid.
      total += (group === 0 ? 1 : group) * factor;
      group = 0;
      counted = true;
      continue;
    }

    const value = VALUES.get(word);
    if (value === undefined) return null;
    group += value;
    counted = true;
  }

  return counted ? total + group : null;
}

// ── ordinals ────────────────────────────────────────────────────────────────

/** Ordinals shortened before a masculine noun: `el primer día`, `el tercer piso`. */
const APOCOPATING_ORDINALS = /(primero|tercero)$/;

/**
 * Spells an ordinal: `spellOrdinal(3, { beforeNoun: true })` gives `tercer`.
 *
 * Stops at 20th on purpose. Beyond it Spanish speakers reach for a cardinal in
 * practice, and the higher forms are contested enough that generating one would
 * be inventing a standard rather than following it.
 */
export function spellOrdinal(value: number, agreement: Agreement = {}): string {
  if (!Number.isInteger(value)) throw new RangeError(`not an integer: ${value}`);
  if (value < 1 || value > MAX_ORDINAL) throw new RangeError(`out of range: ${value}`);

  const form = ORDINALS[value]!;
  if (agreement.gender === 'feminine') return `${form.slice(0, -1)}a`;
  if (agreement.beforeNoun && APOCOPATING_ORDINALS.test(form)) return form.slice(0, -1);
  return form;
}

/**
 * Reads an ordinal's citation form back to the number it means, or `null`.
 *
 * The inverse of {@link spellOrdinal} at its default agreement, and only there:
 * `primera` and `primer` are answers to "which form", not to "which number", so
 * they are rejected rather than folded in. That keeps this usable as the
 * round-trip check the dataset build applies to a `NUM` lemma — reading a lemma
 * and spelling the result again has to return the very same string, which is
 * what catches a hand-typed `septimo` for `séptimo`.
 */
export function parseOrdinal(text: string): number | null {
  const word = text.toLowerCase().normalize('NFC').trim();
  const value = ORDINALS.indexOf(word as (typeof ORDINALS)[number]);
  return value > 0 ? value : null;
}

// ── which rules a number exercises ──────────────────────────────────────────

/**
 * The rules a number puts to work, so an attempt can be credited to a durable
 * skill rather than to one arbitrary integer.
 *
 * Deliberately independent of {@link Agreement}: `apocopation` is reported for
 * any number that *can* apocopate, because that is what makes the number worth
 * asking — whether a given prompt puts a noun after it is the drill's choice.
 */
export function rulesFor(value: number): readonly NumeralRule[] {
  if (!Number.isInteger(value) || value < 0 || value > MAX_CARDINAL) return [];

  const rules = new Set<NumeralRule>();

  for (const [position, group] of groupsOf(value).entries()) {
    const tens = group % 100;
    if (tens >= 16 && tens <= 19) rules.add('teens');
    if (tens >= 21 && tens <= 29) rules.add('twenties');
    // 31–99 with a unit digit: the only place `y` appears.
    if (tens >= 30 && tens % 10 !== 0) rules.add('y-joining');

    const hundreds = Math.floor(group / 100);
    if (hundreds >= 2) rules.add('hundreds-agreement');
    // Covers both `cien` alone and the `ciento` of a compound, including
    // `cien mil`, since either way the group's hundreds digit is 1.
    if (hundreds === 1) rules.add('cien-ciento');

    // Per group, not per number: 21,000 ends in three zeros and still turns on
    // `veintiún`. `once` has no `uno` inside it to shorten, and the thousands
    // group of exactly one is spelled `mil` with no multiplier word at all.
    const isBareMil = position === THOUSANDS && group === 1;
    if (tens % 10 === 1 && tens !== 11 && !isBareMil) rules.add('apocopation');
  }

  if (value >= 1000) rules.add('mil-millon');

  // Registry order, so a caller listing rules gets them in a stable order
  // rather than one that depends on how the number happened to decompose.
  return NUMERAL_RULES.filter((rule) => rules.has(rule));
}

/**
 * A number that puts one rule to work, for a drill to ask.
 *
 * The inverse of {@link rulesFor}, and deliberately not its exact inverse: a
 * sample is *guaranteed* to exercise the rule asked for and is free to exercise
 * others alongside it. Spanish does not let you isolate them — `ciento treinta y
 * uno` cannot show `cien-ciento` without also showing `y-joining` — and a drill
 * that only ever asked numbers exercising exactly one rule would ask a strange,
 * narrow set of numbers no learner ever needs to say.
 *
 * Ranges are the ones a learner meets rather than the ones the module can spell:
 * prices, platforms, room numbers and years. `sampleFor('mil-millon')` will not
 * hand back 758,214,003 just because {@link MAX_CARDINAL} allows it.
 *
 * `tests/domain/numeral-drill.test.ts` asserts the guarantee across every rule
 * and many seeds, which is the only way to know a construction here has not
 * drifted from what `rulesFor` recognises.
 */
export function sampleFor(rule: NumeralRule, rng: Rng): number {
  switch (rule) {
    case 'teens':
      return 16 + randomInt(rng, 4);
    case 'twenties':
      return 21 + randomInt(rng, 9);
    // 31–99 with a unit digit, the only place `y` appears.
    case 'y-joining':
      return (3 + randomInt(rng, 7)) * 10 + 1 + randomInt(rng, 9);
    /*
     * Ends in a one that shortens. Drawn from two shapes rather than one so the
     * drill does not only ever ask `veintiuno`: a bare ...1, and a hundreds
     * number whose last group is 1.
     */
    case 'apocopation':
      return randomInt(rng, 2) === 0
        ? (2 + randomInt(rng, 8)) * 10 + 1
        : (1 + randomInt(rng, 9)) * 100 + 1;
    case 'hundreds-agreement':
      return (2 + randomInt(rng, 8)) * 100 + randomInt(rng, 100);
    // `ciento treinta`, and `cien mil` — the same hundreds digit of one, in the
    // two places it is spelled differently.
    case 'cien-ciento':
      return randomInt(rng, 4) === 0 ? 100_000 + randomInt(rng, 900) : 100 + randomInt(rng, 100);
    // A year, a price, a population. Bounded well below what the speller allows.
    case 'mil-millon':
      return randomInt(rng, 5) === 0
        ? 1_000_000 * (1 + randomInt(rng, 9))
        : 1000 + randomInt(rng, 99_000);
  }
}

/** Index into {@link groupsOf}: units are 0, so thousands are 1. */
const THOUSANDS = 1;

/**
 * The number split into the three-digit groups Spanish actually spells, least
 * significant first: 1,234,567 gives [567, 234, 1]. Each group is read on its
 * own, so each exercises the sub-thousand rules independently — `mil doscientos
 * treinta y uno` uses `y-joining` in its lower group and nothing in its upper.
 */
function groupsOf(value: number): readonly number[] {
  const groups: number[] = [];
  for (let rest = value; rest > 0; rest = Math.floor(rest / 1000)) {
    groups.push(rest % 1000);
  }
  // Zero yields no groups, which is right: `cero` is a single word that puts no
  // rule to work, and a `[0]` fallback would only be a longer way to say that.
  return groups;
}
