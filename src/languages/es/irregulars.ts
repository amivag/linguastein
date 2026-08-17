/**
 * Declared irregularity for the verbs the Spanish packs ship.
 *
 * Only genuine irregularity lives here; predictable spelling changes
 * (busc- → busqué, lleg- → llegué, le- → leyó) are handled by the rules in
 * `conjugation.ts`. A verb absent from this table is fully regular, and the
 * dataset build fails loudly if a verb needs an entry it does not have.
 */

import type { Irregularity } from './conjugation';

export const IRREGULAR_VERBS: Readonly<Record<string, Irregularity>> = {
  // ── Fully irregular ────────────────────────────────────────────────────
  ser: {
    present: ['soy', 'eres', 'es', 'somos', 'sois', 'son'],
    preterite: ['fui', 'fuiste', 'fue', 'fuimos', 'fuisteis', 'fueron'],
    imperfect: ['era', 'eras', 'era', 'éramos', 'erais', 'eran'],
    gerund: 'siendo',
    participle: 'sido',
    imperativeTu: 'sé',
    imperativeFormal: ['sea', 'sean'],
  },
  ir: {
    present: ['voy', 'vas', 'va', 'vamos', 'vais', 'van'],
    preterite: ['fui', 'fuiste', 'fue', 'fuimos', 'fuisteis', 'fueron'],
    imperfect: ['iba', 'ibas', 'iba', 'íbamos', 'ibais', 'iban'],
    gerund: 'yendo',
    participle: 'ido',
    imperativeTu: 've',
    imperativeFormal: ['vaya', 'vayan'],
  },
  estar: {
    present: ['estoy', 'estás', 'está', 'estamos', 'estáis', 'están'],
    preteriteStem: 'estuv',
    imperativeFormal: ['esté', 'estén'],
  },
  haber: {
    present: ['he', 'has', 'ha', 'hemos', 'habéis', 'han'],
    preteriteStem: 'hub',
    imperativeFormal: ['haya', 'hayan'],
  },
  ver: {
    yo: 'veo',
    preterite: ['vi', 'viste', 'vio', 'vimos', 'visteis', 'vieron'],
    imperfect: ['veía', 'veías', 'veía', 'veíamos', 'veíais', 'veían'],
    participle: 'visto',
  },
  dar: {
    yo: 'doy',
    preterite: ['di', 'diste', 'dio', 'dimos', 'disteis', 'dieron'],
    imperativeFormal: ['dé', 'den'],
  },

  // ── Irregular yo + strong preterite ────────────────────────────────────
  tener: { stemChange: 'e-ie', yo: 'tengo', preteriteStem: 'tuv', imperativeTu: 'ten' },
  venir: {
    stemChange: 'e-ie',
    yo: 'vengo',
    preteriteStem: 'vin',
    gerund: 'viniendo',
    imperativeTu: 'ven',
  },
  poner: { yo: 'pongo', preteriteStem: 'pus', participle: 'puesto', imperativeTu: 'pon' },
  hacer: { yo: 'hago', preteriteStem: 'hic', participle: 'hecho', imperativeTu: 'haz' },
  decir: {
    stemChange: 'e-i',
    yo: 'digo',
    preteriteStem: 'dij',
    participle: 'dicho',
    preteriteStemChange: 'e-i',
    imperativeTu: 'di',
  },
  traer: { yo: 'traigo', preteriteStem: 'traj', gerund: 'trayendo', participle: 'traído' },
  salir: { yo: 'salgo', imperativeTu: 'sal' },
  saber: { yo: 'sé', preteriteStem: 'sup', imperativeFormal: ['sepa', 'sepan'] },
  caer: { yo: 'caigo' },
  oír: { present: ['oigo', 'oyes', 'oye', 'oímos', 'oís', 'oyen'] },
  conocer: { yo: 'conozco' },
  parecer: { yo: 'parezco' },
  ofrecer: { yo: 'ofrezco' },
  nacer: { yo: 'nazco' },
  conducir: { yo: 'conduzco', preteriteStem: 'conduj' },
  traducir: { yo: 'traduzco', preteriteStem: 'traduj' },
  andar: { preteriteStem: 'anduv' },
  poder: { stemChange: 'o-ue', preteriteStem: 'pud', gerund: 'pudiendo' },
  querer: { stemChange: 'e-ie', preteriteStem: 'quis' },

  // ── Stem-changing: e → ie ──────────────────────────────────────────────
  pensar: { stemChange: 'e-ie' },
  empezar: { stemChange: 'e-ie' },
  recomendar: { stemChange: 'e-ie' },
  comenzar: { stemChange: 'e-ie' },
  entender: { stemChange: 'e-ie' },
  perder: { stemChange: 'e-ie' },
  cerrar: { stemChange: 'e-ie' },
  despertar: { stemChange: 'e-ie' },
  sentar: { stemChange: 'e-ie' },
  preferir: { stemChange: 'e-ie', preteriteStemChange: 'e-i' },
  sentir: { stemChange: 'e-ie', preteriteStemChange: 'e-i' },
  divertir: { stemChange: 'e-ie', preteriteStemChange: 'e-i' },
  nevar: { stemChange: 'e-ie' },

  // ── Stem-changing: o → ue ──────────────────────────────────────────────
  volver: { stemChange: 'o-ue', participle: 'vuelto' },
  contar: { stemChange: 'o-ue' },
  acostar: { stemChange: 'o-ue' },
  doler: { stemChange: 'o-ue' },
  encontrar: { stemChange: 'o-ue' },
  recordar: { stemChange: 'o-ue' },
  costar: { stemChange: 'o-ue' },
  dormir: { stemChange: 'o-ue', preteriteStemChange: 'o-u' },
  morir: { stemChange: 'o-ue', preteriteStemChange: 'o-u', participle: 'muerto' },
  probar: { stemChange: 'o-ue' },
  mostrar: { stemChange: 'o-ue' },
  almorzar: { stemChange: 'o-ue' },
  llover: { stemChange: 'o-ue' },
  soler: { stemChange: 'o-ue' },
  jugar: { stemChange: 'u-ue' },

  // ── Stem-changing: e → i ───────────────────────────────────────────────
  pedir: { stemChange: 'e-i', preteriteStemChange: 'e-i' },
  seguir: { stemChange: 'e-i', preteriteStemChange: 'e-i' },
  conseguir: { stemChange: 'e-i', preteriteStemChange: 'e-i' },
  repetir: { stemChange: 'e-i', preteriteStemChange: 'e-i' },
  servir: { stemChange: 'e-i', preteriteStemChange: 'e-i' },
  vestir: { stemChange: 'e-i', preteriteStemChange: 'e-i' },
  elegir: { stemChange: 'e-i', preteriteStemChange: 'e-i' },
  reír: { present: ['río', 'ríes', 'ríe', 'reímos', 'reís', 'ríen'], preteriteStemChange: 'e-i' },

  // ── Irregular participle only ──────────────────────────────────────────
  abrir: { participle: 'abierto' },
  escribir: { participle: 'escrito' },
  romper: { participle: 'roto' },
  descubrir: { participle: 'descubierto' },
  devolver: { stemChange: 'o-ue', participle: 'devuelto' },
};

/**
 * Verbs the dataset declares as irregular must appear above, and vice versa.
 * The build cross-checks the two, so a verb tagged `irregular` in the source
 * with no entry here fails loudly instead of silently generating `podo`.
 */
export function isDeclaredIrregular(lemma: string): boolean {
  return Object.hasOwn(IRREGULAR_VERBS, lemma);
}
