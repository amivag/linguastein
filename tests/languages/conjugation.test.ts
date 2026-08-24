/**
 * The conjugator generates every verb form the packs ship, so it is checked
 * against known-correct paradigms — regular, stem-changing, orthographic and
 * fully irregular.
 */

import { describe, expect, it } from 'vitest';
import { conjugate, type GeneratedForm } from '../../src/languages/es/conjugation';
import { IRREGULAR_VERBS } from '../../src/languages/es/irregulars';

/**
 * Mood is asked for everywhere here, and that is not defensiveness: the present
 * subjunctive carries `tense: 'present'`, so a filter naming only the tense
 * returns twelve forms where a paradigm has six. Every helper below says which
 * mood it wants for that reason.
 */
function formsOf(lemma: string) {
  const generated = conjugate(lemma, IRREGULAR_VERBS[lemma] ?? {});
  const tense = (name: string, mood = 'indicative') =>
    generated
      .filter(
        (form) =>
          form.morph.tense === name && form.morph.mood === mood && form.morph.verbForm === 'finite',
      )
      .map((form) => form.form);
  const nonFinite = (kind: GeneratedForm['morph']['verbForm']) =>
    generated.find((form) => form.morph.verbForm === kind)?.form;

  return {
    present: tense('present'),
    preterite: tense('preterite'),
    imperfect: tense('imperfect'),
    subjunctive: tense('present', 'subjunctive'),
    gerund: nonFinite('gerund'),
    participle: nonFinite('participle'),
    /** tú, usted, vosotros, ustedes — the order the generator emits. */
    commands: generated.filter((form) => form.morph.mood === 'imperative').map((form) => form.form),
  };
}

/** The six forms of one indicative tense, in person order. */
const tenseOf = (lemma: string, tense: string) =>
  conjugate(lemma, IRREGULAR_VERBS[lemma] ?? {})
    .filter((form) => form.morph.tense === tense && form.morph.mood === 'indicative')
    .map((form) => form.form);

describe('regular verbs', () => {
  it('conjugates -ar', () => {
    const hablar = formsOf('hablar');
    expect(hablar.present).toEqual(['hablo', 'hablas', 'habla', 'hablamos', 'habláis', 'hablan']);
    expect(hablar.preterite).toEqual([
      'hablé',
      'hablaste',
      'habló',
      'hablamos',
      'hablasteis',
      'hablaron',
    ]);
    expect(hablar.imperfect).toEqual([
      'hablaba',
      'hablabas',
      'hablaba',
      'hablábamos',
      'hablabais',
      'hablaban',
    ]);
    expect(hablar.gerund).toBe('hablando');
    expect(hablar.participle).toBe('hablado');
  });

  it('conjugates -er and -ir', () => {
    expect(formsOf('comer').present).toEqual([
      'como',
      'comes',
      'come',
      'comemos',
      'coméis',
      'comen',
    ]);
    expect(formsOf('vivir').present).toEqual([
      'vivo',
      'vives',
      'vive',
      'vivimos',
      'vivís',
      'viven',
    ]);
    expect(formsOf('vivir').preterite).toEqual([
      'viví',
      'viviste',
      'vivió',
      'vivimos',
      'vivisteis',
      'vivieron',
    ]);
    expect(formsOf('comer').gerund).toBe('comiendo');
  });
});

