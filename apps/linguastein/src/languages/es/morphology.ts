/**
 * Spanish noun and adjective forms.
 *
 * Derived rather than authored, for the same reason as the verb forms: the
 * rules are short and testable, and they keep `cansada` in a sentence linked
 * to the lexeme `cansado`.
 */

import type { Morphology } from '../../domain/content';

const VOWELS = /[aeiouáéíóú]$/;
const STRESSED_FINAL = /[áéíóú]$/;

/**
 * Regular plural: vowel → +s, consonant → +es, -z → -ces. Irregular plurals
 * (examen → exámenes) are declared in the dataset source instead.
 */
export function pluralOf(noun: string): string {
  const lower = noun.toLowerCase();
  if (lower.endsWith('z')) return `${noun.slice(0, -1)}ces`;
  if (STRESSED_FINAL.test(lower)) return `${noun}s`;
  if (VOWELS.test(lower)) return `${noun}s`;
  // canción → canciones, autobús → autobuses: the written accent disappears
  // once the extra syllable moves the stress.
  return `${dropFinalAccent(noun)}es`;
}

/**
 * Drops the written accent only when it sits on the *last* vowel, i.e. when it
 * marked final-syllable stress that the extra plural syllable makes redundant:
 * canción → canciones, autobús → autobuses. A word stressed earlier keeps it —
 * árbol → árboles, not arboles.
 */
function dropFinalAccent(word: string): string {
  const accents: Record<string, string> = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u' };
  const characters = [...word];
  const lastVowel = characters.findLastIndex((character) => /[aeiouáéíóú]/.test(character));
  const vowel = characters[lastVowel];
  if (lastVowel === -1 || vowel === undefined || !(vowel in accents)) return word;
  return word.slice(0, lastVowel) + accents[vowel] + word.slice(lastVowel + 1);
}

export interface AdjectiveForm {
  readonly form: string;
  readonly morph: Morphology;
}

/**
 * The agreement forms: four where the adjective inflects for gender, two where
 * it does not (grande/grandes, feliz/felices).
 *
 * An invariable adjective's forms carry **no** gender, rather than being labelled
 * masculine by default. `grande` is as feminine as it is masculine, and the
 * label is read by a learner: describing `una casa grande` as masculine teaches
 * the opposite of the agreement rule the word is there to illustrate. It also
 * keeps the surface index honest, since it is these morphs that a sentence token
 * inherits.
 */
export function adjectiveForms(adjective: string): readonly AdjectiveForm[] {
  const masculine = adjective;
  const feminine = adjective.endsWith('o') ? `${adjective.slice(0, -1)}a` : adjective;
  const invariable = feminine === masculine;

  const forms: AdjectiveForm[] = [
    {
      form: masculine,
      morph: invariable ? { number: 'singular' } : { gender: 'masculine', number: 'singular' },
    },
    {
      form: pluralOf(masculine),
      morph: invariable ? { number: 'plural' } : { gender: 'masculine', number: 'plural' },
    },
  ];

  if (!invariable) {
    forms.push(
      { form: feminine, morph: { gender: 'feminine', number: 'singular' } },
      { form: pluralOf(feminine), morph: { gender: 'feminine', number: 'plural' } },
    );
  }

  return forms;
}
