/**
 * The Spanish alphabet: the letters, what they are called, and what they sound
 * like in a word.
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
 * `elle` in a dictionary that no longer files them separately. They are still
 * one sound each, so they are here as {@link DIGRAPHS} — named as what they are
 * rather than dropped, which is the only version of this that answers both
 * questions a learner arrives with.
 *
 * **What a letter is called and what it sounds like are two different facts, and
 * the second is the one a learner needs first.** For a long time this file held
 * only the first: it could say that `h` is called `hache` and not that it is
 * silent, which is the single most useful thing about it. `sound`, `examples`
 * and `notes` are that other half — what the letter does inside a word, a word
 * doing it, and the cases where it does something else.
 *
 * Those three are prose in the reference language on purpose. This is what a
 * chart on a wall says, not material to be practised: the moment a learner is
 * meant to be *tested* on it, it belongs in `content/es` as rows with ids that
 * progress can reference, the way the thirty-seven alphabet sentences already
 * do.
 */

import type { AlphabetEntry, AlphabetGuide, Letter } from '../runtime';

export type { AlphabetEntry, AlphabetGuide, Letter } from '../runtime';

const LATIN_AMERICA = ['es-419'] as const;

export const ALPHABET: readonly Letter[] = [
  {
    letter: 'a',
    name: 'a',
    say: 'ah',
    sound: 'The a of father, short and clean — never the a of cat.',
    examples: [
      { word: 'agua', gloss: 'water' },
      { word: 'casa', gloss: 'house' },
      { word: 'mañana', gloss: 'tomorrow' },
    ],
    notes: [
      'Spanish has five vowel sounds where English has about twenty. A vowel keeps the same sound wherever it falls, stressed or not — the a of cama is the same a twice.',
    ],
  },
  {
    letter: 'b',
    name: 'be',
    say: 'beh',
    sound: 'The b of boy at the start of a word; between vowels the lips barely meet.',
    examples: [
      { word: 'bueno', gloss: 'good' },
      { word: 'beber', gloss: 'to drink' },
      { word: 'abuela', gloss: 'grandmother' },
    ],
    also: [
      { name: 'be larga', regions: LATIN_AMERICA },
      { name: 'be grande', regions: LATIN_AMERICA },
    ],
    notes: [
      'b and v are the same sound in Spanish. That is why ¿Se escribe con be o con uve? is a question native speakers ask each other constantly.',
      'The Latin American names exist to tell the two apart out loud: be larga against ve corta.',
    ],
  },
  {
    letter: 'c',
    name: 'ce',
    say: 'theh in Spain, seh in Latin America',
    sound:
      'The k of cat before a, o and u — the th of think (Spain) or the s of sun (Latin America) before e and i.',
    examples: [
      { word: 'casa', gloss: 'house' },
      { word: 'cena', gloss: 'dinner' },
      { word: 'cinco', gloss: 'five' },
    ],
    notes: [
      'ca, co and cu are hard; ce and ci are soft. To keep the hard sound before e or i, Spanish writes qu — queso, quince.',
      'Most of the Spanish-speaking world says s where Spain says th. Both are standard; neither is an accent to correct.',
    ],
  },
  {
    letter: 'd',
    name: 'de',
    say: 'deh',
    sound: 'The d of dog at the start; between vowels it softens towards the th of this.',
    examples: [
      { word: 'dos', gloss: 'two' },
      { word: 'donde', gloss: 'where' },
      { word: 'nada', gloss: 'nothing' },
    ],
    notes: [
      'A d at the end of a word is barely there: Madrid and usted finish on a breath rather than a stop.',
    ],
  },
  {
    letter: 'e',
    name: 'e',
    say: 'eh',
    sound: 'The e of bed — never the ee of see, and never the ay of day.',
    examples: [
      { word: 'este', gloss: 'this' },
      { word: 'leche', gloss: 'milk' },
      { word: 'verde', gloss: 'green' },
    ],
  },
  {
    letter: 'f',
    name: 'efe',
    say: 'EH-feh',
    sound: 'The f of fine.',
    examples: [
      { word: 'foto', gloss: 'photo' },
      { word: 'fácil', gloss: 'easy' },
      { word: 'café', gloss: 'coffee' },
    ],
  },
  {
    letter: 'g',
    name: 'ge',
    say: 'kheh',
    sound: 'The hard g of go before a, o and u — the harsh h of jota before e and i.',
    examples: [
      { word: 'gato', gloss: 'cat' },
      { word: 'gracias', gloss: 'thank you' },
      { word: 'gente', gloss: 'people' },
    ],
    notes: [
      'ge and gi sound exactly like je and ji: La ge y la jota suenan igual delante de e.',
      'For a hard g before e or i, Spanish writes gu and the u goes silent — guerra, guitarra.',
      'To sound that u after all takes two dots: güe and güi, as in bilingüe and pingüino.',
    ],
  },
  {
    letter: 'h',
    name: 'hache',
    say: 'AH-cheh',
    sound: 'Nothing at all. It is the one letter with no sound of its own.',
    examples: [
      { word: 'hola', gloss: 'hello' },
      { word: 'hora', gloss: 'hour' },
      { word: 'hermano', gloss: 'brother' },
    ],
    notes: [
      'hola and ola (wave) are said identically, and so are hecho and echo. Only the spelling separates them.',
      'Silent is not useless: inside ch the two letters spell one sound.',
      'It is the letter to ask about when taking a name down — ¿Con hache o sin hache?',
    ],
  },
  {
    letter: 'i',
    name: 'i',
    say: 'ee',
    sound: 'The ee of see, kept short.',
    examples: [
      { word: 'sí', gloss: 'yes' },
      { word: 'vivir', gloss: 'to live' },
      { word: 'ciudad', gloss: 'city' },
    ],
    also: [{ name: 'i latina', regions: LATIN_AMERICA }],
    notes: ['Called i latina wherever y is still called i griega — the two names come as a pair.'],
  },
  {
    letter: 'j',
    name: 'jota',
    say: 'HO-tah',
    sound: 'A harsh h from the back of the throat, like the ch of Scottish loch.',
    examples: [
      { word: 'jamón', gloss: 'ham' },
      { word: 'trabajo', gloss: 'work' },
      { word: 'hijo', gloss: 'son' },
    ],
    notes: [
      'Strongest in Spain; softer across much of Latin America and the Caribbean, where it lands close to an English h.',
    ],
  },
  {
    letter: 'k',
    name: 'ka',
    say: 'kah',
    sound: 'The k of kilo.',
    examples: [
      { word: 'kilo', gloss: 'kilo' },
      { word: 'kiwi', gloss: 'kiwi' },
    ],
    notes: [
      'One of the two letters that appear almost only in borrowed words — the other is w. Spanish spells its own k sound with c or qu.',
    ],
  },
  {
    letter: 'l',
    name: 'ele',
    say: 'EH-leh',
    sound: 'The clear l of leaf, tongue forward — never the dark l of full.',
    examples: [
      { word: 'luna', gloss: 'moon' },
      { word: 'hola', gloss: 'hello' },
      { word: 'papel', gloss: 'paper' },
    ],
    notes: ['Doubled it is a different sound entirely — see ll below.'],
  },
  {
    letter: 'm',
    name: 'eme',
    say: 'EH-meh',
    sound: 'The m of moon.',
    examples: [
      { word: 'mano', gloss: 'hand' },
      { word: 'mamá', gloss: 'mum' },
      { word: 'comer', gloss: 'to eat' },
    ],
    notes: [
      'eme and ene are the pair most often misheard down a phone line, which is why Es una eme, no una ene is worth having ready.',
    ],
  },
  {
    letter: 'n',
    name: 'ene',
    say: 'EH-neh',
    sound: 'The n of no.',
    examples: [
      { word: 'nada', gloss: 'nothing' },
      { word: 'nueve', gloss: 'nine' },
      { word: 'tener', gloss: 'to have' },
    ],
    notes: ['Before a b or a v it drifts towards m: un vaso comes out as um vaso.'],
  },
  {
    letter: 'ñ',
    name: 'eñe',
    say: 'EN-yeh',
    sound: 'The ny of canyon — one sound, not an n followed by a y.',
    examples: [
      { word: 'año', gloss: 'year' },
      { word: 'mañana', gloss: 'tomorrow' },
      { word: 'niño', gloss: 'child' },
    ],
    notes: [
      'A letter in its own right, filed between n and o in a dictionary — not an n wearing an accent.',
      'The tilde is not optional: año is a year and ano is an anus.',
    ],
  },
  {
    letter: 'o',
    name: 'o',
    say: 'oh',
    sound: 'The o of more, short and rounded — never the ow glide of go.',
    examples: [
      { word: 'ocho', gloss: 'eight' },
      { word: 'otro', gloss: 'other' },
      { word: 'como', gloss: 'how, as' },
    ],
  },
  {
    letter: 'p',
    name: 'pe',
    say: 'peh',
    sound: 'The p of spin — no puff of air after it.',
    examples: [
      { word: 'padre', gloss: 'father' },
      { word: 'pan', gloss: 'bread' },
      { word: 'poco', gloss: 'a little' },
    ],
  },
  {
    letter: 'q',
    name: 'cu',
    say: 'koo',
    sound: 'The k of kite, always written qu and always before e or i.',
    examples: [
      { word: 'queso', gloss: 'cheese' },
      { word: 'quince', gloss: 'fifteen' },
      { word: 'porque', gloss: 'because' },
    ],
    notes: [
      'q never appears without u, and that u is silent: que is keh, not kweh.',
      'For an actual kw sound Spanish writes cu — cuando, cuatro.',
    ],
  },
  {
    letter: 'r',
    name: 'erre',
    say: 'EH-rreh',
    sound:
      'A single tap of the tongue between vowels; a full trill at the start of a word or after l, n or s.',
    examples: [
      { word: 'pero', gloss: 'but' },
      { word: 'caro', gloss: 'expensive' },
      { word: 'rojo', gloss: 'red' },
    ],
    // `ere` is the single tap of `pero`, `erre` the trill of `perro`. The RAE
    // names the letter `erre` either way; `ere` survives as the name for the tap.
    also: [{ name: 'ere', regions: LATIN_AMERICA }],
    notes: [
      'pero (but) and perro (dog) differ only in the length of the r. It is a real distinction, not a flourish.',
      'The RAE calls the letter erre whichever sound it is making; ere survives as the name for the single tap.',
    ],
  },
  {
    letter: 's',
    name: 'ese',
    say: 'EH-seh',
    sound: 'The s of sun — never the buzz of rose.',
    examples: [
      { word: 'sí', gloss: 'yes' },
      { word: 'casa', gloss: 'house' },
      { word: 'gracias', gloss: 'thank you' },
    ],
    notes: [
      'In the Caribbean, Andalusia and much of the coast an s at the end of a syllable becomes a breath: dos gracias sounds like doh graciah.',
    ],
  },
  {
    letter: 't',
    name: 'te',
    say: 'teh',
    sound: 'The t of stop, tongue against the teeth and no puff of air.',
    examples: [
      { word: 'tres', gloss: 'three' },
      { word: 'tarde', gloss: 'afternoon' },
      { word: 'tomate', gloss: 'tomato' },
    ],
  },
  {
    letter: 'u',
    name: 'u',
    say: 'oo',
    sound: 'The oo of food, kept short.',
    examples: [
      { word: 'uno', gloss: 'one' },
      { word: 'luna', gloss: 'moon' },
      { word: 'mucho', gloss: 'a lot' },
    ],
    notes: [
      'Silent in que, qui, gue and gui — unless it carries two dots, as in pingüino.',
      'Never the yoo of English use: universidad opens oo-nee-.',
    ],
  },
  {
    letter: 'v',
    name: 'uve',
    say: 'OO-veh',
    sound: 'Identical to b. The v of English does not exist in Spanish.',
    examples: [
      { word: 'vino', gloss: 'wine' },
      { word: 'vivir', gloss: 'to live' },
      { word: 'nueve', gloss: 'nine' },
    ],
    also: [
      { name: 've corta', regions: LATIN_AMERICA },
      { name: 've chica', regions: LATIN_AMERICA },
    ],
    notes: [
      'Do not bite your lip: vaca begins exactly like bar.',
      'A learner who only knows uve will not recognise ve corta from a Mexican speaker reading out a booking code — which is precisely the situation the alphabet is learned for.',
    ],
  },
  {
    letter: 'w',
    name: 'uve doble',
    say: 'OO-veh DOH-bleh',
    sound:
      'Only in borrowed words: the w of English, or a b where the word has been long absorbed.',
    examples: [
      { word: 'wifi', gloss: 'wifi' },
      { word: 'whisky', gloss: 'whisky' },
    ],
    also: [
      { name: 'doble ve', regions: LATIN_AMERICA },
      { name: 'doble u', regions: LATIN_AMERICA },
    ],
  },
  {
    letter: 'x',
    name: 'equis',
    say: 'EH-kees',
    sound: 'ks between vowels; often a plain s at the start of a word.',
    examples: [
      { word: 'examen', gloss: 'exam' },
      { word: 'taxi', gloss: 'taxi' },
      { word: 'éxito', gloss: 'success' },
    ],
    notes: [
      'In México, Oaxaca and Texas it is the harsh h of jota — a leftover of older spelling. Never say México with a ks.',
      'xilófono opens with a plain s.',
    ],
  },
  {
    letter: 'y',
    name: 'ye',
    say: 'yeh',
    sound: 'The y of yes. Standing alone as the word y (and), it is simply an i.',
    examples: [
      { word: 'yo', gloss: 'I' },
      { word: 'ayer', gloss: 'yesterday' },
      { word: 'y', gloss: 'and' },
    ],
    // `ye` since 2010; `i griega` is what most speakers over thirty still say.
    also: [{ name: 'i griega', regions: LATIN_AMERICA }],
    notes: [
      'Renamed ye in 2010. Most speakers over thirty still say i griega, so both are worth recognising.',
      'In Argentina and Uruguay it is the sh of shoe: yo comes out sho.',
    ],
  },
  {
    letter: 'z',
    name: 'zeta',
    say: 'THEH-tah in Spain, SEH-tah in Latin America',
    sound: 'The th of think in Spain, the s of sun everywhere else.',
    examples: [
      { word: 'zapato', gloss: 'shoe' },
      { word: 'izquierda', gloss: 'left' },
      { word: 'luz', gloss: 'light' },
    ],
    notes: [
      'Wherever it is said as s, zeta and ce sound identical before e: La zeta y la ce suenan igual delante de e.',
      'Spanish almost never writes z before e or i — it switches to c, so lápiz becomes lápices in the plural.',
    ],
  },
];

