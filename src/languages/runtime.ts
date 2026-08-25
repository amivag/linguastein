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
