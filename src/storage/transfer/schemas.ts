/**
 * The shape of an exported file, checked on the way in.
 *
 * An exported file is a file a person can open in a text editor, so it is
 * untrusted input by definition — the asymmetry `storage/schemas.ts` was written
 * to close, now load-bearing. The precedent it copies is `src/data/validation`:
 * **report and skip, never throw.** An import that drops three malformed
 * attempts and says so is better than one that refuses a whole year, and much
 * better than one that writes them.
 *
 * Two things are refused outright rather than repaired, and they are the two
 * where repair would be a guess: a file from another app, and a file whose
 * format is newer than this build can read. Neither is a damaged record — one is
 * somebody else's data and the other is a promise this build cannot keep.
 *
 * `ImportIssue` is its own type rather than `ValidationIssue` from
 * `src/data/validation`. That one is about a *pack* — it carries a file name and
 * a line number, because a dataset is authored as JSONL and a reader needs to
 * find the row. Here the location is a record id, and the reader is a learner
 * looking at a dialog rather than a contributor at a build log.
 */

import { z } from 'zod';
import type { BatchDefinition } from '../../domain/batches';
import {
  isEntityId,
  LEVEL_SCOPE_ALL,
  type EntityId,
  type ItemId,
  type PackId,
} from '../../domain/content';
import { EXERCISE_KINDS } from '../../domain/exercises/types';
import {
  ITEM_STATUSES,
  REVIEW_GRADES,
  type Attempt,
  type SubjectProgress,
} from '../../domain/progress';
import type { SessionRecord } from '../../domain/sessions';

export type ImportIssueSeverity = 'error' | 'warning';

export interface ImportIssue {
  readonly severity: ImportIssueSeverity;
  /** Which part of the file: `attempts`, `progress`, `preferences`… */
  readonly section: string;
  /** The record's own id, where it had a readable one. */
  readonly id?: string;
  readonly message: string;
}

const timestamp = z.number().int().nonnegative();
const languageTag = z.string().regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/);

/**
 * `core-es:item:000123`, `core-es:form:ser-pres-1s`,
 * `core-es:skill:numerals-y-joining` — checked for the shape, not for the kind.
 *
 * **Any entity**, because `SubjectProgress.subject` is any entity: a numeral
 * drill records against a pattern and a form drill against a form, so a schema
 * insisting on `item` would refuse exactly the rows this format now exists to
 * carry.
 *
 * Whether the pack is installed is a different question and deliberately not
 * asked here: architecture rule 4 exists so a row can outlive the pack it names,
 * and the importer counts those rather than dropping them. What is worth
 * refusing is a string that is not an entity id at all, because that is the one
 * that reaches the repository and the progress store as a key.
 */
const entityId = z.string().refine((value) => isEntityId(value), {
  message: 'not an entity id',
});

/**
 * How a history row says what it is about, in both spellings the format has had.
 *
 * `subject` is v2's. `itemId` is v1's, and reading it is the whole of the
 * compatibility shim — the reason the envelope carries a version at all. Every
 * row in a v1 file is about an item, so nothing is lost: it simply arrives under
 * the name it had.
 */
const subjectFields = {
  subject: entityId.optional(),
  itemId: entityId.optional(),
};

function subjectOf(row: {
  readonly subject?: string | undefined;
  readonly itemId?: string | undefined;
}): EntityId | undefined {
  return (row.subject ?? row.itemId) as EntityId | undefined;
}

/** The issue a row with neither spelling produces, in one place. */
const NO_SUBJECT = 'no subject: the row has neither `subject` nor `itemId`';

/**
 * The optional fields, rebuilt with the conditional spread `exactOptionalPropertyTypes`
 * requires. Zod hands back `{ endedAt: undefined }` for an absent key, which is a
 * different thing from an absent key to both the compiler and IndexedDB.
 */
function optional<T>(key: string, value: T | undefined): Record<string, T> {
  return value === undefined ? {} : ({ [key]: value } as Record<string, T>);
}

/**
 * A course, as a session and a batch both record one.
 *
 * `level` is a bare string rather than an enum for the reason
 * `storage/schemas.ts` gives: the ladder belongs to the pack, so `b1` is not a
 * value this file gets to police.
 */
const course = z.object({
  language: languageTag,
  level: z.union([z.literal(LEVEL_SCOPE_ALL), z.string().min(1)]),
});

/**
 * The authority. Everything else in the file is either a projection over this or
 * a setting, so this is the schema worth being strict about — an attempt that
 * cannot be read is evidence that cannot be recovered.
 */
export const attemptSchema = z
  .object({
    id: z.string().min(1),
    ...subjectFields,
    exerciseKind: z.enum(EXERCISE_KINDS),
    grade: z.enum(REVIEW_GRADES),
    at: timestamp,
    correct: z.boolean().optional(),
    latencyMs: z.number().nonnegative().optional(),
    hintsUsed: z.number().int().nonnegative().optional(),
    sessionId: z.string().min(1).optional(),
  })
  .transform((row, ctx): Attempt => {
    const subject = subjectOf(row);
    if (!subject) {
      ctx.addIssue({ code: 'custom', message: NO_SUBJECT });
      return z.NEVER;
    }
    return {
      id: row.id,
      subject,
      exerciseKind: row.exerciseKind,
      grade: row.grade,
      at: row.at,
      ...optional('correct', row.correct),
      ...optional('latencyMs', row.latencyMs),
      ...optional('hintsUsed', row.hintsUsed),
      ...optional('sessionId', row.sessionId),
    };
  });

