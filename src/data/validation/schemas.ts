/**
 * The validation boundary. Everything entering the app from a dataset file is
 * parsed here; nothing downstream may assume unvalidated shapes.
 *
 * These schemas mirror `src/domain/content/model.ts`. They are intentionally
 * permissive about *extra* fields — datasets may carry richer annotation than
 * this version of the app understands (spec §15) — and strict about the fields
 * the engine relies on.
 */

import { z } from 'zod';
import {
  ADDRESS_FORMS,
  ANNOTATION_TYPES,
  CASES,
  CEFR_LEVELS,
  ENTITY_KINDS,
  ITEM_TYPES,
  MOODS,
  PACK_FILE_KINDS,
  PASSAGE_KINDS,
  POS_TAGS,
  PROVENANCE_SOURCES,
  REGISTERS,
  REVIEW_STATES,
  SKILL_KINDS,
  TENSES,
  TRANSLATION_TYPES,
  VERB_FORMS,
} from '../../domain/content';

const entityIdPattern = new RegExp(
  `^[a-z0-9]+(?:-[a-z0-9]+)*:(?:${ENTITY_KINDS.join('|')}):[^\\s:]+$`,
);

const entityId = (kind: (typeof ENTITY_KINDS)[number]) =>
  z.string().regex(new RegExp(`^[a-z0-9]+(?:-[a-z0-9]+)*:${kind}:[^\\s:]+$`), {
    message: `expected a "${kind}" id such as core-es:${kind}:example`,
  });

const anyEntityId = z.string().regex(entityIdPattern, { message: 'expected a namespaced id' });
const languageTag = z.string().regex(/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/, {
  message: 'expected a BCP 47 language tag',
});
const packId = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

/** Rejects `/x`, `C:\x`, `https://x` and `../x`: a pack must stay portable. */
const notAbsolute = (path: string): boolean =>
  !/^([a-zA-Z]:[\\/]|[\\/]|[a-zA-Z][a-zA-Z0-9+.-]*:)/.test(path) &&
  !path.split(/[\\/]/).includes('..');
const level = z.enum(CEFR_LEVELS);

export const provenanceSchema = z
  .object({
    source: z.enum(PROVENANCE_SOURCES),
    origin: z.string().optional(),
    license: z.string().optional(),
    review: z.enum(REVIEW_STATES).optional(),
    revision: z.number().int().nonnegative().optional(),
    replacedBy: anyEntityId.optional(),
  })
  .loose();

export const morphologySchema = z
  .object({
    person: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
    number: z.enum(['singular', 'plural']).optional(),
    gender: z.enum(['masculine', 'feminine', 'neuter']).optional(),
    tense: z.enum(TENSES).optional(),
    mood: z.enum(MOODS).optional(),
    verbForm: z.enum(VERB_FORMS).optional(),
    case: z.enum(CASES).optional(),
    degree: z.enum(['positive', 'comparative', 'superlative']).optional(),
    formality: z.enum(['informal', 'formal']).optional(),
  })
  .loose();

export const tokenSchema = z
  .object({
    id: z.string().min(1),
    text: z.string().min(1),
    reading: z.string().optional(),
    lemma: z.string().optional(),
    pos: z.enum(POS_TAGS).optional(),
    morph: morphologySchema.optional(),
    lexeme: entityId('lexeme').optional(),
  })
  .loose();

export const annotationSchema = z
  .object({
    tokens: z.array(z.string().min(1)).min(1),
    type: z.enum(ANNOTATION_TYPES),
    skill: entityId('skill').optional(),
    label: z.string().optional(),
  })
  .loose();

export const audioRefSchema = z
  .object({
    locale: languageTag,
    src: z.string().min(1),
    durationMs: z.number().positive().optional(),
    voice: z.string().optional(),
    provenance: provenanceSchema.optional(),
  })
  .loose();

export const learningItemSchema = z
  .object({
    id: entityId('item'),
    pack: packId,
    type: z.enum(ITEM_TYPES),
    text: z.string().min(1),
    reading: z.string().optional(),
    level: level.optional(),
    register: z.enum(REGISTERS).optional(),
    address: z.enum(ADDRESS_FORMS).optional(),
    regions: z.array(languageTag).optional(),
    topics: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    tokens: z.array(tokenSchema).optional(),
    annotations: z.array(annotationSchema).optional(),
    lexemes: z.array(entityId('lexeme')).optional(),
    skills: z.array(entityId('skill')).optional(),
    examples: z.array(entityId('item')).optional(),
    audio: z.array(audioRefSchema).optional(),
    note: z.string().optional(),
    provenance: provenanceSchema.optional(),
  })
  .loose();

export const lexemeSchema = z
  .object({
    id: entityId('lexeme'),
    lemma: z.string().min(1),
    pos: z.enum(POS_TAGS),
    level: level.optional(),
    frequencyRank: z.number().int().positive().optional(),
    register: z.enum(REGISTERS).optional(),
    regions: z.array(languageTag).optional(),
    gender: z.enum(['masculine', 'feminine', 'neuter']).optional(),
    tags: z.array(z.string()).optional(),
    provenance: provenanceSchema.optional(),
  })
  .loose();

