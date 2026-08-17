/** Small hand-built pack used across tests. Mirrors the demo dataset shape. */

import type {
  ContentPack,
  ItemId,
  LearningItem,
  LexemeId,
  PackId,
  PackManifest,
  SkillId,
  Translation,
  VerbForm,
  VerbFormId,
} from '../../src/domain/content';
import { ContentRepository } from '../../src/domain/content';

export const id = <T extends string>(value: string): T => value as T;

export const TEST_PACK_ID = id<PackId>('test-es');

const manifest: PackManifest = {
  id: TEST_PACK_ID,
  name: 'Test Spanish',
  targetLanguage: 'es',
  version: '1.0.0',
  files: [{ kind: 'items', path: 'items.jsonl' }],
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
  item('002', 'Tengo que irme.', { topics: ['everyday'] }),
  item('003', '¿Tienes tiempo?', { topics: ['everyday'] }),
  item('004', 'cerveza', { type: 'word', topics: ['food-drink'] }),
  item('005', 'agua', { type: 'word', topics: ['food-drink'] }),
  item('006', 'pan', { type: 'word', topics: ['food-drink'] }),
  item('007', 'café', { type: 'word', topics: ['food-drink'] }),
];

const verbForm = (local: string, form: string): VerbForm => ({
  id: id<VerbFormId>(`test-es:form:${local}`),
  lexeme: id<LexemeId>('test-es:lexeme:tener'),
  form,
  morph: { tense: 'present', mood: 'indicative', verbForm: 'finite' },
});

export const TRANSLATIONS: readonly Translation[] = [
  { ref: 'test-es:item:001', lang: 'en', text: 'I have to work.' },
  { ref: 'test-es:item:002', lang: 'en', text: 'I have to go.' },
  { ref: 'test-es:item:003', lang: 'en', text: 'Do you have time?' },
  { ref: 'test-es:item:004', lang: 'en', text: 'beer' },
  { ref: 'test-es:item:005', lang: 'en', text: 'water' },
  { ref: 'test-es:item:006', lang: 'en', text: 'bread' },
  { ref: 'test-es:item:007', lang: 'en', text: 'coffee' },
  { ref: 'test-es:item:004', lang: 'de', text: 'Bier' },
];

export const TEST_PACK: ContentPack = {
  manifest,
  items: ITEMS,
  lexemes: [{ id: id<LexemeId>('test-es:lexeme:tener'), lemma: 'tener', pos: 'VERB', level: 'a1' }],
  senses: [],
  verbForms: [
    verbForm('tener-1s', 'tengo'),
    verbForm('tener-2s', 'tienes'),
    verbForm('tener-3s', 'tiene'),
    verbForm('tener-1p', 'tenemos'),
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
