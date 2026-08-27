/** Small hand-built pack used across tests. Mirrors the demo dataset shape. */

import type {
  AudioClip,
  AudioId,
  ContentPack,
  ItemId,
  LearningItem,
  LexemeId,
  Morphology,
  PackId,
  PackManifest,
  Passage,
  PassageId,
  SkillId,
  Translation,
  FormId,
  InflectedForm,
} from '../../src/domain/content';
import { ContentRepository } from '../../src/domain/content';

export const id = <T extends string>(value: string): T => value as T;

export const TEST_PACK_ID = id<PackId>('test-es');

const manifest: PackManifest = {
  id: TEST_PACK_ID,
  name: 'Test Spanish',
  targetLanguage: 'es',
  version: '1.0.0',
  /*
   * The ladder, in the order it climbs, because a pack now declares its own.
   * `courseOptions` reads the order from here rather than from a `CEFR_LEVELS`
   * constant — see `docs/tasks/language-matrix.md` §7 — so a fixture with items
   * at a level it does not declare would offer no levels at all, which is the
   * same message a real pack gets from the build.
   */
  levels: ['a1', 'a2', 'b1'],
  files: [
    { kind: 'items', path: 'items.jsonl' },
    { kind: 'passages', path: 'passages.jsonl' },
    { kind: 'audio', path: 'audio-es-ES.jsonl' },
  ],
  // Deliberately partial: `everyday` is used by items but not declared, and
  // `colours` is declared but unused, so both fallback paths stay exercised.
  topics: [
    { id: 'food-drink', label: 'Food and drink', group: 'Everyday life' },
    { id: 'work', label: 'Work', group: 'Doing things' },
    { id: 'colours', label: 'Colours', group: 'Foundations' },
  ],
  voices: [
    { id: 'ana', locale: 'es-ES', label: 'Ana', review: 'reviewed' },
    { id: 'luis', locale: 'es-ES', label: 'Luis', review: 'unreviewed' },
    { id: 'mateo', locale: 'es-MX', label: 'Mateo', review: 'reviewed' },
  ],
};

const item = (
  local: string,
  text: string,
  overrides: Partial<LearningItem> = {},
): LearningItem => ({
  id: id<ItemId>(`test-es:item:${local}`),
  pack: TEST_PACK_ID,
  type: 'sentence',
  text,
  level: 'a1',
  ...overrides,
});

export const ITEMS: readonly LearningItem[] = [
  item('001', 'Tengo que trabajar.', {
    topics: ['work'],
    lexemes: [id<LexemeId>('test-es:lexeme:tener')],
    skills: [id<SkillId>('test-es:skill:tener-que')],
    examples: [id<ItemId>('test-es:item:002')],
    note: 'tener que + infinitivo',
    tokens: [
      {
        id: 't1',
        text: 'Tengo',
        lemma: 'tener',
        pos: 'VERB',
        lexeme: id<LexemeId>('test-es:lexeme:tener'),
        morph: {
          person: 1,
          number: 'singular',
          tense: 'present',
          mood: 'indicative',
          verbForm: 'finite',
        },
      },
      { id: 't2', text: 'que', pos: 'SCONJ' },
      { id: 't3', text: 'trabajar', pos: 'VERB' },
      { id: 't4', text: '.', pos: 'PUNCT' },
    ],
    annotations: [
      {
        tokens: ['t1', 't2', 't3'],
        type: 'construction',
        skill: id<SkillId>('test-es:skill:tener-que'),
      },
    ],
    audio: [
      { locale: 'es-ES', src: 'audio/es-ES/001.mp3' },
      { locale: 'es-MX', src: 'audio/es-MX/001.mp3' },
    ],
  }),
  // Tokenised as well, and deliberately without a lexeme on its verb: the
  // generated pack tokenises every sentence, so a list showing two of them has
  // two tokens called `t1` — which is what makes an item-scoped selection
  // testable. No lexeme keeps it out of the cloze generator, so adding the
  // tokens does not quietly change which exercise the composer picks for it.
  item('002', 'Tengo que irme.', {
    topics: ['everyday'],
    lexemes: [id<LexemeId>('test-es:lexeme:tener')],
    tokens: [
      { id: 't1', text: 'Tengo', pos: 'VERB' },
      { id: 't2', text: 'que', pos: 'SCONJ' },
      { id: 't3', text: 'irme', pos: 'VERB' },
      { id: 't4', text: '.', pos: 'PUNCT' },
    ],
  }),
  // Carries usage marking: casual, and addressed to someone as tú.
  item('003', '¿Tienes tiempo?', {
    topics: ['everyday'],
    register: 'colloquial',
    address: 'tu',
  }),
  // Word cards carry a lexeme and no tokens, exactly as the generated pack does
  // for all 451 of its own — which is what makes the card itself inspectable.
  item('004', 'cerveza', {
    type: 'word',
    topics: ['food-drink'],
    lexemes: [id<LexemeId>('test-es:lexeme:cerveza')],
  }),
  item('005', 'agua', {
    type: 'word',
    topics: ['food-drink'],
    lexemes: [id<LexemeId>('test-es:lexeme:agua')],
  }),
  item('006', 'pan', {
    type: 'word',
    topics: ['food-drink'],
    lexemes: [id<LexemeId>('test-es:lexeme:pan')],
  }),
  item('007', 'café', {
    type: 'word',
    topics: ['food-drink'],
    lexemes: [id<LexemeId>('test-es:lexeme:cafe')],
  }),
];

