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
  };
}

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

  it('produces 20 forms per verb', () => {
    expect(conjugate('hablar')).toHaveLength(20);
  });

  it('rejects anything that is not an infinitive', () => {
    expect(() => conjugate('hablo')).toThrow();
  });
});