describe('stem changes', () => {
  it('applies e → ie, keeping nosotros and vosotros unchanged', () => {
    expect(formsOf('pensar').present).toEqual([
      'pienso',
      'piensas',
      'piensa',
      'pensamos',
      'pensáis',
      'piensan',
    ]);
  });

  it('applies o → ue and u → ue', () => {
    expect(formsOf('poder').present).toEqual([
      'puedo',
      'puedes',
      'puede',
      'podemos',
      'podéis',
      'pueden',
    ]);
    expect(formsOf('jugar').present.slice(0, 3)).toEqual(['juego', 'juegas', 'juega']);
    expect(formsOf('volver').present[0]).toBe('vuelvo');
  });

  it('applies e → i, including the third person preterite and the gerund', () => {
    const pedir = formsOf('pedir');
    expect(pedir.present).toEqual(['pido', 'pides', 'pide', 'pedimos', 'pedís', 'piden']);
    expect(pedir.preterite).toEqual([
      'pedí',
      'pediste',
      'pidió',
      'pedimos',
      'pedisteis',
      'pidieron',
    ]);
    expect(pedir.gerund).toBe('pidiendo');
  });

  it('applies o → u in dormir and morir', () => {
    expect(formsOf('dormir').present[0]).toBe('duermo');
    expect(formsOf('dormir').preterite[2]).toBe('durmió');
    expect(formsOf('dormir').gerund).toBe('durmiendo');
    expect(formsOf('morir').participle).toBe('muerto');
  });
});

describe('spelling changes', () => {
  it('keeps the consonant sound in the first person preterite', () => {
    expect(formsOf('buscar').preterite[0]).toBe('busqué');
    expect(formsOf('llegar').preterite[0]).toBe('llegué');
    expect(formsOf('empezar').preterite[0]).toBe('empecé');
    expect(formsOf('jugar').preterite[0]).toBe('jugué');
  });

  it('turns i into y between vowels', () => {
    const leer = formsOf('leer');
    expect(leer.preterite).toEqual(['leí', 'leíste', 'leyó', 'leímos', 'leísteis', 'leyeron']);
    expect(leer.gerund).toBe('leyendo');
    expect(leer.participle).toBe('leído');
    expect(formsOf('caer').preterite[2]).toBe('cayó');
    expect(formsOf('oír').preterite).toEqual(['oí', 'oíste', 'oyó', 'oímos', 'oísteis', 'oyeron']);
  });

  it('handles -guir and -gir in the first person present', () => {
    expect(formsOf('seguir').present).toEqual([
      'sigo',
      'sigues',
      'sigue',
      'seguimos',
      'seguís',
      'siguen',
    ]);
    expect(formsOf('elegir').present[0]).toBe('elijo');
  });

  it('treats the silent u of -guir as orthography, not a vowel', () => {
    expect(formsOf('seguir').preterite).toEqual([
      'seguí',
      'seguiste',
      'siguió',
      'seguimos',
      'seguisteis',
      'siguieron',
    ]);
    expect(formsOf('seguir').gerund).toBe('siguiendo');
    expect(formsOf('conseguir').preterite[2]).toBe('consiguió');
  });
});

describe('irregular verbs', () => {
  it('conjugates ser, ir and estar', () => {
    expect(formsOf('ser').present).toEqual(['soy', 'eres', 'es', 'somos', 'sois', 'son']);
    expect(formsOf('ser').imperfect[0]).toBe('era');
    expect(formsOf('ir').present).toEqual(['voy', 'vas', 'va', 'vamos', 'vais', 'van']);
    expect(formsOf('ir').preterite).toEqual(formsOf('ser').preterite);
    expect(formsOf('estar').present[2]).toBe('está');
    expect(formsOf('estar').preterite[0]).toBe('estuve');
  });

  it('builds strong preterites with unstressed endings', () => {
    expect(formsOf('tener').preterite).toEqual([
      'tuve',
      'tuviste',
      'tuvo',
      'tuvimos',
      'tuvisteis',
      'tuvieron',
    ]);
    expect(formsOf('poder').preterite[0]).toBe('pude');
    expect(formsOf('saber').preterite[0]).toBe('supe');
    expect(formsOf('poner').preterite[2]).toBe('puso');
    expect(formsOf('querer').preterite[2]).toBe('quiso');
    expect(formsOf('venir').preterite[5]).toBe('vinieron');
  });

  it('handles hacer → hizo and the j-stems', () => {
    expect(formsOf('hacer').preterite).toEqual([
      'hice',
      'hiciste',
      'hizo',
      'hicimos',
      'hicisteis',
      'hicieron',
    ]);
    expect(formsOf('decir').preterite).toEqual([
      'dije',
      'dijiste',
      'dijo',
      'dijimos',
      'dijisteis',
      'dijeron',
    ]);
    expect(formsOf('traer').preterite[5]).toBe('trajeron');
    expect(formsOf('conducir').preterite[5]).toBe('condujeron');
  });

  it('handles irregular first persons and participles', () => {
    expect(formsOf('tener').present[0]).toBe('tengo');
    expect(formsOf('salir').present[0]).toBe('salgo');
    expect(formsOf('conocer').present[0]).toBe('conozco');
    expect(formsOf('saber').present[0]).toBe('sé');
    expect(formsOf('ver').present[0]).toBe('veo');
    expect(formsOf('ver').participle).toBe('visto');
    expect(formsOf('hacer').participle).toBe('hecho');
    expect(formsOf('escribir').participle).toBe('escrito');
    expect(formsOf('abrir').participle).toBe('abierto');
    expect(formsOf('volver').participle).toBe('vuelto');
    expect(formsOf('oír').present).toEqual(['oigo', 'oyes', 'oye', 'oímos', 'oís', 'oyen']);
  });
});

