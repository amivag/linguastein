/**
 * The file a learner's own data travels in.
 *
 * This is what stands between a browser evicting the app's storage and a lost
 * year of practice. There is no account and no server — `UserSettings` says so
 * plainly — which makes a file the only backup available, and the same four
 * things a sync would later need (`docs/tasks/accounts-and-sync.md`).
 *
 * ## `schema` is not `DB_VERSION`
 *
 * The database version tracks a *local* migration; this number tracks a format
 * other builds have to read. They move for different reasons and must not be
 * confused — a build that adds an index bumps one and not the other.
 *
 * ## `progress` is a cache, and `attempts` is the authority
 *
 * `ItemProgress` is a **fold** over the attempt log: every field is a function
 * of the row before it and the attempt applied to it, and nothing in the chain
 * reads a clock or a random source (`domain/progress/tracker.ts`). So the log is
 * the only thing here that cannot be recomputed, and the projection is carried
 * for speed and for inspection rather than for authority.
 *
 * That decides what an importer does with a file whose two halves disagree:
 * **rebuild from the log and keep going**, rather than trust the rows or reject
 * the file. `docs/tasks/learner-profile.md` §9.1 settles the reasoning — merging
 * accumulators by last-write-wins is a lost-update bug that would leave the two
 * stores disagreeing with nothing able to detect it.
 *
 * ## Device settings are in the file, and the import applies them
 *
 * §9.4 of that document left this open. Settled here, in the direction the
 * feature exists for: the export carries `preferences` and `courses`, and an
 * import applies both wholesale.
 *
 * A backup that restores a year of history and loses the palette, the contrast,
 * the text size and the chosen voice is a worse backup, and "wholesale, never
 * field-merged" is already the settled policy for these two records — a
 * half-merged course state is one neither device chose. The objection §9.4
 * raised was a `voiceName` naming a voice the target device does not have, which
 * is answered by machinery that already exists rather than by dropping the
 * field: everything read out of storage goes through `storage/schemas.ts`, which
 * repairs per field rather than rejecting the record, and opening a course
 * narrows a stored accent the pack has stopped offering. An imported file goes
 * through the same boundary — it is untrusted input by definition, being
 * something a person can edit in a text editor.
 *
 * ## What is deliberately not here
 *
 * **Content.** A pack is the app's material, not the learner's, and it is
 * downloaded rather than carried: `packs` records only *what the rows
 * referenced* at export time, so an import can report what it cannot resolve.
 * Nothing is pruned on that basis — architecture rule 4 is exactly what makes a
 * progress row referencing an uninstalled pack survivable.
 *
 * **A per-row scheduler id.** `fsrsScheduler.id` is on the envelope, so a file
 * says which algorithm built its projections. Putting it on every progress row
 * is what a *sync* needs, where two writers can disagree (§9.1.2); with one
 * writer per file it would be the same string repeated once per item.
 */

import type { BatchDefinition } from '../../domain/batches';
import type { Attempt, ItemProgress } from '../../domain/progress';
import type { SessionRecord } from '../../domain/sessions';
import type { CourseStates, Preferences } from '../types';

/**
 * The format's own version.
 *
 * Bump it when a reader of an older file would get something wrong — not when a
 * field is added that an older reader can ignore, and never because the database
 * version moved.
 */
export const EXPORT_SCHEMA = 1;

/** What the records referenced, so an import can say what it cannot resolve. */
export interface ExportedPack {
  readonly id: string;
  readonly version: string;
}

export interface LearnerExport {
  /** `APP.id`, read from `app/identity.ts` and never typed by hand. */
  readonly app: string;
  readonly schema: number;
  readonly exportedAt: number;
  /**
   * The scheduler that built the `progress` rows — `fsrs-v1`.
   *
   * Read rather than assumed: replaying a log under different weights yields
   * different stability than the incremental path produced, which is correct and
   * is also a change to every due date. A file built under another scheduler is
   * a deliberate rebuild, not something an import does quietly.
   */
  readonly scheduler: string;
  readonly packs: readonly ExportedPack[];
  readonly preferences: Preferences;
  readonly courses: CourseStates;
  readonly progress: readonly ItemProgress[];
  readonly attempts: readonly Attempt[];
  readonly sessions: readonly SessionRecord[];
  readonly batches: readonly BatchDefinition[];
}

/**
 * `linguastein-progress-2026-09-05.json` — dated, because backups accumulate.
 *
 * The learner's day, not Greenwich's. `toISOString().slice(0, 10)` is shorter
 * and names a file "yesterday" for anyone exporting after their local midnight
 * in a positive offset — the same reason `utils/calendar.ts` defines a day
 * locally. Built from the parts rather than through that helper because this is
 * a *format* (`2026-09-05`) and `localDay` is a key (`Fri Sep 05 2026`).
 */
export function exportFileName(app: string, exportedAt: number): string {
  const at = new Date(exportedAt);
  const pad = (value: number) => String(value).padStart(2, '0');
  const day = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
  return `${app}-progress-${day}.json`;
}
