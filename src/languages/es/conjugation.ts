/**
 * Spanish conjugation.
 *
 * Verb forms are generated from rules plus an explicit irregularity table,
 * never hand-typed: ~100 verbs × ~20 forms is 2,000 opportunities to misplace
 * an accent. Rules are auditable and testable; a typo in a table of 2,000
 * strings is not.
 *
 * Language-specific logic lives under `src/languages/<tag>/` so the engine in
 * `src/domain` stays language-agnostic. It is used at dataset build time and
 * is available at runtime if a future exercise wants it.
 */

import type { Morphology, Tense } from '../../domain/content';

export type Conjugation = 'ar' | 'er' | 'ir';

export interface GeneratedForm {
  readonly form: string;
  readonly morph: Morphology;
  /** Set for forms that are not used everywhere, e.g. vosotros. */
  readonly regions?: readonly string[];
  /** Rough level: present is A1, past tenses A2. */
  readonly level: 'a1' | 'a2';
}

/** Irregularity declared per verb; everything else follows the regular rules. */
export interface Irregularity {
  /** Present-tense stem change, applied to all but nosotros/vosotros. */
  readonly stemChange?: 'e-ie' | 'o-ue' | 'e-i' | 'u-ue' | 'i-ie';
  /** Irregular first person singular present, e.g. `tengo`. */
  readonly yo?: string;
  /** Fully irregular present, all six persons. */
  readonly present?: readonly [string, string, string, string, string, string];
  /** Strong preterite stem, e.g. `tuv` for tener. */
  readonly preteriteStem?: string;
  /** Fully irregular preterite, all six persons. */
  readonly preterite?: readonly [string, string, string, string, string, string];
  /** Fully irregular imperfect (only ser, ir and ver). */
  readonly imperfect?: readonly [string, string, string, string, string, string];
  readonly participle?: string;
  readonly gerund?: string;
  /**
   * Vowel change in the third person preterite and the gerund, which -ir
   * stem-changing verbs take: pedir → pidió, pidiendo; dormir → durmió.
   */
  readonly preteriteStemChange?: 'e-i' | 'o-u';
}

const PRESENT_ENDINGS: Record<Conjugation, readonly string[]> = {
  ar: ['o', 'as', 'a', 'amos', 'áis', 'an'],
  er: ['o', 'es', 'e', 'emos', 'éis', 'en'],
  ir: ['o', 'es', 'e', 'imos', 'ís', 'en'],
};

const PRETERITE_ENDINGS: Record<Conjugation, readonly string[]> = {
  ar: ['é', 'aste', 'ó', 'amos', 'asteis', 'aron'],
  er: ['í', 'iste', 'ió', 'imos', 'isteis', 'ieron'],
  ir: ['í', 'iste', 'ió', 'imos', 'isteis', 'ieron'],
};

const IMPERFECT_ENDINGS: Record<Conjugation, readonly string[]> = {
  ar: ['aba', 'abas', 'aba', 'ábamos', 'abais', 'aban'],
  er: ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'],
  ir: ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'],
};

/** Endings after a strong preterite stem — note the unstressed `e` and `o`. */
const STRONG_PRETERITE_ENDINGS = ['e', 'iste', 'o', 'imos', 'isteis', 'ieron'] as const;

const PERSONS: readonly Morphology[] = [
  { person: 1, number: 'singular' },
  { person: 2, number: 'singular', formality: 'informal' },
  { person: 3, number: 'singular' },
  { person: 1, number: 'plural' },
  { person: 2, number: 'plural', formality: 'informal' },
  { person: 3, number: 'plural' },
];

/** vosotros is Spain-only; the rest of the Spanish-speaking world uses ustedes. */
const VOSOTROS_INDEX = 4;
const SPAIN_ONLY = ['es-ES'] as const;

export function conjugationOf(lemma: string): Conjugation | null {
  if (lemma.endsWith('ar')) return 'ar';
  if (lemma.endsWith('er')) return 'er';
  if (lemma.endsWith('ir') || lemma.endsWith('ír')) return 'ir';
  return null;
}

