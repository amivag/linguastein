/**
 * The alphabet as a way into the pack: which letter a phrase files under, and
 * what order the letters themselves come in.
 *
 * Both halves live here together because they have to agree. Shown
 * `¿Tienes tiempo?` under T and then sorted above `agua`, a learner has been
 * given two different alphabets — and the two rules that decide it are the same
 * two either way: where a phrase starts, and what a diacritic counts for. They
 * are written once, so a letter index and a sort cannot disagree.
 */

import type { LanguageTag } from './language';

/** The bucket for text that starts with no letter at all: `123`, `¡!`. */
export const OTHER_INITIAL = '#';

/**
 * How a list can be ordered. `pack` is the dataset's own order, which several
 * files decide on purpose — `topics.tsv` is sorted by hand — so it is a choice
 * here rather than the absence of one.
 */
export const ITEM_SORTS = ['pack', 'az', 'za'] as const;
export type ItemSort = (typeof ITEM_SORTS)[number];

const LETTER = /\p{L}/u;
const LEADING_NON_LETTER = /^[^\p{L}\p{N}]+/u;
/** Combining accents, which fold away. Not letters — see {@link fold}. */
const ACCENTS = /\p{Mn}/gu;

/**
 * The letter a phrase files under: `Árbol` under A, `¿Qué hora es?` under Q.
 *
 * Leading punctuation is stepped over rather than filed, because `¿` is not
 * where a Spanish question starts to anyone reading it. Accents fold, since a
 * learner hunting for `está` looks under E.
 */
export function initialLetter(text: string): string {
  for (const character of text) {
    if (LETTER.test(character)) return fold(character);
  }
  return OTHER_INITIAL;
}

/**
 * Items in the order asked for. `pack` is returned untouched — copying an array
 * in order to leave it alone is how a caller loses the ability to tell whether
 * anything happened.
 *
 * The sort key drops leading punctuation for the reason {@link initialLetter}
 * steps over it: without that, `¿Tienes tiempo?` sorts above every A in a list
 * whose own index files it under T.
 */
export function sortItems<T extends { readonly text: string }>(
  items: readonly T[],
  sort: ItemSort,
  locale?: LanguageTag,
): readonly T[] {
  if (sort === 'pack') return items;
  const collator = new Intl.Collator(locale, { numeric: true });
  const direction = sort === 'za' ? -1 : 1;
  return [...items].sort((a, b) => direction * collator.compare(sortKey(a.text), sortKey(b.text)));
}

/**
 * Letters as the language collates them, {@link OTHER_INITIAL} last.
 *
 * A collator rather than a written-out alphabet: Spanish wants `Ñ` between N and
 * O, French wants none of it, and an alphabet typed into this file is one nobody
 * remembers to extend when the second pack arrives.
 */
export function byLetter(locale?: LanguageTag): (a: string, b: string) => number {
  const collator = new Intl.Collator(locale);
  return (a, b) => {
    if (a === b) return 0;
    // Not a letter, so no letter's place is the right one: it goes after all.
    if (a === OTHER_INITIAL) return 1;
    if (b === OTHER_INITIAL) return -1;
    return collator.compare(a, b);
  };
}

function sortKey(text: string): string {
  return text.replace(LEADING_NON_LETTER, '');
}

/**
 * One character, as the letter it files under.
 *
 * `Ñ` is set aside before the accents come off, because it is a letter in its
 * own right and not an n wearing a tilde: folded, it would make Ñ a chip that
 * lists every word starting with n.
 */
function fold(letter: string): string {
  const upper = letter.normalize('NFC').toUpperCase();
  if (upper === 'Ñ') return upper;
  return upper.normalize('NFD').replace(ACCENTS, '').normalize('NFC');
}