/**
 * The two tenses that were missing, and the reason they are the easiest to add:
 * both attach their endings to the **whole infinitive**, so one ending list
 * serves all three conjugations, and the twelve irregular verbs share a single
 * shortened stem between the two tenses. No verb is irregular in one and regular
 * in the other, which is why `futureStem` is one field rather than two.
 *
 * They were absent rather than deferred. Writing ordinary narration reached for
 * `volveremos` and `olvidaré` in consecutive batches, and `gustaría` sat unlinked
 * in the shipped pack — `me gustaría` being one of the first polite formulas
 * anybody learns.
 */
describe('future and conditional', () => {
  it('builds both on the whole infinitive, for all three conjugations', () => {
    expect(tenseOf('hablar', 'future')).toEqual([
      'hablaré',
      'hablarás',
      'hablará',
      'hablaremos',
      'hablaréis',
      'hablarán',
    ]);
    expect(tenseOf('comer', 'future')).toEqual([
      'comeré',
      'comerás',
      'comerá',
      'comeremos',
      'comeréis',
      'comerán',
    ]);
    expect(tenseOf('vivir', 'conditional')).toEqual([
      'viviría',
      'vivirías',
      'viviría',
      'viviríamos',
      'viviríais',
      'vivirían',
    ]);
  });

  it('shares one irregular stem between the two tenses', () => {
    for (const [lemma, stem] of [
      ['tener', 'tendr'],
      ['hacer', 'har'],
      ['decir', 'dir'],
      ['poder', 'podr'],
      ['querer', 'querr'],
      ['salir', 'saldr'],
    ] as const) {
      expect(tenseOf(lemma, 'future')[0], `${lemma} future`).toBe(`${stem}é`);
      expect(tenseOf(lemma, 'conditional')[0], `${lemma} conditional`).toBe(`${stem}ía`);
    }
  });

  it('leaves a stem-changing verb alone in both, because neither changes its stem', () => {
    // `poder` is `puedo` in the present and `podré` in the future: the present
    // stem change must not leak into a tense built on the infinitive.
    expect(tenseOf('poder', 'future')).toContain('podrá');
    expect(tenseOf('poder', 'future')).not.toContain('puedrá');
    expect(tenseOf('pensar', 'future')[0]).toBe('pensaré');
  });

  it('gives the conditional the imperfect endings, not its own', () => {
    // Worth pinning: the conditional is the future stem plus `-ía`, which is the
    // -er/-ir imperfect ending. A learner who knows one gets the other free.
    expect(tenseOf('hablar', 'conditional')[0]).toBe('hablaría');
    expect(tenseOf('hablar', 'conditional')[3]).toBe('hablaríamos');
  });

  it('marks the vosotros form as used in Spain, like every other tense', () => {
    const future = conjugate('hablar').filter((form) => form.morph.tense === 'future');
    expect(future[4]?.form).toBe('hablaréis');
    expect(future[4]?.regions).toEqual(['es-ES']);
  });
});

