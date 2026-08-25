/**
 * Spanish as a {@link LanguageModule}: the adapter, not the linguistics.
 *
 * Every function here forwards to the module that already owned the fact —
 * `conjugation.ts`, `morphology.ts`, `numerals.ts`, `alphabet.ts` — so this file
 * holds no rule of its own and cannot drift from them. What it does hold is the
 * *shape* the build asks in, and two things that used to live in the build
 * script because there was nowhere else to put them: the irregularity table
 * being the conjugator's business rather than the caller's, and the numeral
 * skills' labels.
 */

import type { GeneratedForm, LanguageModule } from '../types';
import { conjugate as conjugateEs } from './conjugation';
import { IRREGULAR_VERBS, isDeclaredIrregular } from './irregulars';
import { isLetterName } from './alphabet';
import { adjectiveForms as adjectiveFormsEs, pluralOf } from './morphology';
import {
  parseCardinal,
  parseOrdinal,
  spellCardinal,
  spellOrdinal,
  type NumeralRule,
} from './numerals';

/**
 * The numeral rules as practisable skills.
 *
 * Typed `Record<NumeralRule, …>` on the way in and flattened to a list on the
 * way out, which keeps the guarantee the build's own table had — adding a rule
 * to `numerals.ts` without giving it a label fails the typecheck, before the
 * build ever runs — while handing the interface a list it can hold for any
 * language.
 */
const NUMERAL_SKILLS: Record<NumeralRule, { label: string; gloss: string; level: string }> = {
  teens: {
    label: 'dieciséis, diecisiete…',
    gloss: 'the teens, written as one word',
    level: 'a1',
  },
  twenties: {
    label: 'veintiuno, veintidós…',
    gloss: 'the twenties, written as one word',
    level: 'a1',
  },
  'y-joining': {
    label: 'treinta y uno / ciento uno',
    gloss: 'y joins tens to units, and never hundreds to tens',
    level: 'a1',
  },
  apocopation: {
    label: 'veintiún libros',
    gloss: 'uno shortens to un before a masculine noun',
    level: 'a2',
  },
  'hundreds-agreement': {
    label: 'doscientas casas',
    gloss: 'the hundreds agree in gender',
    level: 'a2',
  },
  'cien-ciento': {
    label: 'cien mil / ciento treinta',
    gloss: 'cien alone, ciento in a compound',
    level: 'a2',
  },
  'mil-millon': {
    label: 'mil / un millón de',
    gloss: 'a thousand is never un mil; a million is a noun',
    level: 'a2',
  },
};

export const spanish: LanguageModule = {
  tag: 'es',

  verbs: {
    conjugate: (lemma) =>
      conjugateEs(lemma, IRREGULAR_VERBS[lemma] ?? {}).map((generated): GeneratedForm => ({
        form: generated.form,
        morph: generated.morph,
        level: generated.level,
        ...(generated.regions ? { regions: generated.regions } : {}),
      })),
    // `irregulars.ts` already exported this, with a comment describing the
    // build's cross-check as its reason for existing — and the build did the
    // `Object.hasOwn` itself, so the function it was written for never called it.
    isDeclaredIrregular,
  },

  nominals: {
    pluralOf,
    adjectiveForms: (lemma) =>
      adjectiveFormsEs(lemma).map((entry): GeneratedForm => ({
        form: entry.form,
        morph: entry.morph,
      })),
  },

  numerals: {
    skills: (Object.keys(NUMERAL_SKILLS) as NumeralRule[]).map((rule) => ({
      rule,
      ...NUMERAL_SKILLS[rule],
    })),
    parseCardinal,
    // The build spells a citation form, which takes no agreement: `spellCardinal`
    // is what checks an authored `NUM` row, and a row is the lemma.
    spellCardinal: (value) => spellCardinal(value),
    parseOrdinal,
    spellOrdinal: (value, options) =>
      spellOrdinal(value, options?.beforeNoun ? { beforeNoun: true } : {}),
  },

  alphabet: { isLetterName },

  /**
   * `vosotros` is Spain's. Every other address form is used wherever Spanish is,
   * so this narrows one and says nothing about the rest — which is why it
   * returns a list rather than a single region.
   */
  regionsForAddress: (address) => (address === 'vosotros' ? ['es-ES'] : []),
};
