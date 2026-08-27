/**
 * The **runtime** half of a language module, and its first capability.
 *
 * [`types.ts`](./types.ts) is the half the dataset build asks for — conjugation,
 * plurals, numerals, the letter-name check. This is the half a *screen* asks
 * for, which `docs/tasks/language-matrix.md` §6 has briefed since before there
 * was anything in it: segmentation, normalisation, collation and — here — the
 * alphabet as something a learner reads rather than something the build checks
 * a row against.
 *
 * The two halves are separate files rather than one interface for a reason the
 * build already had. `languageModule('es')` pulls in the conjugator, the
 * irregularity table and the numeral speller, which together are seven times the
 * size of the alphabet and of no use to anybody reading a chart of letters. So
 * the registry below loads `es/alphabet.ts` alone.
 *
 * It returns a **loader** rather than a promise, and that is the whole design of
 * it. "Does this language have an alphabet chart?" is answered synchronously, off
 * the same `switch` that knows how to load one — so Study can decide whether the
 * section exists while it is deciding every other section, with no second list to
 * fall out of step and no tab that appears a frame late. The data itself still
 * arrives in its own chunk, only for the learner who opens it.
 */

import { baseLanguage, type LanguageTag } from '../domain/content/language';
import { SPANISH_ADDRESS_FORMS } from './es/address';
import type { AddressFormSpec } from './types';

/** A word that shows a letter doing its job, and what it means. */
export interface LetterExample {
  readonly word: string;
  readonly gloss: string;
}

/**
 * One row of the chart: a letter, a pair that spells one sound, or a written
 * mark.
 *
 * `name` and `say` are optional because the three kinds differ in whether they
 * have one. Every letter is called something — `eñe`, `i griega` — and so is
 * `ch`; `qu` and `gu` are spelling rules rather than things with names, and
 * inventing one for them would teach a learner to say something no speaker says.
 * {@link Letter} narrows both back to required, so the alphabet proper cannot
 * lose a name by accident.
 */
export interface AlphabetEntry {
  /** Lower case, as the language writes it: `a`, `ñ`, `ch`, `ü`. */
  readonly letter: string;
  /** What it is called in the language being learned. */
  readonly name?: string;
  /**
   * That name respelled for a reader of the reference language, because a chart
   * is read in silence at least as often as it is played. Stress in capitals.
   */
  readonly say?: string;
  /** What it sounds like *inside a word*, which is not what it is called. */
  readonly sound: string;
  readonly examples: readonly LetterExample[];
  /** Names in wide use that are not the standard one, with where they are used. */
  readonly also?: readonly { readonly name: string; readonly regions: readonly LanguageTag[] }[];
  /**
   * Where the letter does something a learner would not predict: a silent
   * partner, a sound that changes with the vowel after it, a regional split.
   */
  readonly notes?: readonly string[];
}

/** An entry that is a letter of the alphabet, so it has a name. */
export interface Letter extends AlphabetEntry {
  readonly name: string;
  readonly say: string;
}

/**
 * A language's alphabet as a learner meets it.
 *
 * Three lists rather than one, because a learner asking "how many letters are
 * there" is owed a straight answer: `ch` and `ll` spell one sound each and are
 * not letters, and an accent is not a letter at all. Merging them would make the
 * chart lie about its own length.
 */
export interface AlphabetGuide {
  readonly tag: LanguageTag;
  readonly letters: readonly Letter[];
  /** Two letters that spell one sound: `ch`, `ll`, `rr`, `qu`, `gu`. */
  readonly digraphs: readonly AlphabetEntry[];
  /** Written marks that are not letters: the accent, the diaeresis. */
  readonly marks: readonly AlphabetEntry[];
}

export type AlphabetGuideLoader = () => Promise<AlphabetGuide>;

/**
 * How to load this language's alphabet, or `undefined` where none is written
 * yet.
 *
 * Absence is an answer here exactly as it is on the build-time module: a
 * language with no chart shows no chart, rather than an empty one implying the
 * language has no letters.
 */
export function alphabetGuide(tag: LanguageTag): AlphabetGuideLoader | undefined {
  // One case per tag, as `index.ts` does it: the bundler can see the target and
  // a tag can never reach `import()` as an arbitrary path.
  switch (baseLanguage(tag)) {
    case 'es':
      return async () => (await import('./es/alphabet')).SPANISH_ALPHABET;
    default:
      return undefined;
  }
}