export function stemOf(lemma: string): string {
  return lemma.slice(0, -2);
}

/**
 * Generates present, preterite and imperfect indicative, plus the gerund and
 * the participle. Beginner priority per spec §14; the subjunctive and the
 * compound tenses are deliberately left out of this pass.
 */
export function conjugate(lemma: string, irregular: Irregularity = {}): readonly GeneratedForm[] {
  const conjugation = conjugationOf(lemma);
  if (!conjugation) throw new Error(`not a Spanish infinitive: ${lemma}`);

  const forms: GeneratedForm[] = [];
  const push = (form: string, morph: Morphology, level: 'a1' | 'a2', index?: number) => {
    forms.push({
      form,
      morph,
      level,
      ...(index === VOSOTROS_INDEX ? { regions: SPAIN_ONLY } : {}),
    });
  };

  present(lemma, conjugation, irregular).forEach((form, index) =>
    push(
      form,
      { ...PERSONS[index], tense: 'present', mood: 'indicative', verbForm: 'finite' },
      'a1',
      index,
    ),
  );

  preterite(lemma, conjugation, irregular).forEach((form, index) =>
    push(
      form,
      { ...PERSONS[index], tense: 'preterite', mood: 'indicative', verbForm: 'finite' },
      'a2',
      index,
    ),
  );

  imperfect(lemma, conjugation, irregular).forEach((form, index) =>
    push(
      form,
      { ...PERSONS[index], tense: 'imperfect', mood: 'indicative', verbForm: 'finite' },
      'a2',
      index,
    ),
  );

  push(gerund(lemma, conjugation, irregular), { verbForm: 'gerund' }, 'a2');
  push(participle(lemma, conjugation, irregular), { verbForm: 'participle' }, 'a2');

  return forms;
}

function present(
  lemma: string,
  conjugation: Conjugation,
  irregular: Irregularity,
): readonly string[] {
  if (irregular.present) return irregular.present;

  const stem = stemOf(lemma);
  const changed = applyStemChange(stem, irregular.stemChange);
  const endings = PRESENT_ENDINGS[conjugation];

  return endings.map((ending, index) => {
    // nosotros and vosotros keep the unstressed stem.
    const base = index === 3 || index === VOSOTROS_INDEX ? stem : changed;
    if (index === 0) return irregular.yo ?? spellPresentYo(base, lemma, ending);
    return base + ending;
  });
}

function preterite(
  lemma: string,
  conjugation: Conjugation,
  irregular: Irregularity,
): readonly string[] {
  if (irregular.preterite) return irregular.preterite;

  if (irregular.preteriteStem) {
    const stem = irregular.preteriteStem;
    return STRONG_PRETERITE_ENDINGS.map((ending, index) => {
      // hacer → hizo: c softens to z before o.
      if (index === 2 && stem === 'hic') return 'hizo';
      // dijeron, trajeron, condujeron — the i is absorbed after j.
      if (index === 5 && stem.endsWith('j')) return `${stem}eron`;
      return stem + ending;
    });
  }

  const stem = stemOf(lemma);
  const endings = PRETERITE_ENDINGS[conjugation];

  return endings.map((ending, index) => {
    if (index === 0) return spellPreteriteYo(stem, conjugation, ending);
    const thirdPerson = index === 2 || index === 5;
    const base =
      thirdPerson && irregular.preteriteStemChange
        ? applyStemChange(stem, irregular.preteriteStemChange === 'e-i' ? 'e-i' : 'o-u')
        : stem;
    // After a vowel stem: leyó/leyeron in the third person, leíste/leímos
    // elsewhere — the i either hardens to y or takes a written accent.
    return thirdPerson ? base + softenI(base, ending) : base + accentI(base, ending);
  });
}