/**
 * One form of `tener`, with the morphology it actually has.
 *
 * Spelled out per form rather than defaulted, because a pack where every form
 * claims to be the same person and tense is not a shape any real pack has — and
 * it is the shape that let `cloze-choice` sample distractors across moods
 * without a test noticing. A finite present answer has to be able to find a
 * gerund in this table for the ranking to be worth asserting.
 */
const verbForm = (local: string, form: string, morph: Morphology): InflectedForm => ({
  id: id<FormId>(`test-es:form:${local}`),
  lexeme: id<LexemeId>('test-es:lexeme:tener'),
  form,
  morph,
});

const finite = (
  person: 1 | 2 | 3,
  number: 'singular' | 'plural',
  tense: Morphology['tense'] = 'present',
): Morphology => ({ person, number, tense, mood: 'indicative', verbForm: 'finite' });

/**
 * A noun's two forms, so the paradigm a sheet shows is not a verb-only feature
 * here either. `pan` is the case worth having: the plural is not the lemma plus
 * an `s`, so a fixture that only ever holds the lemma proves nothing.
 */
const nounForms = (local: string, singular: string, plural: string): InflectedForm[] => {
  const lexeme = id<LexemeId>(`test-es:lexeme:${local}`);
  const gender = 'masculine' as const;
  return [
    {
      id: id<FormId>(`test-es:form:${local}-n-sg`),
      lexeme,
      form: singular,
      morph: { gender, number: 'singular' },
    },
    {
      id: id<FormId>(`test-es:form:${local}-n-pl`),
      lexeme,
      form: plural,
      morph: { gender, number: 'plural' },
    },
  ];
};

export const TRANSLATIONS: readonly Translation[] = [
  { ref: 'test-es:item:001', lang: 'en', text: 'I have to work.' },
  { ref: 'test-es:item:002', lang: 'en', text: 'I have to go.' },
  { ref: 'test-es:item:003', lang: 'en', text: 'Do you have time?' },
  { ref: 'test-es:item:004', lang: 'en', text: 'beer' },
  { ref: 'test-es:item:005', lang: 'en', text: 'water' },
  { ref: 'test-es:item:006', lang: 'en', text: 'bread' },
  { ref: 'test-es:item:007', lang: 'en', text: 'coffee' },
  { ref: 'test-es:item:004', lang: 'de', text: 'Bier' },
  // Word-level meaning, shown when a learner taps a word inside a phrase.
  { ref: 'test-es:lexeme:tener', lang: 'en', text: 'to have' },
];

/** Two sentences read as one text, plus a two-line dialogue. */
export const PASSAGES: readonly Passage[] = [
  {
    id: id<PassageId>('test-es:passage:700001'),
    pack: TEST_PACK_ID,
    kind: 'text',
    title: 'Un día de trabajo',
    level: 'a1',
    topics: ['work'],
    items: [id<ItemId>('test-es:item:001'), id<ItemId>('test-es:item:002')],
  },
  {
    id: id<PassageId>('test-es:passage:700002'),
    pack: TEST_PACK_ID,
    kind: 'dialogue',
    title: '¿Tienes tiempo?',
    level: 'a1',
    items: [id<ItemId>('test-es:item:003'), id<ItemId>('test-es:item:002')],
    speakers: ['Ana', 'Luis'],
  },
];

/**
 * Item 001 has two voices in one locale and one in another, which is what makes
 * the resolution rules testable: locale wins over voice, and a requested voice
 * that is missing falls back rather than going silent.
 */
export const AUDIO: readonly AudioClip[] = [
  {
    id: id<AudioId>('test-es:audio:001-es-ES-ana'),
    pack: TEST_PACK_ID,
    item: id<ItemId>('test-es:item:001'),
    locale: 'es-ES',
    voice: 'ana',
    src: 'audio/es-ES/ana/001-aaaa1111.m4a',
    textHash: 'aaaa1111',
    durationMs: 1800,
  },
  {
    id: id<AudioId>('test-es:audio:001-es-ES-luis'),
    pack: TEST_PACK_ID,
    item: id<ItemId>('test-es:item:001'),
    locale: 'es-ES',
    voice: 'luis',
    src: 'audio/es-ES/luis/001-aaaa1111.m4a',
    textHash: 'aaaa1111',
    durationMs: 1950,
  },
  {
    id: id<AudioId>('test-es:audio:001-es-MX-mateo'),
    pack: TEST_PACK_ID,
    item: id<ItemId>('test-es:item:001'),
    locale: 'es-MX',
    voice: 'mateo',
    src: 'audio/es-MX/mateo/001-aaaa1111.m4a',
    textHash: 'aaaa1111',
    durationMs: 1875,
  },
];