/**
 * How a language addresses a person, for the badge that names it.
 *
 * Statically imported rather than loaded, unlike the alphabet: four short rows
 * against a chart of thirty letters with examples and notes, and this is read
 * while rendering a list rather than when somebody opens a page.
 *
 * An empty list is the honest answer for a language that does not mark address,
 * and it is what makes {@link addressForm} able to return `undefined` — which is
 * the requirement `docs/tasks/language-matrix.md` §7 sets out: a screen must
 * render nothing rather than guess a label, because Chinese barely marks this at
 * all and a pack may carry the field regardless.
 */
export function addressForms(tag: LanguageTag | undefined): readonly AddressFormSpec[] {
  if (tag === undefined) return [];
  switch (baseLanguage(tag)) {
    case 'es':
      return SPANISH_ADDRESS_FORMS;
    default:
      return [];
  }
}

/**
 * One address form by the id a pack stored, or `undefined` where this language
 * has nothing to call it.
 *
 * `undefined` covers both halves of the same rule and neither is an error: a
 * language that does not mark address, and a value this language does not know.
 * The second is what a shipped pack read on a different course looks like, and
 * showing a raw slug in a badge would be worse than showing nothing.
 */
export function addressForm(
  tag: LanguageTag | undefined,
  id: string | undefined,
): AddressFormSpec | undefined {
  if (id === undefined) return undefined;
  return addressForms(tag).find((form) => form.id === id);
}

/**
 * Letters this language buckets in their own right rather than folding.
 *
 * A letter index folds accents, because a learner hunting for `está` looks under
 * E. Some languages have letters that *look* like an accented one and are not:
 * Spanish `Ñ` is a letter between N and O, so folding it would make the `Ñ` chip
 * list every word starting with n — which is the one thing a letter index must
 * not do. Danish and Norwegian have `Æ Ø Å`, Icelandic `Þ Ð`, and Greek has the
 * opposite problem in final sigma.
 *
 * `Ñ` was hard-coded inside `src/domain/content/alphabet.ts`, which is
 * language-neutral: `docs/tasks/language-matrix.md` §6 names it as "the same leak
 * in miniature". Upper case, because that is what the fold produces before it
 * decides whether to strip anything.
 *
 * An empty set is the answer for a language with no such letter, and for one
 * nobody has written a module for — a caller told nothing folds everything, which
 * is the collator's own rule and never wrong, only sometimes incomplete.
 */
export function standaloneLetters(tag: LanguageTag | undefined): ReadonlySet<string> {
  if (tag === undefined) return NO_LETTERS;
  switch (baseLanguage(tag)) {
    case 'es':
      return SPANISH_LETTERS;
    default:
      return NO_LETTERS;
  }
}

const NO_LETTERS: ReadonlySet<string> = new Set();
const SPANISH_LETTERS: ReadonlySet<string> = new Set(['Ñ']);

/**
 * "Correct!" in the language being learned.
 *
 * A learner practising Spanish is congratulated in Spanish. This was a table
 * inside `ExerciseView`, whose comment gave the reason — `src/languages/` "is
 * build-time morphology and deliberately never imported by the app" — and named
 * its own expiry: *when there is a second of these strings, they move somewhere
 * together*. Both halves of that have since come true. The runtime half of the
 * module exists and the app does import it, and the address-form labels are the
 * second string. So this is where a new language's copy goes.
 *
 * Still a table rather than a per-language file: it is one word each, and six of
 * these seven languages have no directory to put it in. A language that grows one
 * can move its own string there without moving the rest.
 */
export function correctnessPraise(tag: LanguageTag | undefined): string | undefined {
  return tag === undefined ? undefined : PRAISE[baseLanguage(tag)];
}

const PRAISE: Readonly<Record<string, string>> = {
  es: '\u00a1Correcto!',
  fr: 'Correct !',
  de: 'Richtig!',
  it: 'Corretto!',
  pt: 'Correto!',
  nl: 'Juist!',
  el: '\u03a3\u03c9\u03c3\u03c4\u03ac!',
};
