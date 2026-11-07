/**
 * Reading a file back in.
 *
 * **Import is a merge, and there is no second mode.** A merge into a device with
 * nothing on it is exactly a restore, so "replace everything" would be a second
 * code path for a case the first one already covers correctly — and the more
 * dangerous of the two, since the only way to get it wrong is to delete history
 * the file did not contain. `docs/tasks/learner-profile.md` §9.1.1 sets the
 * policy per record and this implements it:
 *
 * - **attempts** — union by id. Immutable and append-only, so this is the one
 *   record whose merge is a merge, and what the collision-free id exists for.
 * - **sessions** — union by id. Immutable.
 * - **progress** — *not merged.* Recomputed by folding each affected item's
 *   attempts. Merging accumulators by last-write-wins loses counted attempts
 *   while the attempt rows themselves survive, which desynchronises two stores
 *   meant to be one fact — and nothing would detect it.
 * - **batches** — kept where the device already has the id, inserted where it
 *   does not. A batch is authored material rather than an accumulator.
 * - **preferences, courses** — wholesale, the file's. Never field-merged: a
 *   half-merged course state is one neither device chose. See `format.ts` for
 *   why they are in the file at all.
 *
 * Two rules from §7.4, neither negotiable. **Orphans are kept, never pruned** —
 * a row referencing a pack that is not installed is exactly what architecture
 * rule 4 was designed to survive, so the count is reported and the rows stay.
 * And **the confirm names what will happen**, which is the caller's job: this
 * module reports, and `UserSettings` is where a learner agrees to it.
 */

import type { BatchDefinition } from '../../domain/batches';
import { replaySubject, type Attempt, type SubjectProgress } from '../../domain/progress';
import type { EntityId } from '../../domain/content';
import type { LearnerStores, LearnerStorage } from '../types';
import { sameAttempt } from '../save-attempts';
import { GRADED_MODES } from '../../domain/exercises/modes';
import { readCourseStates, readPreferences } from '../schemas';
import { EXPORT_SCHEMA, type LearnerExport } from './format';
import {
  attemptSchema,
  batchSchema,
  envelopeSchema,
  packSchema,
  progressSchema,
  readRows,
  sessionSchema,
  type ImportIssue,
} from './schemas';

export interface ParsedExport {
  /** Absent when the file was refused; `issues` then says why. */
  readonly envelope?: LearnerExport;
  readonly issues: readonly ImportIssue[];
}

/**
 * A file into an envelope, or into the reason it cannot be one.
 *
 * `app` is passed in rather than imported so this module stays testable without
 * the composition root, and checked rather than ignored: another app's file is
 * somebody else's data, not a damaged copy of the learner's.
 */
export function parseExport(value: unknown, app: string): ParsedExport {
  const head = envelopeSchema.safeParse(value);
  if (!head.success) {
    return {
      issues: [
        {
          severity: 'error',
          section: 'file',
          message: 'This is not a Linguastein export: the file has no envelope.',
        },
      ],
    };
  }

  if (head.data.app !== app) {
    return {
      issues: [
        {
          severity: 'error',
          section: 'file',
          message: `This file was written by “${head.data.app}”, not by this app.`,
        },
      ],
    };
  }

  if (head.data.schema > EXPORT_SCHEMA) {
    return {
      issues: [
        {
          severity: 'error',
          section: 'file',
          message:
            `This file is in format ${head.data.schema}, and this build reads up to ` +
            `${EXPORT_SCHEMA}. Update the app and try again.`,
        },
      ],
    };
  }

  const record = value as Record<string, unknown>;
  const attempts = readRows(attemptSchema, 'attempts', record['attempts']);
  const progress = readRows(progressSchema, 'progress', record['progress']);
  const sessions = readRows(sessionSchema, 'sessions', record['sessions']);
  const batches = readRows(batchSchema, 'batches', record['batches']);
  const packs = readRows(packSchema, 'packs', record['packs']);

  return {
    envelope: {
      app: head.data.app,
      schema: head.data.schema,
      exportedAt: head.data.exportedAt,
      scheduler: head.data.scheduler ?? '',
      packs: packs.rows,
      // Both go through the boundary that already reads them out of storage, so
      // an edited file is repaired per field exactly as a stale record is.
      preferences: readPreferences(record['preferences']),
      courses: readCourseStates(record['courses']),
      progress: progress.rows,
      attempts: attempts.rows,
      sessions: sessions.rows,
      batches: batches.rows,
    },
    issues: [
      ...attempts.issues,
      ...progress.issues,
      ...sessions.issues,
      ...batches.issues,
      ...packs.issues,
    ],
  };
}

export interface ImportReport {
  /** Attempts the device did not already have. */
  readonly attemptsAdded: number;
  /** Attempts the file and the device both held — the re-import case. */
  readonly attemptsAlreadyHeld: number;
  readonly sessionsAdded: number;
  /**
   * The sets the file brought, as records rather than a count.
   *
   * The caller needs them: `App.tsx` holds the batch list in state so a screen
   * does not await a read, and a list that only catches up on a reload would
   * mean an import appeared to have done nothing. The same reason the reset
   * control updates the live app rather than reloading it.
   */
  readonly batchesAdded: readonly BatchDefinition[];
  /** Subjects whose stored projection actually changed after replay. */
  readonly itemsRebuilt: number;
  /**
   * Rows referencing a pack this device does not have installed.
   *
   * Reported and kept. A learner who imports on a device with only the French
   * pack should not silently lose a year of Spanish because of it.
   */
  readonly orphans: number;
  readonly settingsApplied: boolean;
}