export const TEST_PACK: ContentPack = {
  manifest,
  items: ITEMS,
  passages: PASSAGES,
  audio: AUDIO,
  lexemes: [
    { id: id<LexemeId>('test-es:lexeme:tener'), lemma: 'tener', pos: 'VERB', level: 'a1' },
    // Gender is the thing a learner needs from a Spanish noun and the only
    // grammar a word card has, so the nouns carry theirs.
    {
      id: id<LexemeId>('test-es:lexeme:cerveza'),
      lemma: 'cerveza',
      pos: 'NOUN',
      level: 'a1',
      gender: 'feminine',
    },
    { id: id<LexemeId>('test-es:lexeme:agua'), lemma: 'agua', pos: 'NOUN', level: 'a1' },
    {
      id: id<LexemeId>('test-es:lexeme:pan'),
      lemma: 'pan',
      pos: 'NOUN',
      level: 'a1',
      gender: 'masculine',
    },
    {
      id: id<LexemeId>('test-es:lexeme:cafe'),
      lemma: 'café',
      pos: 'NOUN',
      level: 'a1',
      gender: 'masculine',
    },
  ],
  senses: [],
  // Eight forms across four shapes, so a distractor ranking has something to
  // rank: same tense different person, same person different tense, and two
  // non-finite forms that must never be offered against a finite blank.
  forms: [
    verbForm('tener-1s', 'tengo', finite(1, 'singular')),
    verbForm('tener-2s', 'tienes', finite(2, 'singular')),
    verbForm('tener-3s', 'tiene', finite(3, 'singular')),
    verbForm('tener-1p', 'tenemos', finite(1, 'plural')),
    verbForm('tener-1s-pret', 'tuve', finite(1, 'singular', 'preterite')),
    verbForm('tener-3s-pret', 'tuvo', finite(3, 'singular', 'preterite')),
    verbForm('tener-ger', 'teniendo', { verbForm: 'gerund' }),
    verbForm('tener-part', 'tenido', { verbForm: 'participle' }),
    ...nounForms('pan', 'pan', 'panes'),
  ],
  skills: [
    {
      id: id<SkillId>('test-es:skill:tener-que'),
      kind: 'pattern',
      label: 'tener que + infinitivo',
    },
  ],
  translations: TRANSLATIONS,
};

export function testRepository(): ContentRepository {
  return ContentRepository.from([TEST_PACK]);
}

export const TEST_PACK_FR_ID = id<PackId>('test-fr');

/**
 * A second language, in a second pack.
 *
 * Deliberately tiny and deliberately not Spanish: the point is that nothing in
 * the app may assume one target language or one pack. It carries a level the
 * Spanish pack does not (`b1`), so a course's levels have to come from its own
 * content rather than from whatever the repository has seen.
 *
 * Its items are numbered from 101 rather than from 001, and that is the whole
 * story of `validateAcrossPacks`: two packs from one generator both start at
 * `000001`, a mission addresses an item by local id, and first-match-wins then
 * answers a Spanish mission with a French sentence. The fixture keeps the ids
 * apart so it can stand for a *valid* pair; `tests/data/across-packs.test.ts`
 * builds the colliding pair on purpose.
 */
export const TEST_PACK_FR: ContentPack = {
  manifest: {
    id: TEST_PACK_FR_ID,
    name: 'Test French',
    targetLanguage: 'fr',
    version: '1.0.0',
    levels: ['a1', 'a2', 'b1'],
    files: [{ kind: 'items', path: 'items.jsonl' }],
    topics: [{ id: 'greetings', label: 'Greetings', group: 'People' }],
  },
  items: [
    {
      id: id<ItemId>('test-fr:item:101'),
      pack: TEST_PACK_FR_ID,
      type: 'sentence',
      text: 'Je dois travailler.',
      level: 'a1',
      topics: ['greetings'],
    },
    {
      id: id<ItemId>('test-fr:item:102'),
      pack: TEST_PACK_FR_ID,
      type: 'word',
      text: 'bonjour',
      level: 'b1',
      topics: ['greetings'],
    },
  ],
  lexemes: [],
  senses: [],
  forms: [],
  skills: [],
  translations: [
    { ref: 'test-fr:item:101', lang: 'en', text: 'I have to work.' },
    { ref: 'test-fr:item:102', lang: 'en', text: 'hello' },
  ],
  passages: [],
  audio: [],
};

/** Both packs, for anything that has to hold with more than one language loaded. */
export function multilingualRepository(): ContentRepository {
  return ContentRepository.from([TEST_PACK, TEST_PACK_FR]);
}