describe('present subjunctive', () => {
  it('takes the opposite conjugation vowel', () => {
    expect(formsOf('hablar').subjunctive).toEqual([
      'hable',
      'hables',
      'hable',
      'hablemos',
      'habléis',
      'hablen',
    ]);
    // -er and -ir are identical here, where the present indicative keeps them apart.
    expect(formsOf('comer').subjunctive).toEqual([
      'coma',
      'comas',
      'coma',
      'comamos',
      'comáis',
      'coman',
    ]);
    expect(formsOf('vivir').subjunctive).toEqual([
      'viva',
      'vivas',
      'viva',
      'vivamos',
      'viváis',
      'vivan',
    ]);
  });

  it('leaves nosotros and vosotros out of an -ar or -er stem change', () => {
    expect(formsOf('pensar').subjunctive).toEqual([
      'piense',
      'pienses',
      'piense',
      'pensemos',
      'penséis',
      'piensen',
    ]);
    expect(formsOf('poder').subjunctive).toEqual([
      'pueda',
      'puedas',
      'pueda',
      'podamos',
      'podáis',
      'puedan',
    ]);
    expect(formsOf('volver').subjunctive.slice(3, 5)).toEqual(['volvamos', 'volváis']);
    expect(formsOf('querer').subjunctive.slice(3, 5)).toEqual(['queramos', 'queráis']);
  });

  it('gives an -ir verb its preterite vowel in nosotros and vosotros', () => {
    // The distinction the -ar and -er verbs above do not have: `pidamos`, not
    // `pedamos`. It is the gerund's vowel, which is why nothing new declares it.
    expect(formsOf('pedir').subjunctive).toEqual([
      'pida',
      'pidas',
      'pida',
      'pidamos',
      'pidáis',
      'pidan',
    ]);
    expect(formsOf('dormir').subjunctive.slice(3, 5)).toEqual(['durmamos', 'durmáis']);
    expect(formsOf('sentir').subjunctive.slice(3, 5)).toEqual(['sintamos', 'sintáis']);
    expect(formsOf('preferir').subjunctive.slice(3, 5)).toEqual(['prefiramos', 'prefiráis']);
    expect(formsOf('divertir').subjunctive.slice(3, 5)).toEqual(['divirtamos', 'divirtáis']);
    expect(formsOf('morir').subjunctive.slice(3, 5)).toEqual(['muramos', 'muráis']);
  });

  it('keeps the consonant sound across every person', () => {
    // The whole paradigm, not just the boot: `empiece` and `empecemos` both.
    expect(formsOf('buscar').subjunctive.slice(0, 1)).toEqual(['busque']);
    expect(formsOf('buscar').subjunctive[3]).toBe('busquemos');
    expect(formsOf('llegar').subjunctive[3]).toBe('lleguemos');
    expect(formsOf('empezar').subjunctive).toEqual([
      'empiece',
      'empieces',
      'empiece',
      'empecemos',
      'empecéis',
      'empiecen',
    ]);
    expect(formsOf('jugar').subjunctive[3]).toBe('juguemos');
    // -guir drops the silent u and -gir writes the soft g as j, in all six.
    expect(formsOf('seguir').subjunctive).toEqual([
      'siga',
      'sigas',
      'siga',
      'sigamos',
      'sigáis',
      'sigan',
    ]);
    expect(formsOf('elegir').subjunctive[3]).toBe('elijamos');
  });

  it('keeps a declared yo form throughout, rather than undoing a stem change', () => {
    // tener declares `tengo` *and* an e-ie change: undoing the change outside
    // the boot would give `tenamos`, and ver would give `vamos` — another verb.
    expect(formsOf('tener').subjunctive).toEqual([
      'tenga',
      'tengas',
      'tenga',
      'tengamos',
      'tengáis',
      'tengan',
    ]);
    expect(formsOf('ver').subjunctive).toEqual(['vea', 'veas', 'vea', 'veamos', 'veáis', 'vean']);
    expect(formsOf('decir').subjunctive[3]).toBe('digamos');
    expect(formsOf('oír').subjunctive[3]).toBe('oigamos');
    expect(formsOf('conocer').subjunctive[3]).toBe('conozcamos');
    expect(formsOf('hacer').subjunctive[3]).toBe('hagamos');
  });

  it('declares the six that no yo form produces, and reír', () => {
    expect(formsOf('ser').subjunctive).toEqual(['sea', 'seas', 'sea', 'seamos', 'seáis', 'sean']);
    expect(formsOf('ir').subjunctive[0]).toBe('vaya');
    expect(formsOf('estar').subjunctive[0]).toBe('esté');
    expect(formsOf('haber').subjunctive[0]).toBe('haya');
    expect(formsOf('saber').subjunctive[0]).toBe('sepa');
    expect(formsOf('dar').subjunctive).toEqual(['dé', 'des', 'dé', 'demos', 'deis', 'den']);
    // reír declares one for the opposite reason: the stem loses its accent when
    // the stress moves onto the ending.
    expect(formsOf('reír').subjunctive).toEqual(['ría', 'rías', 'ría', 'riamos', 'riáis', 'rían']);
  });

  it('marks the vosotros form Spain-only, like every other paradigm', () => {
    const vosotros = conjugate('hablar').find(
      (form) =>
        form.morph.mood === 'subjunctive' &&
        form.morph.person === 2 &&
        form.morph.number === 'plural',
    );

    expect(vosotros?.form).toBe('habléis');
    expect(vosotros?.regions).toEqual(['es-ES']);
  });
});

