/**
 * The Spanish alphabet, and the names its letters are called by.
 *
 * Here rather than in the dataset for the reason the numerals are: the set is
 * closed and the spellings have to be right, so a table of rules beats
 * twenty-seven hand-typed rows that nothing checks. It also buys the thing a
 * list cannot — `spellWord` means any word is spellable out loud without
 * existing anywhere, exactly as `spellCardinal` makes 1042 askable.
 *
 * Twenty-seven letters. `ch` and `ll` are **not** among them: they were letters
 * of the alphabet until 2010 and are now two letters each, which matters because
 * a learner with an older textbook will count twenty-nine and look for `che` and
 * `elle` in a dictionary that no longer files them separately.
 */

/** A letter, its name, and the names it goes by elsewhere. */
export interface Letter {
  readonly letter: string;
  /** The name the RAE gives, which is the one this pack teaches. */
  readonly name: string;
  /**
   * Names in wide use that are not the RAE's, with the regions that use them.
   *
   * Not trivia. A learner who only knows `uve` will not recognise `ve corta`
   * from a Mexican speaker reading out a booking code, and that is precisely
   * the situation the alphabet is learned for.
   */
  readonly also?: readonly { readonly name: string; readonly regions: readonly string[] }[];
}

const LATIN_AMERICA = ['es-419'] as const;

export const ALPHABET: readonly Letter[] = [
  { letter: 'a', name: 'a' },
  {
    letter: 'b',
    name: 'be',
    also: [
      { name: 'be larga', regions: LATIN_AMERICA },
      { name: 'be grande', regions: LATIN_AMERICA },
    ],
  },
  { letter: 'c', name: 'ce' },
  { letter: 'd', name: 'de' },
  { letter: 'e', name: 'e' },
  { letter: 'f', name: 'efe' },
  { letter: 'g', name: 'ge' },
  { letter: 'h', name: 'hache' },
  { letter: 'i', name: 'i', also: [{ name: 'i latina', regions: LATIN_AMERICA }] },
  { letter: 'j', name: 'jota' },
  { letter: 'k', name: 'ka' },
  { letter: 'l', name: 'ele' },
  { letter: 'm', name: 'eme' },
  { letter: 'n', name: 'ene' },
  { letter: 'ñ', name: 'eñe' },
  { letter: 'o', name: 'o' },
  { letter: 'p', name: 'pe' },
  { letter: 'q', name: 'cu' },
  // `ere` is the single tap of `pero`, `erre` the trill of `perro`. The RAE
  // names the letter `erre` either way; `ere` survives as the name for the tap.
  { letter: 'r', name: 'erre', also: [{ name: 'ere', regions: LATIN_AMERICA }] },
  { letter: 's', name: 'ese' },
  { letter: 't', name: 'te' },
  { letter: 'u', name: 'u' },
  {
    letter: 'v',
    name: 'uve',
    also: [
      { name: 've corta', regions: LATIN_AMERICA },
      { name: 've chica', regions: LATIN_AMERICA },
    ],
  },
  {
    letter: 'w',
    name: 'uve doble',
    also: [
      { name: 'doble ve', regions: LATIN_AMERICA },
      { name: 'doble u', regions: LATIN_AMERICA },
    ],
  },
  { letter: 'x', name: 'equis' },
  // `ye` since 2010; `i griega` is what most speakers over thirty still say.
  { letter: 'y', name: 'ye', also: [{ name: 'i griega', regions: LATIN_AMERICA }] },
  { letter: 'z', name: 'zeta' },
];

const BY_LETTER = new Map(ALPHABET.map((entry) => [entry.letter, entry]));

/**
 * What a character is called, or `undefined` for anything not in the alphabet.
 *
 * An accented vowel is not a letter of its own — `á` files under `a` — so it
 * resolves to its base letter's name and {@link spellWord} adds the accent
 * separately. `ü` is the same: a diaeresis on `u`, not a twenty-eighth letter.
 */
export function letterName(character: string): string | undefined {
  return BY_LETTER.get(stripDiacritic(character.toLowerCase()))?.name;
}

/** Every name a letter answers to, the RAE's first. */
export function letterNames(character: string): readonly string[] {
  const entry = BY_LETTER.get(stripDiacritic(character.toLowerCase()));
  if (!entry) return [];
  return [entry.name, ...(entry.also ?? []).map((alternative) => alternative.name)];
}

/** True for a name this module would produce — used to keep the dataset honest. */
export function isLetterName(word: string): boolean {
  const wanted = word.trim().toLowerCase();
  return ALPHABET.some((entry) => letterNames(entry.letter).includes(wanted));
}

const DIACRITICS: Readonly<Record<string, string>> = {
  á: 'a',
  é: 'e',
  í: 'i',
  ó: 'o',
  ú: 'u',
  ü: 'u',
};

function stripDiacritic(character: string): string {
  return DIACRITICS[character] ?? character;
}

/**
 * A word as it is read out letter by letter: `gato` → `ge, a, te, o`.
 *
 * The accent is spoken, not skipped. `Gómez` spelled without saying where the
 * accent goes is `Gomez`, a different surname — so an accented vowel comes back
 * as `o con acento`, and `ü` as `u con diéresis`, which is what a speaker
 * actually says when reading a name down a phone line.
 *
 * Characters outside the alphabet — a space, a hyphen, a digit — are dropped
 * rather than guessed at, so the result is always something sayable.
 */
export function spellWord(word: string): readonly string[] {
  const spoken: string[] = [];
  for (const character of word.toLowerCase()) {
    const name = letterName(character);
    if (name === undefined) continue;
    if (character === 'ü') spoken.push(`${name} con diéresis`);
    else if (character in DIACRITICS) spoken.push(`${name} con acento`);
    else spoken.push(name);
  }
  return spoken;
}