export const senseSchema = z
  .object({
    id: entityId('sense'),
    lexeme: entityId('lexeme'),
    label: z.string().optional(),
    register: z.enum(REGISTERS).optional(),
    regions: z.array(languageTag).optional(),
    skills: z.array(entityId('skill')).optional(),
    provenance: provenanceSchema.optional(),
  })
  .loose();

export const inflectedFormSchema = z
  .object({
    id: entityId('form'),
    lexeme: entityId('lexeme'),
    form: z.string().min(1),
    morph: morphologySchema,
    level: level.optional(),
    regions: z.array(languageTag).optional(),
    provenance: provenanceSchema.optional(),
  })
  .loose();

export const skillSchema = z
  .object({
    id: entityId('skill'),
    kind: z.enum(SKILL_KINDS),
    label: z.string().min(1),
    level: level.optional(),
    prerequisites: z.array(entityId('skill')).optional(),
    provenance: provenanceSchema.optional(),
  })
  .loose();

export const translationSchema = z
  .object({
    ref: anyEntityId,
    lang: languageTag,
    text: z.string().min(1),
    type: z.enum(TRANSLATION_TYPES).optional(),
    note: z.string().optional(),
    provenance: provenanceSchema.optional(),
  })
  .loose();

export const passageSchema = z
  .object({
    id: entityId('passage'),
    pack: packId,
    kind: z.enum(PASSAGE_KINDS),
    title: z.string().min(1),
    level: level.optional(),
    topics: z.array(z.string()).optional(),
    regions: z.array(languageTag).optional(),
    // Two sentences is the minimum that makes a passage worth having; one is
    // just an item with extra steps.
    items: z.array(entityId('item')).min(2),
    speakers: z.array(z.string()).optional(),
    provenance: provenanceSchema.optional(),
  })
  .loose();

export const packFileSchema = z
  .object({
    kind: z.enum(PACK_FILE_KINDS),
    path: z.string().min(1),
  })
  .loose();

/**
 * One recording of one item. A separate record rather than a field on the item,
 * so a voice can be added without rewriting content and several voices can
 * coexist for the same phrase.
 */
export const audioClipSchema = z
  .object({
    id: entityId('audio'),
    pack: packId,
    item: entityId('item'),
    locale: languageTag,
    voice: z.string().min(1),
    // Relative to the pack root. An absolute path or URL would defeat exporting
    // a pack as a self-contained unit.
    src: z.string().min(1).refine(notAbsolute, { message: 'must be relative to the pack root' }),
    textHash: z.string().min(4),
    durationMs: z.number().positive().optional(),
    provenance: provenanceSchema.optional(),
  })
  .loose();

export const packVoiceSchema = z
  .object({
    id: z.string().min(1),
    locale: languageTag,
    label: z.string().optional(),
    provider: z.string().optional(),
    license: z.string().optional(),
    review: z.enum(REVIEW_STATES).optional(),
  })
  .loose();

export const packTopicSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    group: z.string().optional(),
  })
  .loose();

export const packAuthorSchema = z
  .object({
    name: z.string().min(1),
    role: z.string().optional(),
    url: z.string().optional(),
  })
  .loose();

/**
 * `YYYY-MM-DD`, and a real day.
 *
 * The pattern alone would accept `2026-02-31`, so the round trip is what makes it
 * a date: parsing and re-formatting has to give back the same string. A pack
 * claiming a day that does not exist is a pack whose provenance cannot be trusted
 * on anything else either.
 */
const isoDate = z.string().refine(
  (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
  },
  { message: 'expected a real YYYY-MM-DD date' },
);

export const packManifestSchema = z
  .object({
    id: packId,
    name: z.string().min(1),
    targetLanguage: languageTag,
    version: z.string().min(1),
    updated: isoDate.optional(),
    authors: z.array(packAuthorSchema).optional(),
    description: z.string().optional(),
    license: z.string().optional(),
    levels: z.array(level).optional(),
    referenceLanguages: z.array(languageTag).optional(),
    pronunciationLocales: z.array(languageTag).optional(),
    topics: z.array(packTopicSchema).optional(),
    voices: z.array(packVoiceSchema).optional(),
    files: z.array(packFileSchema),
    provenance: provenanceSchema.optional(),
  })
  .loose();

/** Registry mapping a pack file kind to the schema for one record. */
export const RECORD_SCHEMAS = {
  items: learningItemSchema,
  lexemes: lexemeSchema,
  senses: senseSchema,
  forms: inflectedFormSchema,
  skills: skillSchema,
  translations: translationSchema,
  passages: passageSchema,
  audio: audioClipSchema,
} as const satisfies Record<(typeof PACK_FILE_KINDS)[number], z.ZodType>;

export type RecordKind = keyof typeof RECORD_SCHEMAS;