describe('commands', () => {
  it('builds the four affirmative commands of a regular verb', () => {
    // tú is the third person present; usted and ustedes are the third person
    // singular and plural of the present subjunctive.
    expect(formsOf('hablar').commands).toEqual(['habla', 'hable', 'hablad', 'hablen']);
    expect(formsOf('comer').commands).toEqual(['come', 'coma', 'comed', 'coman']);
    expect(formsOf('vivir').commands).toEqual(['vive', 'viva', 'vivid', 'vivan']);
  });

  it('derives the formal command from the yo form, stem change and all', () => {
    // The rule a learner is taught: sigo → siga, not "sega".
    expect(formsOf('seguir').commands[1]).toBe('siga');
    expect(formsOf('pedir').commands[1]).toBe('pida');
    expect(formsOf('volver').commands[1]).toBe('vuelva');
    expect(formsOf('pensar').commands[1]).toBe('piense');
    expect(formsOf('tener').commands[1]).toBe('tenga');
    expect(formsOf('conducir').commands[1]).toBe('conduzca');
  });

  it('keeps the consonant sound before the -e ending', () => {
    expect(formsOf('buscar').commands[1]).toBe('busque');
    expect(formsOf('llegar').commands[1]).toBe('llegue');
    expect(formsOf('empezar').commands[1]).toBe('empiece');
    expect(formsOf('jugar').commands[1]).toBe('juegue');
  });

  it('shortens the eight irregular tú commands', () => {
    const tu = (lemma: string) => formsOf(lemma).commands[0];
    expect([
      tu('decir'),
      tu('hacer'),
      tu('ir'),
      tu('poner'),
      tu('salir'),
      tu('ser'),
      tu('tener'),
      tu('venir'),
    ]).toEqual(['di', 'haz', 've', 'pon', 'sal', 'sé', 'ten', 'ven']);
  });

  it('declares the formal commands whose yo form cannot produce them', () => {
    // soy → "soya" is why these six declare a subjunctive rather than deriving
    // one. They used to declare the two command forms directly; the paradigm
    // replaced that, so these values now come from `presentSubjunctive`.
    expect(formsOf('ser').commands.slice(1, 2)).toEqual(['sea']);
    expect(formsOf('ir').commands[1]).toBe('vaya');
    expect(formsOf('saber').commands[1]).toBe('sepa');
    expect(formsOf('dar').commands[1]).toBe('dé');
    expect(formsOf('estar').commands[1]).toBe('esté');
  });

  it('takes the formal commands from the subjunctive, for every verb it ships', () => {
    /*
     * The invariant that let `imperativeFormal` go. A usted command is not
     * "derived from" the third person subjunctive, it *is* that form, so the two
     * cannot be allowed to drift — and checking it across the whole shipped
     * table is what makes a hand-typed subjunctive unable to break a command
     * that used to be right.
     */
    for (const lemma of Object.keys(IRREGULAR_VERBS)) {
      const { commands, subjunctive } = formsOf(lemma);
      expect(commands[1], `${lemma} usted`).toBe(subjunctive[2]);
      expect(commands[3], `${lemma} ustedes`).toBe(subjunctive[5]);
    }
  });

  it('carries mood and person but no tense, because a command has no time', () => {
    const command = conjugate('hablar').find((form) => form.morph.mood === 'imperative');

    expect(command?.morph.tense).toBeUndefined();
    expect(command?.morph.person).toBe(2);
    expect(command?.morph.verbForm).toBe('finite');
  });

  it('marks the vosotros command as Spain-only, like the rest of vosotros', () => {
    const vosotros = conjugate('hablar').find(
      (form) => form.morph.mood === 'imperative' && form.morph.number === 'plural',
    );

    expect(vosotros?.form).toBe('hablad');
    expect(vosotros?.regions).toEqual(['es-ES']);
  });
});