/**
 * The projection. Read leniently on purpose: a row that survives here is only a
 * starting point, because any item with attempts in the merged log is rebuilt
 * from that log rather than from this.
 */
export const progressSchema = z
  .object({
    ...subjectFields,
    packId: z.string().min(1).optional(),
    status: z.enum(ITEM_STATUSES),
    attempts: z.number().int().nonnegative(),
    correct: z.number().int().nonnegative(),
    incorrect: z.number().int().nonnegative(),
    difficulty: z.number().min(0).max(1),
    stability: z.number().nonnegative().optional(),
    lastReviewedAt: timestamp.optional(),
    dueAt: timestamp.optional(),
    averageLatencyMs: z.number().nonnegative().optional(),
    hintsUsed: z.number().int().nonnegative(),
    streak: z.number().int().nonnegative(),
    updatedAt: timestamp,
  })
  .transform((row, ctx): SubjectProgress => {
    const subject = subjectOf(row);
    if (!subject) {
      ctx.addIssue({ code: 'custom', message: NO_SUBJECT });
      return z.NEVER;
    }
    return {
      subject,
      ...optional<PackId>('packId', row.packId as PackId | undefined),
      status: row.status,
      attempts: row.attempts,
      correct: row.correct,
      incorrect: row.incorrect,
      difficulty: row.difficulty,
      ...optional('stability', row.stability),
      ...optional('lastReviewedAt', row.lastReviewedAt),
      ...optional('dueAt', row.dueAt),
      ...optional('averageLatencyMs', row.averageLatencyMs),
      hintsUsed: row.hintsUsed,
      streak: row.streak,
      updatedAt: row.updatedAt,
    };
  });

export const sessionSchema = z
  .object({
    id: z.string().min(1),
    course,
    startedAt: timestamp,
    endedAt: timestamp.optional(),
    planned: z.number().int().nonnegative(),
    completed: z.number().int().nonnegative(),
    correct: z.number().int().nonnegative(),
  })
  .transform((row): SessionRecord => ({
    id: row.id,
    course: row.course,
    startedAt: row.startedAt,
    ...optional('endedAt', row.endedAt),
    planned: row.planned,
    completed: row.completed,
    correct: row.correct,
  }));

export const batchSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    course,
    itemIds: z.array(entityId),
    createdAt: timestamp,
    perSession: z.number().int().positive().optional(),
  })
  .transform((row): BatchDefinition => ({
    id: row.id,
    label: row.label,
    course: row.course,
    itemIds: row.itemIds as ItemId[],
    createdAt: row.createdAt,
    ...optional('perSession', row.perSession),
  }));

export const packSchema = z.object({ id: z.string().min(1), version: z.string().min(1) });

/**
 * The envelope's own fields — everything except the four record lists and the
 * two settings records, which are read one entry at a time so that one bad row
 * costs one row.
 */
export const envelopeSchema = z.object({
  app: z.string().min(1),
  schema: z.number().int().positive(),
  exportedAt: timestamp,
  // Absent on a file this build did not write; reported rather than refused,
  // since a missing scheduler id is a file that does not say, not a file that
  // says something wrong.
  scheduler: z.string().min(1).optional(),
  packs: z.array(packSchema).optional(),
});

/**
 * One list, checked row by row.
 *
 * The rows that parse come back; the ones that do not become issues naming their
 * own id, which is what makes a report a learner can act on rather than a count.
 */
export function readRows<T>(
  schema: z.ZodType<T>,
  section: string,
  value: unknown,
): { readonly rows: readonly T[]; readonly issues: readonly ImportIssue[] } {
  if (!Array.isArray(value)) {
    return value === undefined
      ? { rows: [], issues: [] }
      : {
          rows: [],
          issues: [{ severity: 'warning', section, message: `${section} is not a list; skipped` }],
        };
  }

  const rows: T[] = [];
  const issues: ImportIssue[] = [];
  for (const entry of value) {
    const parsed = schema.safeParse(entry);
    if (parsed.success) {
      rows.push(parsed.data);
      continue;
    }
    const id = idOf(entry);
    issues.push({
      severity: 'warning',
      section,
      ...(id ? { id } : {}),
      message: parsed.error.issues
        .map((issue) => `${issue.path.join('.') || 'record'}: ${issue.message}`)
        .join('; '),
    });
  }
  return { rows, issues };
}

/** A best effort at naming the row that failed, so a report can point at it. */
function idOf(entry: unknown): string | undefined {
  if (entry === null || typeof entry !== 'object') return undefined;
  const id = (entry as { id?: unknown; itemId?: unknown }).id;
  const itemId = (entry as { itemId?: unknown }).itemId;
  if (typeof id === 'string') return id;
  return typeof itemId === 'string' ? itemId : undefined;
}