function imperfect(
  lemma: string,
  conjugation: Conjugation,
  irregular: Irregularity,
): readonly string[] {
  if (irregular.imperfect) return irregular.imperfect;
  return IMPERFECT_ENDINGS[conjugation].map((ending) => stemOf(lemma) + ending);
}

function gerund(lemma: string, conjugation: Conjugation, irregular: Irregularity): string {
  if (irregular.gerund) return irregular.gerund;
  const stem = stemOf(lemma);
  if (conjugation === 'ar') return `${stem}ando`;
  const base = irregular.preteriteStemChange
    ? applyStemChange(stem, irregular.preteriteStemChange === 'e-i' ? 'e-i' : 'o-u')
    : stem;
  // leer → leyendo, oír → oyendo: i becomes y between vowels.
  return endsWithVowel(base) ? `${base}yendo` : `${base}iendo`;
}

function participle(lemma: string, conjugation: Conjugation, irregular: Irregularity): string {
  if (irregular.participle) return irregular.participle;
  const stem = stemOf(lemma);
  if (conjugation === 'ar') return `${stem}ado`;
  // leer → leído, oír → oído: the i takes an accent after a vowel.
  return endsWithVowel(stem) ? `${stem}ído` : `${stem}ido`;
}

type StemChange = NonNullable<Irregularity['stemChange']> | 'o-u';

/** Changes the last stressable vowel of the stem: poder → puedo, pedir → pido. */
function applyStemChange(stem: string, change: StemChange | undefined): string {
  if (!change) return stem;
  const [from, to] = change.split('-') as [string, string];
  const index = stem.lastIndexOf(from);
  if (index === -1) return stem;
  return stem.slice(0, index) + to + stem.slice(index + from.length);
}

/** Orthographic changes in the first person singular present. */
function spellPresentYo(stem: string, lemma: string, ending: string): string {
  // escoger → escojo, dirigir → dirijo: g keeps its soft sound before o.
  if (lemma.endsWith('ger') || lemma.endsWith('gir')) return `${stem.slice(0, -1)}jo`;
  // seguir → sigo: the u is only there to keep g hard before e/i.
  if (lemma.endsWith('guir')) return `${stem.slice(0, -1)}o`;
  return stem + ending;
}

/** Orthographic changes in the first person singular preterite. */
function spellPreteriteYo(stem: string, conjugation: Conjugation, ending: string): string {
  if (conjugation !== 'ar') return stem + ending;
  // buscar → busqué, llegar → llegué, empezar → empecé: the sound is kept.
  if (stem.endsWith('c')) return `${stem.slice(0, -1)}qué`;
  if (stem.endsWith('g')) return `${stem}ué`;
  if (stem.endsWith('z')) return `${stem.slice(0, -1)}cé`;
  return stem + ending;
}

/** `ió`/`ieron` become `yó`/`yeron` after a vowel: leyó, cayeron. */
function softenI(stem: string, ending: string): string {
  if (!endsWithVowel(stem) || !ending.startsWith('i')) return ending;
  return `y${ending.slice(1)}`;
}

/** `iste`/`imos`/`isteis` take an accent after a vowel: leíste, oímos. */
function accentI(stem: string, ending: string): string {
  if (!endsWithVowel(stem) || !ending.startsWith('i')) return ending;
  return `í${ending.slice(1)}`;
}

/**
 * True when the stem ends in a vowel that will collide with an `i` ending.
 * The `u` of `gu`/`qu` is silent orthography, not a vowel: seguir gives
 * siguió and seguiste, never siguyó or seguíste.
 */
function endsWithVowel(stem: string): boolean {
  if (/[gq]u$/.test(stem)) return false;
  return /[aeiouáéíóú]$/.test(stem);
}

export const TENSE_LEVELS: Record<Tense, 'a1' | 'a2'> = {
  present: 'a1',
  preterite: 'a2',
  imperfect: 'a2',
  future: 'a2',
  'present-perfect': 'a2',
  'past-perfect': 'a2',
  conditional: 'a2',
};
