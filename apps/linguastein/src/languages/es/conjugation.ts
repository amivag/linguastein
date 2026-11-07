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

/**
 * How advanced a generated form is. Not the full CEFR ladder on purpose: this
 * module generates nothing above B1, and a union that stopped at what exists is
 * a union the typechecker can still exhaust.
 */
export type FormLevel = 'a1' | 'a2' | 'b1';

export interface GeneratedForm {
  readonly form: string;
  readonly morph: Morphology;
  /** Set for forms that are not used everywhere, e.g. vosotros. */
  readonly regions?: readonly string[];
  /** Rough level: present is A1, the past and future tenses A2, subjunctive B1. */
  readonly level: FormLevel;
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
  /**
   * Stem for the future **and** the conditional, e.g. `tendr` for tener.
   *
   * One field for two tenses because Spanish uses one stem for both: every verb
   * that says `tendré` says `tendría`, and there is no verb that is irregular in
   * one and regular in the other. Twelve verbs need it; everything else builds
   * both tenses on the whole infinitive, which is why these are the two easiest
   * tenses in the language to generate and the two that were missing.
   */
  readonly futureStem?: string;
  /**
   * Irregular tú command, where it is not simply the third person present:
   * `di`, `haz`, `ve`, `pon`, `sal`, `sé`, `ten`, `ven`.
   */
  readonly imperativeTu?: string;
  /**
   * The whole present subjunctive, for the verbs it cannot be derived for.
   *
   * Two kinds of verb need it. Six have no usable yo form to build on — `soy`
   * would give `soya` rather than `sea` — and `reír` breaks the other way: its
   * yo form `río` carries an accent that the nosotros and vosotros forms drop
   * (`riamos`, not `ríamos`), and no rule here predicts that.
   *
   * This replaced a narrower `imperativeFormal` field holding just the two
   * command forms. It was the same six verbs, declared twice over: a usted
   * command *is* the third person present subjunctive, so two fields meant two
   * places to get `sepa` right and a way for them to disagree. {@link imperatives}
   * now reads persons 3 and 6 off this.
   */
  readonly presentSubjunctive?: readonly [string, string, string, string, string, string];
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

/**
 * Present subjunctive endings: the *other* conjugation's vowel.
 *
 * An `-ar` verb takes the `-er` vowel and both the `-er` and `-ir` verbs take
 * the `-ar` one, which is the whole of the ending rule and the reason `er` and
 * `ir` are identical here where the present indicative keeps them apart.
 */
const SUBJUNCTIVE_ENDINGS: Record<Conjugation, readonly string[]> = {
  ar: ['e', 'es', 'e', 'emos', 'éis', 'en'],
  er: ['a', 'as', 'a', 'amos', 'áis', 'an'],
  ir: ['a', 'as', 'a', 'amos', 'áis', 'an'],
};

/** Endings after a strong preterite stem — note the unstressed `e` and `o`. */
const STRONG_PRETERITE_ENDINGS = ['e', 'iste', 'o', 'imos', 'isteis', 'ieron'] as const;

/**
 * Future and conditional endings, which do not vary by conjugation.
 *
 * Both attach to the **whole infinitive** rather than to a stem — `hablaré`,
 * `comeré`, `viviré` — which is why one array serves all three conjugations
 * where the present needs three. The irregular twelve replace the infinitive
 * with a shortened stem and take the very same endings.
 */
const FUTURE_ENDINGS = ['é', 'ás', 'á', 'emos', 'éis', 'án'] as const;
const CONDITIONAL_ENDINGS = ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'] as const;

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
 * Generates the present, preterite, imperfect, future and conditional
 * indicative, the present subjunctive, the affirmative commands, plus the
 * gerund and the participle. The compound tenses are still out: `haber` is
 * generated and so is every participle, so `he comido` is two forms the pack
 * already has rather than a third it lacks.
 */
export function conjugate(lemma: string, irregular: Irregularity = {}): readonly GeneratedForm[] {
  const conjugation = conjugationOf(lemma);
  if (!conjugation) throw new Error(`not a Spanish infinitive: ${lemma}`);

  const forms: GeneratedForm[] = [];
  const push = (form: string, morph: Morphology, level: FormLevel, index?: number) => {
    forms.push({
      form,
      morph,
      level,
      ...(index === VOSOTROS_INDEX ? { regions: SPAIN_ONLY } : {}),
    });
  };

  const presentForms = present(lemma, conjugation, irregular);
  const subjunctiveForms = presentSubjunctive(lemma, conjugation, irregular, presentForms);

  presentForms.forEach((form, index) =>
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

  for (const command of imperatives(lemma, irregular, presentForms, subjunctiveForms)) {
    forms.push(command);
  }

  /*
   * The present subjunctive, marked B1 — the first thing on this list that is
   * genuinely a level up rather than a tense a beginner was owed. It is also
   * where three A-level features turn out to have been the subjunctive all
   * along: a usted command, an ustedes command and a negative command are all
   * this paradigm, which is why `imperatives` now reads it instead of deriving
   * its own.
   *
   * Carried as `tense: 'present'` with `mood: 'subjunctive'` rather than as a
   * seventh tense, because that is what it is — and `tenseHue` already asks mood
   * first and lets it win, so the colour was waiting for these forms to exist.
   */
  subjunctiveForms.forEach((form, index) =>
    push(
      form,
      { ...PERSONS[index], tense: 'present', mood: 'subjunctive', verbForm: 'finite' },
      'b1',
      index,
    ),
  );

  /*
   * Future and conditional, and the reason they are here at all: writing ordinary
   * past-tense narration reached for `volveremos` and `olvidaré` twice in two
   * batches, and `gustaría` sat unlinked in the shipped pack. They are not
   * advanced grammar — `me gustaría` is one of the first polite formulas anybody
   * learns — and they were absent only because nothing had generated them.
   *
   * Marked A2 rather than split across levels. The simple future is A2 in every
   * syllabus, and the conditional forms a learner meets first (`gustaría`,
   * `podría`) are the A2 politeness formulas rather than the B1 hypotheticals
   * that use the same endings.
   */
  futureOrConditional(lemma, irregular, FUTURE_ENDINGS).forEach((form, index) =>
    push(
      form,
      { ...PERSONS[index], tense: 'future', mood: 'indicative', verbForm: 'finite' },
      'a2',
      index,
    ),
  );

  futureOrConditional(lemma, irregular, CONDITIONAL_ENDINGS).forEach((form, index) =>
    push(
      form,
      { ...PERSONS[index], tense: 'conditional', mood: 'indicative', verbForm: 'finite' },
      'a2',
      index,
    ),
  );

  push(gerund(lemma, conjugation, irregular), { verbForm: 'gerund' }, 'a2');
  push(participle(lemma, conjugation, irregular), { verbForm: 'participle' }, 'a2');

  return forms;
}

/**
 * Affirmative commands, which a beginner meets constantly in service Spanish
 * (`siga`, `dígame`, `abre`) and which are not a tense — an imperative carries
 * mood and person but no time reference.
 *
 * The tú form is the third person present, apart from eight verbs that shorten
 * it. The usted and ustedes forms are simply the third person singular and
 * plural of the present subjunctive — not "derived from" it, but the same two
 * strings — so they are read straight off the paradigm rather than rebuilt here.
 * That is what retired the `imperativeFormal` table: `sepa` was declared as a
 * command and would have had to be declared again as a subjunctive.
 */
function imperatives(
  lemma: string,
  irregular: Irregularity,
  presentForms: readonly string[],
  subjunctiveForms: readonly string[],
): readonly GeneratedForm[] {
  const tu = irregular.imperativeTu ?? presentForms[2]!;
  const usted = subjunctiveForms[2]!;
  const ustedes = subjunctiveForms[5]!;
  // hablar → hablad, oír → oíd: the infinitive's -r becomes -d, no exceptions.
  const vosotros = `${lemma.slice(0, -1)}d`;

  const command = (form: string, morph: Morphology): GeneratedForm => ({
    form,
    morph: { ...morph, mood: 'imperative', verbForm: 'finite' },
    level: 'a1',
  });

  return [
    command(tu, { person: 2, number: 'singular', formality: 'informal' }),
    command(usted, { person: 2, number: 'singular', formality: 'formal' }),
    {
      ...command(vosotros, { person: 2, number: 'plural', formality: 'informal' }),
      regions: SPAIN_ONLY,
    },
    command(ustedes, { person: 2, number: 'plural', formality: 'formal' }),
  ];
}

/**
 * The present subjunctive, from two facts and one exception.
 *
 * **The stem is the yo form.** `tengo` → `tenga`, `conozco` → `conozca`,
 * `elijo` → `elija`: every consonant irregularity a verb carries in the first
 * person is already the subjunctive's, so building on `yo` rather than on the
 * infinitive needs no table of its own. This is also the rule a learner is
 * actually taught, which is worth something in a module whose output is read.
 *
 * **nosotros and vosotros leave the boot, and by conjugation.** An `-ar` or
 * `-er` stem change does not reach them at all — `pensemos`, `podamos`,
 * `volvamos` — while an `-ir` verb takes its *preterite* vowel there instead:
 * `pidamos`, `durmamos`, `sintamos`. That is the same change the gerund and the
 * third person preterite take, so `preteriteStemChange` is what declares it and
 * no new field is needed.
 *
 * The exception is a verb that spells its own yo form. `tener` declares
 * `tengo` *and* an `e-ie` stem change; undoing the change outside the boot would
 * give `tenamos` for `tengamos`, and `ver` would give `vamos` — the wrong verb
 * entirely — for `veamos`. So a declared yo form holds throughout, and only a
 * rule-applied change is undone.
 */
function presentSubjunctive(
  lemma: string,
  conjugation: Conjugation,
  irregular: Irregularity,
  presentForms: readonly string[],
): readonly string[] {
  if (irregular.presentSubjunctive) return irregular.presentSubjunctive;

  // The yo form minus its -o, which carries tengo/conozco/elijo for free.
  const boot = presentForms[0]!.replace(/o$/, '');
  const declaredYo = irregular.yo !== undefined || irregular.present !== undefined;
  // `preteriteStemChange` is already a `StemChange`, and `applyStemChange`
  // passes an absent one straight through, so no guard is needed here.
  const plain = softenBeforeBackVowel(
    applyStemChange(stemOf(lemma), irregular.preteriteStemChange),
    lemma,
  );
  const outsideBoot = declaredYo || !irregular.stemChange ? boot : plain;

  return SUBJUNCTIVE_ENDINGS[conjugation].map((ending, index) => {
    const stem = index === 3 || index === VOSOTROS_INDEX ? outsideBoot : boot;
    // Only the -ar endings begin with a front vowel, so only they can soften a
    // final c or g: busque, llegue, empiece.
    return (conjugation === 'ar' ? hardenBeforeE(stem) : stem) + ending;
  });
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

/**
 * One builder for both tenses, because they differ only in their endings.
 *
 * `futureStem` replaces the infinitive when a verb has one; otherwise the whole
 * infinitive is the stem. Nothing else about either tense is irregular in
 * Spanish — no verb changes person endings, and none is defective — so this is
 * the entire rule.
 */
function futureOrConditional(
  lemma: string,
  irregular: Irregularity,
  endings: readonly string[],
): readonly string[] {
  const stem = irregular.futureStem ?? lemma;
  return endings.map((ending) => stem + ending);
}

function gerund(lemma: string, conjugation: Conjugation, irregular: Irregularity): string {
  if (irregular.gerund) return irregular.gerund;
  const stem = stemOf(lemma);
  if (conjugation === 'ar') return `${stem}ando`;
  const base = irregular.preteriteStemChange
    ? applyStemChange(stem, irregular.preteriteStemChange === 'e-i' ? 'e-i' : 'o-u')
    : stem;
  // leer → leyendo, oír → oyendo: i becomes y between vowels. A stem already
  // ending in `i` absorbs it instead, exactly as in the preterite: `riendo`.
  if (base.endsWith('i')) return `${base}endo`;
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

/**
 * Orthographic changes in the first person singular present.
 *
 * The ending is always `o` here, which is the only reason one call can serve
 * every case: the softened stem plus the ending *is* `escojo` and `sigo`.
 */
function spellPresentYo(stem: string, lemma: string, ending: string): string {
  return softenBeforeBackVowel(stem, lemma) + ending;
}

/**
 * Keeps a stem's final `g` sounding the same before `a` or `o`.
 *
 * Two rules, opposite in appearance and identical in purpose. `escoger` and
 * `dirigir` write the soft sound as `j` (`escojo`, `elija`); `seguir` drops the
 * silent `u` it only needed to keep `g` hard before `e`/`i` (`sigo`, `sigamos`).
 *
 * Shared by the present yo form and the subjunctive because it is the same fact
 * about Spanish spelling, reached from two directions: the yo form is the only
 * back-vowel ending in the present, and *every* subjunctive ending of an `-er`
 * or `-ir` verb is one. Having written it once for `-o` and once for `-a`, the
 * two spellings of `elija`/`elijo` could differ, which is exactly the class of
 * bug this module exists to make impossible.
 */
function softenBeforeBackVowel(stem: string, lemma: string): string {
  if (lemma.endsWith('ger') || lemma.endsWith('gir')) return `${stem.slice(0, -1)}j`;
  if (lemma.endsWith('guir')) return stem.slice(0, -1);
  return stem;
}

/** Orthographic changes in the first person singular preterite. */
function spellPreteriteYo(stem: string, conjugation: Conjugation, ending: string): string {
  if (conjugation !== 'ar') return stem + ending;
  return hardenBeforeE(stem) + ending;
}

/**
 * Keeps an -ar stem's final consonant sounding the same before a front vowel:
 * buscar → busqué/busque, llegar → llegué/llegue, empezar → empecé/empiece.
 * The preterite yo and the usted command both need it.
 */
function hardenBeforeE(stem: string): string {
  if (stem.endsWith('c')) return `${stem.slice(0, -1)}qu`;
  if (stem.endsWith('g')) return `${stem}u`;
  if (stem.endsWith('z')) return `${stem.slice(0, -1)}c`;
  return stem;
}

/**
 * `ió`/`ieron` become `yó`/`yeron` after a vowel: leyó, cayeron.
 *
 * Unless that vowel is itself an `i`, in which case the ending's `i` is absorbed
 * rather than hardened. `reír` takes an `e → i` change in the third person, so
 * its stem is `ri`, and the rule above turned that into `riyó` and `riyeron` —
 * forms no Spanish speaker writes. `rió` and `rieron` are two `i`s becoming one.
 *
 * `leer` and `oír` are unaffected because their stems end in `e` and `o`, and
 * `seguir` because `endsWithVowel` already declines to count the silent `u`.
 */
function softenI(stem: string, ending: string): string {
  if (!endsWithVowel(stem) || !ending.startsWith('i')) return ending;
  if (stem.endsWith('i')) return ending.slice(1);
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