/**
 * Two letters that spell one sound.
 *
 * Not letters of the alphabet — `ch` and `ll` stopped being that in 2010, and
 * `rr`, `qu` and `gu` never were — but a learner who does not know them cannot
 * read. Listed apart so the count of the alphabet stays honest at twenty-seven
 * while the chart still answers "what noise does ll make".
 *
 * `qu` and `gu` carry no name: they are spelling rules rather than things a
 * speaker refers to, and inventing a name for them would teach a learner to say
 * something nobody says.
 */
export const DIGRAPHS: readonly AlphabetEntry[] = [
  {
    letter: 'ch',
    name: 'che',
    say: 'cheh',
    sound: 'The ch of cheese.',
    examples: [
      { word: 'chico', gloss: 'boy' },
      { word: 'leche', gloss: 'milk' },
      { word: 'ocho', gloss: 'eight' },
    ],
    notes: [
      'A letter of the alphabet until 2010. A dictionary printed before then files every ch word after c; a current one files chico between ce and ci.',
    ],
  },
  {
    letter: 'll',
    name: 'elle',
    say: 'EH-yeh',
    sound: 'The y of yes, for most speakers.',
    examples: [
      { word: 'llamar', gloss: 'to call' },
      { word: 'calle', gloss: 'street' },
      { word: 'ella', gloss: 'she' },
    ],
    also: [{ name: 'doble ele', regions: LATIN_AMERICA }],
    notes: [
      'Dropped from the alphabet in 2010 alongside ch, and counted as two eles ever since: Mi apellido lleva dos eles.',
      'In Argentina and Uruguay it is the sh of shoe — calle is CAH-sheh.',
    ],
  },
  {
    letter: 'rr',
    name: 'erre doble',
    say: 'EH-rreh DOH-bleh',
    sound: 'A rolled trill, held longer than a single r.',
    examples: [
      { word: 'perro', gloss: 'dog' },
      { word: 'carro', gloss: 'car' },
      { word: 'arriba', gloss: 'above, up' },
    ],
    notes: [
      'Only ever between vowels. No word begins with rr, because a single r at the start is already trilled — rojo and perro open the same way.',
    ],
  },
  {
    letter: 'qu',
    sound: 'The k of kite. The u is silent, and is there only to keep c hard before e and i.',
    examples: [
      { word: 'queso', gloss: 'cheese' },
      { word: 'quince', gloss: 'fifteen' },
      { word: 'aquí', gloss: 'here' },
    ],
    notes: ['Only ever before e or i. There is no qua or quo in Spanish — those are cua and cuo.'],
  },
  {
    letter: 'gu',
    sound: 'A hard g before e and i, with the u silent.',
    examples: [
      { word: 'guerra', gloss: 'war' },
      { word: 'guitarra', gloss: 'guitar' },
      { word: 'seguir', gloss: 'to follow' },
    ],
    notes: [
      'Before a, o and u the g is already hard, so no u is needed: gato, gota, gustar.',
      'When the u does have to be heard it takes two dots — see the diaeresis below.',
    ],
  },
];

