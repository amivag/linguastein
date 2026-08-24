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
    presentSubjunctive: ['sea', 'seas', 'sea', 'seamos', 'seáis', 'sean'],
  },
  ir: {
    present: ['voy', 'vas', 'va', 'vamos', 'vais', 'van'],
    preterite: ['fui', 'fuiste', 'fue', 'fuimos', 'fuisteis', 'fueron'],
    imperfect: ['iba', 'ibas', 'iba', 'íbamos', 'ibais', 'iban'],
    gerund: 'yendo',
    participle: 'ido',
    imperativeTu: 've',
    presentSubjunctive: ['vaya', 'vayas', 'vaya', 'vayamos', 'vayáis', 'vayan'],
  },
  estar: {
    present: ['estoy', 'estás', 'está', 'estamos', 'estáis', 'están'],
    preteriteStem: 'estuv',
    presentSubjunctive: ['esté', 'estés', 'esté', 'estemos', 'estéis', 'estén'],
  },
  haber: {
    futureStem: 'habr',
    present: ['he', 'has', 'ha', 'hemos', 'habéis', 'han'],
    preteriteStem: 'hub',
    presentSubjunctive: ['haya', 'hayas', 'haya', 'hayamos', 'hayáis', 'hayan'],
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
    presentSubjunctive: ['dé', 'des', 'dé', 'demos', 'deis', 'den'],
  },

  // ── Irregular yo + strong preterite ────────────────────────────────────
  tener: {
    futureStem: 'tendr',
    stemChange: 'e-ie',
    yo: 'tengo',
    preteriteStem: 'tuv',
    imperativeTu: 'ten',
  },
  venir: {
    futureStem: 'vendr',
    stemChange: 'e-ie',
    yo: 'vengo',
    preteriteStem: 'vin',
    gerund: 'viniendo',
    imperativeTu: 'ven',
  },
  poner: {
    futureStem: 'pondr',
    yo: 'pongo',
    preteriteStem: 'pus',
    participle: 'puesto',
    imperativeTu: 'pon',
  },
  hacer: {
    futureStem: 'har',
    yo: 'hago',
    preteriteStem: 'hic',
    participle: 'hecho',
    imperativeTu: 'haz',
  },
  decir: {
    futureStem: 'dir',
    stemChange: 'e-i',
    yo: 'digo',
    preteriteStem: 'dij',
    participle: 'dicho',
    preteriteStemChange: 'e-i',
    imperativeTu: 'di',
  },
  mantener: {
    futureStem: 'mantendr',
    stemChange: 'e-ie',
    yo: 'mantengo',
    preteriteStem: 'mantuv',
    imperativeTu: 'mantén',
  },
  suponer: {
    futureStem: 'supondr',
    yo: 'supongo',
    preteriteStem: 'supus',
    participle: 'supuesto',
    imperativeTu: 'supón',
  },
  proponer: {
    futureStem: 'propondr',
    yo: 'propongo',
    preteriteStem: 'propus',
    participle: 'propuesto',
    imperativeTu: 'propón',
  },
  traer: { yo: 'traigo', preteriteStem: 'traj', gerund: 'trayendo', participle: 'traído' },
  salir: { futureStem: 'saldr', yo: 'salgo', imperativeTu: 'sal' },
  saber: {
    futureStem: 'sabr',
    yo: 'sé',
    preteriteStem: 'sup',
    presentSubjunctive: ['sepa', 'sepas', 'sepa', 'sepamos', 'sepáis', 'sepan'],
  },
  caer: { yo: 'caigo' },
  valer: { futureStem: 'valdr', yo: 'valgo' },
  oír: { present: ['oigo', 'oyes', 'oye', 'oímos', 'oís', 'oyen'] },
  // Not the -zco pattern below, though it looks like it: the c of `vencer`
  // simply becomes z before a back vowel. `convenzo`, never `convenzco`.
  convencer: { yo: 'convenzo' },
  conocer: { yo: 'conozco' },
  // Like conocer: the -zco first person is the whole of its irregularity.
  apetecer: { yo: 'apetezco' },
  parecer: { yo: 'parezco' },
  ofrecer: { yo: 'ofrezco' },
  nacer: { yo: 'nazco' },
  agradecer: { yo: 'agradezco' },
  conducir: { yo: 'conduzco', preteriteStem: 'conduj' },
  traducir: { yo: 'traduzco', preteriteStem: 'traduj' },
  reducir: { yo: 'reduzco', preteriteStem: 'reduj' },
  andar: { preteriteStem: 'anduv' },
  poder: { futureStem: 'podr', stemChange: 'o-ue', preteriteStem: 'pud', gerund: 'pudiendo' },
  querer: { futureStem: 'querr', stemChange: 'e-ie', preteriteStem: 'quis' },

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
  sugerir: { stemChange: 'e-ie', preteriteStemChange: 'e-i' },
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
  aprobar: { stemChange: 'o-ue' },
  resolver: { stemChange: 'o-ue', participle: 'resuelto' },
  jugar: { stemChange: 'u-ue' },

  // ── Stem-changing: e → i ───────────────────────────────────────────────
  pedir: { stemChange: 'e-i', preteriteStemChange: 'e-i' },
  seguir: { stemChange: 'e-i', preteriteStemChange: 'e-i' },
  conseguir: { stemChange: 'e-i', preteriteStemChange: 'e-i' },
  repetir: { stemChange: 'e-i', preteriteStemChange: 'e-i' },
  servir: { stemChange: 'e-i', preteriteStemChange: 'e-i' },
  vestir: { stemChange: 'e-i', preteriteStemChange: 'e-i' },
  elegir: { stemChange: 'e-i', preteriteStemChange: 'e-i' },
  impedir: { stemChange: 'e-i', preteriteStemChange: 'e-i' },
  despedir: { stemChange: 'e-i', preteriteStemChange: 'e-i' },
  reír: {
    present: ['río', 'ríes', 'ríe', 'reímos', 'reís', 'ríen'],
    preteriteStemChange: 'e-i',
    // The only verb here whose subjunctive is declared for a reason other than
    // an unusable yo form: `río` is a fine stem, but the written accent belongs
    // to the stressed `í` and nosotros/vosotros move the stress onto the ending
    // — `riamos`, not `ríamos`. No rule in `conjugation.ts` predicts a stem
    // *losing* an accent, and inventing one for a single verb would be worse.
    presentSubjunctive: ['ría', 'rías', 'ría', 'riamos', 'riáis', 'rían'],
  },

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