/*
 * There is deliberately no `issues` here. Everything that can go wrong with a
 * file goes wrong in `parseExport`, which is where the issues are — by the time
 * a learner has agreed to a confirm, the rows have already been read, and a
 * second empty list on this side would be a field that is always empty. This
 * codebase has one worked example of what that costs: `showRomanisationHints`,
 * deleted ahead of the file format rather than inside it, because a dead field
 * is one every future reader has to decide what to do with.
 */

export interface ImportOptions {
  /** Pack ids installed here, used only to count orphans. Never to prune. */
  readonly installedPacks: readonly string[];
  /**
   * Whether to take the file's settings. The learner's choice, offered because
   * this is the one part of an import that changes something they can see
   * immediately — and the one part that is not history.
   */
  readonly settings: boolean;
}

export async function applyExport(
  storage: LearnerStorage,
  envelope: LearnerExport,
  { installedPacks, settings }: ImportOptions,
): Promise<ImportReport> {
  return storage.transaction((stores) =>
    mergeExport(stores, envelope, { installedPacks, settings }),
  );
}

function sameProgress(a: SubjectProgress | undefined, b: SubjectProgress): boolean {
  if (!a) return false;
  const keys = Object.keys({ ...a, ...b }) as (keyof SubjectProgress)[];
  if (keys.some((key) => key !== 'evidence' && a[key] !== b[key])) return false;
  if ((a.evidence === undefined) !== (b.evidence === undefined)) return false;
  return GRADED_MODES.every((mode) => {
    const left = a.evidence?.[mode];
    const right = b.evidence?.[mode];
    return left === undefined || right === undefined
      ? left === right
      : left.attempts === right.attempts &&
          left.correct === right.correct &&
          left.lastAt === right.lastAt;
  });
}

async function mergeExport(
  storage: LearnerStores,
  envelope: LearnerExport,
  { installedPacks, settings }: ImportOptions,
): Promise<ImportReport> {
  const [localAttempts, localSessions, localBatches] = await Promise.all([
    storage.attempts.all(),
    storage.sessions.all(),
    storage.batches.all(),
  ]);

  const heldAttempts = new Map(localAttempts.map((attempt) => [attempt.id, attempt]));
  const incoming = new Map<string, Attempt>();
  for (const attempt of envelope.attempts) {
    const existing = incoming.get(attempt.id) ?? heldAttempts.get(attempt.id);
    if (existing && !sameAttempt(existing, attempt))
      throw new Error('Attempt id already belongs to different evidence');
    incoming.set(attempt.id, attempt);
  }
  const newAttempts = [...incoming.values()].filter((attempt) => !heldAttempts.has(attempt.id));

  const heldSessions = new Set(localSessions.map((record) => record.id));
  const newSessions = envelope.sessions.filter((record) => !heldSessions.has(record.id));

  const heldBatches = new Set(localBatches.map((batch) => batch.id));
  const newBatches = envelope.batches.filter((batch) => !heldBatches.has(batch.id));

  // Include already-held evidence: a retry must repair a projection left stale
  // by an older non-atomic importer, even when no attempt is new this time.
  const touched = new Set<EntityId>([
    ...envelope.attempts.map((attempt) => attempt.subject),
    ...envelope.progress.map((row) => row.subject),
  ]);
  const mergedBySubject = new Map<EntityId, Attempt[]>();
  for (const attempt of [...localAttempts, ...newAttempts]) {
    if (!touched.has(attempt.subject)) continue;
    const existing = mergedBySubject.get(attempt.subject);
    if (existing) existing.push(attempt);
    else mergedBySubject.set(attempt.subject, [attempt]);
  }

  const known = await storage.progress.all();
  const held = new Map(known.map((row) => [row.subject, row]));
  const rebuilt: SubjectProgress[] = [];
  for (const [subject, log] of mergedBySubject) {
    const row = replaySubject(subject, log);
    if (row && !sameProgress(held.get(subject), row)) rebuilt.push(row);
  }

  /*
   * Rows the file carries for subjects with no attempts anywhere. Impossible for
   * this build to have written — every row comes from an attempt — but the
   * format says progress is a cache, and a cache whose source is gone is the
   * only evidence left. Inserted only where the device has nothing, so a local
   * row folded from a real log is never overwritten by one that cannot be
   * checked.
   */
  const heldSubjects = new Set(known.map((row) => row.subject));
  const unbacked = envelope.progress.filter(
    (row) => !mergedBySubject.has(row.subject) && !heldSubjects.has(row.subject),
  );

  await Promise.all([
    storage.attempts.appendMany(newAttempts),
    storage.sessions.putMany(newSessions),
  ]);
  await storage.progress.putMany([...rebuilt, ...unbacked]);
  for (const batch of newBatches) await storage.batches.put(batch);

  if (settings) {
    await storage.preferences.write(envelope.preferences);
    for (const [language, state] of Object.entries(envelope.courses)) {
      await storage.courses.write(language, state);
    }
  }

  const installed = new Set(installedPacks);
  const orphans = [...rebuilt, ...unbacked].filter(
    (row) => row.packId !== undefined && !installed.has(row.packId),
  ).length;

  return {
    attemptsAdded: newAttempts.length,
    attemptsAlreadyHeld: incoming.size - newAttempts.length,
    sessionsAdded: newSessions.length,
    batchesAdded: newBatches,
    itemsRebuilt: rebuilt.length,
    orphans,
    settingsApplied: settings,
  };
}
