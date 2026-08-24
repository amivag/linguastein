/**
 * The conjugator generates every verb form the packs ship, so it is checked
 * against known-correct paradigms — regular, stem-changing, orthographic and
 * fully irregular.
 */

import { describe, expect, it } from 'vitest';
import { conjugate, type GeneratedForm } from '../../src/languages/es/conjugation';
import { IRREGULAR_VERBS } from '../../src/languages/es/irregulars';

function formsOf(lemma: string) {
  const generated = conjugate(lemma, IRREGULAR_VERBS[lemma] ?? {});
  const tense = (name: string) =>
    generated
      .filter((form) => form.morph.tense === name && form.morph.verbForm === 'finite')
      .map((form) => form.form);
  const nonFinite = (kind: GeneratedForm['morph']['verbForm']) =>
    generated.find((form) => form.morph.verbForm === kind)?.form;

  return {
    present: tense('present'),
    preterite: tense('preterite'),
    imperfect: tense('imperfect'),
    gerund: nonFinite('gerund'),
    participle: nonFinite('participle'),
    /** tú, usted, vosotros, ustedes — the order the generator emits. */
    commands: generated.filter((form) => form.morph.mood === 'imperative').map((form) => form.form),
  };
}

/** The six forms of one tense, in person order. */
const tenseOf = (lemma: string, tense: string) =>
  conjugate(lemma, IRREGULAR_VERBS[lemma] ?? {})
    .filter((form) => form.morph.tense === tense)
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

describe('commands', () => {
  it('builds the four affirmative commands of a regular verb', () => {
    // tú is the third person present; usted and ustedes come from the yo form.
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
    // soy → "soya" is why these six are in the table rather than derived.
    expect(formsOf('ser').commands.slice(1, 2)).toEqual(['sea']);
    expect(formsOf('ir').commands[1]).toBe('vaya');
    expect(formsOf('saber').commands[1]).toBe('sepa');
    expect(formsOf('dar').commands[1]).toBe('dé');
    expect(formsOf('estar').commands[1]).toBe('esté');
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
    expect(present?.level).toBe('a1');
    expect(preterite?.level).toBe('a2');
  });

  it('produces 36 forms per verb', () => {
    const forms = conjugate('hablar');

    // 30 finite indicative + 4 commands + gerund + participle.
    expect(forms).toHaveLength(36);
    expect(forms.filter((form) => form.morph.mood === 'indicative')).toHaveLength(30);
    expect(forms.filter((form) => form.morph.mood === 'imperative')).toHaveLength(4);
  });

  it('gives every finite form a distinct id-worthy tense', () => {
    // Two tenses with no abbreviation of their own would collide in the pack:
    // `hablar-x-1s` twice, and the second wins silently.
    const tenses = new Set(
      conjugate('hablar')
        .filter((form) => form.morph.tense)
        .map((form) => form.morph.tense),
    );
    expect([...tenses].sort()).toEqual([
      'conditional',
      'future',
      'imperfect',
      'present',
      'preterite',
    ]);
  });

  it('rejects anything that is not an infinitive', () => {
    expect(() => conjugate('hablo')).toThrow();
  });
});