/**
 * The written marks. Neither is a letter, and both change what a word means.
 *
 * Here because a chart that stops at the letters leaves a learner unable to
 * write their own name down: the accent is spoken when a word is spelled out
 * loud, and `Gomez` without one is a different surname.
 */
export const MARKS: readonly AlphabetEntry[] = [
  {
    letter: 'á',
    name: 'tilde',
    say: 'TEEL-deh',
    sound: 'No sound of its own — it marks which syllable is stressed: á, é, í, ó, ú.',
    examples: [
      { word: 'está', gloss: 'is' },
      { word: 'café', gloss: 'coffee' },
      { word: 'lápiz', gloss: 'pencil' },
    ],
    notes: [
      'It is spoken when a word is spelled out loud: Gómez is ge, o con acento, eme, e, zeta.',
      'It also separates words spelled alike — tu (your) and tú (you), si (if) and sí (yes), el (the) and él (he).',
      'Spanish calls the mark tilde where English calls it an accent, and calls the squiggle over the ñ the same word.',
    ],
  },
  {
    letter: 'ü',
    name: 'diéresis',
    say: 'dee-EH-reh-sees',
    sound: 'Two dots that switch a silent u back on after g.',
    examples: [
      { word: 'pingüino', gloss: 'penguin' },
      { word: 'bilingüe', gloss: 'bilingual' },
      { word: 'vergüenza', gloss: 'embarrassment' },
    ],
    notes: [
      'Only ever on a u, and only in güe and güi. Without the dots, guerra has no u sound at all.',
      'Spelled out loud it is u con diéresis, exactly as an accented vowel is o con acento.',
    ],
  },
];

/** Spanish as a screen asks for it: the chart, in its three honest parts. */
export const SPANISH_ALPHABET: AlphabetGuide = {
  tag: 'es',
  letters: ALPHABET,
  digraphs: DIGRAPHS,
  marks: MARKS,
};

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
