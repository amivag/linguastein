/**
 * The closed classes that inflect: articles, demonstratives, possessives,
 * quantifiers and the pronouns with more than one form.
 *
 * These surfaces were already in the dataset — `estas`, `los`, `sus`, `cuántas`
 * are typed into the extra-surfaces column of `content/es/modifiers.tsv` so a
 * sentence using one links to its lemma. What they were not is **records**. Only
 * `adjectiveForms` produced `FormRecord`s, so `formsOf('core-es:lexeme:este')`
 * came back empty while four of its surfaces shipped, and two things that read
 * paradigms could say nothing about any of them: word inspection, which shows
 * "the paradigm around the form in front of the learner", and the cloze, whose
 * alternatives are a lexeme's own forms.
 *
 * So the paradigms move here, which is where `AGENTS.md` already says they
 * belong — *never type an agreement by hand; it comes from
 * `src/languages/<tag>/`*. Typing `estos` inside the language module is the
 * sanctioned place to type it, exactly as `irregulars.ts` is for `tengo`. The
 * build then refuses a declared surface this file already derives, the way it
 * refuses a hand-typed ordinal.
 *
 * ## What is deliberately not here
 *
 * **Spelling variants.** `quizá`/`quizás` are one word written two ways, not two
 * forms. Recording them as a paradigm would tell a learner there is a choice to
 * get right, and hand the cloze a question with two correct answers.
 *
 * **Apocopations.** `algún`, `ningún` — and `buen`, `gran`, `mal` before them —
 * are shortenings rather than agreements: `algún` is as masculine-singular as
 * `alguno`, so a paradigm list holding both would show two rows differing only
 * in a label it has no field for. They stay declared surfaces, indexed and not
 * recorded, which is the decision `build-dataset.ts` already documents for the
 * adjectives and for `primer`.
 *
 * **Anything with no agreement target.** `ellos`/`ellas` and
 * `nosotros`/`nosotras` *are* real paradigm members and are recorded, because
 * inspection should show them. Whether one of them can be *asked* is a separate
 * question and not this file's: the cloze answers it by requiring a noun in the
 * sentence whose gender and number settle the blank, which a subject pronoun
 * standing before a verb does not have.
 */

import type { Morphology } from '../../domain/content';
import { adjectiveForms, type AdjectiveForm } from './morphology';

/**
 * Lemmas whose agreement the regular `-o` rule already gets right, so the table
 * below does not restate them: `mucho`, `poco`, `todo`, `cuánto`, `nuestro`,
 * `alguno`, `ninguno`. Membership is what is declared, not the forms — a lemma
 * absent from both this set and {@link IRREGULAR} inflects for nothing, which is
 * the answer for `de`, `y`, `siempre` and most of the class.
 */
const REGULAR = new Set(['mucho', 'poco', 'todo', 'cuánto', 'nuestro', 'alguno', 'ninguno']);

/** Masculine singular, masculine plural, feminine singular, feminine plural. */
function gendered(forms: readonly [string, string, string, string]): readonly AdjectiveForm[] {
  const [masculine, masculinePlural, feminine, femininePlural] = forms;
  return [
    { form: masculine, morph: { gender: 'masculine', number: 'singular' } },
    { form: masculinePlural, morph: { gender: 'masculine', number: 'plural' } },
    { form: feminine, morph: { gender: 'feminine', number: 'singular' } },
    { form: femininePlural, morph: { gender: 'feminine', number: 'plural' } },
  ];
}

/** Number alone, for the words that do not mark gender: `mi`/`mis`. */
function counted(singular: string, plural: string): readonly AdjectiveForm[] {
  return [
    { form: singular, morph: { number: 'singular' } },
    { form: plural, morph: { number: 'plural' } },
  ];
}

/** Gender alone, for a plural-only pronoun: `nosotros`/`nosotras`. */
function genderedPlural(masculine: string, feminine: string): readonly AdjectiveForm[] {
  return [
    { form: masculine, morph: { gender: 'masculine', number: 'plural' } },
    { form: feminine, morph: { gender: 'feminine', number: 'plural' } },
  ];
}

/**
 * The paradigms no rule produces.
 *
 * Every one of these is why the table exists rather than a regex:
 * `adjectiveForms('este')` gives `estes`, `adjectiveForms('el')` gives `els`,
 * and `aquel` inflects with a doubled `l` that nothing about the citation form
 * predicts.
 */
const IRREGULAR: Readonly<Record<string, readonly AdjectiveForm[]>> = {
  // Articles. `el` and `la` are the first words a learner has to get right and
  // the last they stop getting wrong, and until now the pack could not ask.
  el: gendered(['el', 'los', 'la', 'las']),
  un: gendered(['un', 'unos', 'una', 'unas']),

  // Demonstratives — the three distances, each agreeing with its noun.
  este: gendered(['este', 'estos', 'esta', 'estas']),
  ese: gendered(['ese', 'esos', 'esa', 'esas']),
  aquel: gendered(['aquel', 'aquellos', 'aquella', 'aquellas']),

  // Possessives. Number only, and the number is the *possessed* thing's: `sus
  // libros` is one owner with several books as readily as several owners.
  mi: counted('mi', 'mis'),
  tu: counted('tu', 'tus'),
  su: counted('su', 'sus'),

  // Interrogatives that count. Their agreement is with the verb rather than with
  // a following noun — `¿Cuáles son?` — which is why they are recorded here and
  // not yet askable.
  quién: counted('quién', 'quiénes'),
  cuál: counted('cuál', 'cuáles'),

  // Subject pronouns with a feminine. Plural only: `yo` and `tú` mark neither.
  nosotros: genderedPlural('nosotros', 'nosotras'),
  vosotros: genderedPlural('vosotros', 'vosotras'),
  ellos: genderedPlural('ellos', 'ellas'),
};

export interface ClosedClassForm {
  readonly form: string;
  readonly morph: Morphology;
}

/**
 * The paradigm of a closed-class lemma, or empty where it has none.
 *
 * Empty is the common answer and is not a gap: most of the class does not
 * inflect at all, and a caller must treat "no forms" as "this word has one
 * shape" rather than as missing data.
 */
export function closedClassForms(lemma: string): readonly ClosedClassForm[] {
  const irregular = IRREGULAR[lemma];
  if (irregular) return irregular;
  return REGULAR.has(lemma) ? adjectiveForms(lemma) : [];
}
