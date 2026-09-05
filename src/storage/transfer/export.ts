/**
 * Reading everything the learner owns into one file.
 *
 * Whole-table reads, deliberately: `recent(limit)` is what screens use, and an
 * export that silently stopped at the newest thousand attempts would be a backup
 * that quietly loses the beginning of a learner's history — the half of the log
 * every early progress row was folded from.
 */

import { fsrsScheduler } from '../../domain/progress';
import type { LearnerStorage } from '../types';
import { EXPORT_SCHEMA, type ExportedPack, type LearnerExport } from './format';

export interface ExportOptions {
  /** What is installed, so the file records what its rows referenced. */
  readonly packs: readonly ExportedPack[];
  readonly now: number;
  /** `APP.id`. Passed rather than imported, so this module stays app-agnostic. */
  readonly app: string;
}

export async function buildExport(
  storage: LearnerStorage,
  { packs, now, app }: ExportOptions,
): Promise<LearnerExport> {
  const [preferences, courses, progress, attempts, sessions, batches] = await Promise.all([
    storage.preferences.read(),
    storage.courses.read(),
    storage.progress.all(),
    storage.attempts.all(),
    storage.sessions.all(),
    storage.batches.all(),
  ]);

  return {
    app,
    schema: EXPORT_SCHEMA,
    exportedAt: now,
    scheduler: fsrsScheduler.id,
    packs,
    preferences,
    courses,
    progress,
    attempts,
    sessions,
    batches,
  };
}

/**
 * Two-space JSON rather than the shortest possible file.
 *
 * The content licence makes this a learner's own data in a format they can read,
 * and a backup somebody can open and understand is worth more than the bytes:
 * the largest realistic export is a few megabytes of attempts, which is smaller
 * than one level of the pack they already downloaded.
 */
export function serialiseExport(envelope: LearnerExport): string {
  return `${JSON.stringify(envelope, null, 2)}\n`;
}