describe('generated metadata', () => {
  it('marks vosotros as Spain-only and past tenses as A2', () => {
    const forms = conjugate('hablar');
    const vosotros = forms.find(
      (form) => form.morph.person === 2 && form.morph.number === 'plural',
    );
    expect(vosotros?.regions).toEqual(['es-ES']);

    const present = forms.find((form) => form.morph.tense === 'present');
    const preterite = forms.find((form) => form.morph.tense === 'preterite');
    const subjunctive = forms.find((form) => form.morph.mood === 'subjunctive');
    expect(present?.level).toBe('a1');
    expect(preterite?.level).toBe('a2');
    expect(subjunctive?.level).toBe('b1');
  });

  it('produces 42 forms per verb', () => {
    const forms = conjugate('hablar');

    // 30 finite indicative + 6 subjunctive + 4 commands + gerund + participle.
    expect(forms).toHaveLength(42);
    expect(forms.filter((form) => form.morph.mood === 'indicative')).toHaveLength(30);
    expect(forms.filter((form) => form.morph.mood === 'subjunctive')).toHaveLength(6);
    expect(forms.filter((form) => form.morph.mood === 'imperative')).toHaveLength(4);
  });

  it('gives every finite form a distinct id-worthy tense and mood', () => {
    // Two finite forms sharing a (tense, mood) key would collide in the pack:
    // `hablar-pres-1s` twice, and the second wins silently. Tense alone stopped
    // being that key when the subjunctive arrived — `present` now names two
    // paradigms — so the pair is what has to be distinct.
    const keys = conjugate('hablar')
      .filter((form) => form.morph.verbForm === 'finite' && form.morph.tense)
      .map(
        (form) => `${form.morph.tense}/${form.morph.mood}/${form.morph.person}${form.morph.number}`,
      );
    expect(new Set(keys).size).toBe(keys.length);

    const pairs = new Set(keys.map((key) => key.split('/').slice(0, 2).join('/')));
    expect([...pairs].sort()).toEqual([
      'conditional/indicative',
      'future/indicative',
      'imperfect/indicative',
      'present/indicative',
      'present/subjunctive',
      'preterite/indicative',
    ]);
  });

  it('rejects anything that is not an infinitive', () => {
    expect(() => conjugate('hablo')).toThrow();
  });
});
