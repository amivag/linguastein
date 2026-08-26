/**
 * What the dataset build needs to know about a language, and nothing else.
 *
 * `scripts/build-dataset.ts` was `core-es`'s build rather than a build: it
 * imported `conjugate`, `pluralOf`, `adjectiveForms`, `spellCardinal` and
 * `isLetterName` directly and called them unconditionally, so a language whose
 * module did not exist could not be built at all. Roughly four fifths of that
 * file — ids, the ledger, topics, skills, passages, review, duplicate text, file
 * naming, manifest assembly — never had an opinion about Spanish. This interface
 * is the line between the two halves.
 *
 * **Every capability is optional, and absence is the point.** A language with no
 * generated verb paradigms says so by having no {@link LanguageModule.verbs},
 * and the build skips that step rather than being handed a stub that returns
 * nothing. That is also what stops a half-added language looking finished:
 * building a language whose module declares nothing produces a pack of sentences
 * and no forms, which is honest, instead of crashing inside `conjugate`.
 *
 * This is the **build-time** half only. Greek and Chinese need a runtime half
 * too — segmentation, normalisation, letter bucketing, collation — because
 * `speech.ts`, `ItemFilter.search` and `initialLetter` already ask those
 * questions of every language. See `docs/tasks/language-matrix.md` §6; keeping
 * both halves under one `src/languages/<tag>/` is what stops one being added
 * without the other.
 */

import type { Morphology } from '../domain/content/annotation';
import type { LanguageTag } from '../domain/content/language';

/**
 * One generated inflected form.
 *
 * `level` and `regions` are optional because the two generators differ in what
 * they know: a verb's tense decides its level and `vosotros` is Spain-only, so
 * the conjugator supplies both, while an adjective's agreement forms inherit the
 * level of the row that declared the adjective. Requiring `level` here would
 * have meant inventing one for every adjective.
 */
export interface GeneratedForm {
  readonly form: string;
  /**
   * `Morphology` rather than an open record, because it is the app's own
   * language-neutral inventory and both generators already return it. An open
   * record would have pushed a cast into every caller and lost the one guarantee
   * worth having here: that `gender` and `number` mean what the model says.
   */
  readonly morph: Morphology;
  readonly level?: string;
  readonly regions?: readonly LanguageTag[];
}

export interface VerbSupport {
  /**
   * Every form of a lemma. The irregularity table is the module's own business —
   * the build passes a lemma and takes what it is given, where it used to reach
   * into `IRREGULAR_VERBS` itself to build the argument.
   */
  conjugate(lemma: string): readonly GeneratedForm[];
  /**
   * Whether the module declares this lemma irregular, so the build can check the
   * source's own `regularity` column against it in both directions.
   *
   * Both directions matter and one is easy to forget: a verb declared irregular
   * with no entry ships `teno` for `tengo`, and a verb declared regular *with*
   * an entry means the column is lying about something the module already knows.
   */
  isDeclaredIrregular(lemma: string): boolean;
}

export interface NominalSupport {
  /** The plural of a noun, where the module derives one. */
  pluralOf?(lemma: string): string;
  /** Agreement forms of an adjective — gender and number, where a language has them. */
  adjectiveForms?(lemma: string): readonly GeneratedForm[];
  /**
   * Agreement forms of a closed-class word: an article, a demonstrative, a
   * possessive, a quantifier, a pronoun with more than one shape.
   *
   * Separate from `adjectiveForms` because the membership is a list rather than a
   * rule — a language knows which of its function words inflect, and no ending
   * predicts it (`este`/`estos`, `el`/`los`). Empty for a lemma that does not
   * inflect, which is most of the class, and absent entirely in a language whose
   * function words are invariable.
   */
  closedClassForms?(lemma: string): readonly GeneratedForm[];
}

/** A numeral rule as something a learner can practise. */
export interface NumeralSkill {
  readonly rule: string;
  readonly label: string;
  readonly gloss: string;
  readonly level: string;
}

export interface NumeralSupport {
  /**
   * The rules, each with the label and gloss its skill is shown under.
   *
   * One list rather than a rule list plus a lookup table beside it. The build
   * kept those in step with a `Record<NumeralRule, …>`, so a rule with no label
   * failed the typecheck — a real guarantee, but one that only worked while
   * there was a single language's rules to key on. Pairing them in one record
   * keeps the property without the exhaustive type.
   */
  readonly skills: readonly NumeralSkill[];
  /** The number a citation form spells, or null when it is not a numeral. */
  parseCardinal(text: string): number | null;
  spellCardinal(value: number): string;
  parseOrdinal(text: string): number | null;
  spellOrdinal(value: number, options?: { readonly beforeNoun?: boolean }): string;
}

export interface AlphabetSupport {
  /** Whether a word is the *name* of a letter — `eñe`, `i griega`. */
  isLetterName(word: string): boolean;
}

export interface LanguageModule {
  readonly tag: LanguageTag;
  readonly verbs?: VerbSupport;
  readonly nominals?: NominalSupport;
  readonly numerals?: NumeralSupport;
  readonly alphabet?: AlphabetSupport;
  /**
   * Regions an address form is confined to: Spanish `vosotros` is Spain only.
   *
   * Here rather than in the build because it is a fact about the language and
   * not about the schema — German's `ihr` is used everywhere German is, so a
   * German module simply does not implement this.
   */
  regionsForAddress?(address: string): readonly LanguageTag[];
}
