/**
 * IndexedDB implementation of `LearnerStorage` (spec §23).
 *
 * Schema changes go in `upgrade` with an explicit version bump; learner data
 * is migrated, never dropped.
 */

import {
  openDB,
  type DBSchema,
  type IDBPDatabase,
  type IDBPTransaction,
  type StoreNames,
} from 'idb';
import { APP } from '../app/identity';
import type { BatchDefinition } from '../domain/batches';
import {
  LEVEL_SCOPE_ALL,
  packIdOf,
  type Course,
  type EntityId,
  type ItemId,
  type LanguageTag,
  type LevelScope,
} from '../domain/content';
import {
  hasProduced,
  type Attempt,
  type SubjectProgress,
  type Timestamp,
} from '../domain/progress';
import type { SessionFocus, SessionRecord } from '../domain/sessions';
import {
  courseStateOf,
  DEFAULT_PREFERENCES,
  mergeCourseState,
  mergePreferences,
} from './preferences';
import { readCourseStates, readPreferences } from './schemas';
import type { LearnerStores, LearnerStorage, Preferences } from './types';

const DB_NAME = APP.id;
const DB_VERSION = 6;
const PREFERENCES_KEY = 'preferences';
const COURSES_KEY = 'courses';

interface AppDatabase extends DBSchema {
  progress: {
    key: string;
    value: SubjectProgress;
    indexes: { 'by-due': number; 'by-status': string; 'by-pack': string };
  };
  attempts: {
    key: string;
    value: Attempt;
    indexes: { 'by-subject': string; 'by-time': number };
  };
  sessions: {
    key: string;
    value: SessionRecord;
    indexes: { 'by-time': number };
  };
  /**
   * Deliberately unindexed. A batch is a deliberate act rather than a log entry,
   * so there are a handful of them and `getAll` is the honest read — and an
   * index whose key path a record lacks silently excludes that record, which is
   * the trap version 2's migration exists to document. No index, no trap.
   */
  batches: {
    key: string;
    value: BatchDefinition;
  };
  meta: {
    key: string;
    value: unknown;
  };
}

/**
 * The records as they were before version 2, which is what a migration actually
 * reads: a progress row had no `updatedAt` and no `packId`, and a session row
 * carried no course. Spelled out rather than cast away, so the compiler checks
 * the migration against the shape it is really handling.
 */
type LegacyProgress = Omit<PreV5Progress, 'updatedAt'> & { readonly updatedAt?: Timestamp };

/**
 * The two history rows as versions 1 to 4 wrote them: keyed on `itemId` rather
 * than on `subject`.
 *
 * Spelled out rather than cast away, so the compiler checks the version-5
 * migration against the shape it is really handling — the same reason
 * {@link LegacyProgress} exists.
 */
type PreV5Progress = Omit<SubjectProgress, 'subject'> & { readonly itemId: ItemId };
type PreV5Attempt = Omit<Attempt, 'subject'> & { readonly itemId: ItemId };
type LegacySession = Omit<SessionRecord, 'course'> & { readonly course?: Course };
/**
 * The one flat settings record, as versions 1 to 3 wrote it.
 *
 * Every field optional, because this type describes what may be *on disk* rather
 * than what the app requires: a record written before `focus` existed simply has
 * no `focus`, and the migration must not invent one.
 */
type LegacyPreferences = Partial<Preferences> & {
  readonly level?: LevelScope;
  readonly focusTopics?: readonly string[];
  readonly focus?: SessionFocus;
  readonly pronunciationLocale?: LanguageTag;
  readonly voiceName?: string;
};

type UpgradeTransaction = IDBPTransaction<AppDatabase, StoreNames<AppDatabase>[], 'versionchange'>;

/**
 * What one tab needs to hear about the database's other users.
 *
 * A schema upgrade waits until every other connection to the database has closed.
 * The update flow keeps old tabs alive on purpose (`updates.ts` in `@platform/web`), so without
 * these hooks an old tab would leave a newer tab's boot waiting forever.
 */
export interface DatabaseEvents {
  /** An older tab is still holding the database open; this upgrade is waiting for it. */
  readonly onBlocked?: () => void;
  /**
   * This connection is gone: closed so a newer build can upgrade, or terminated
   * by the browser. Writes fail from here on, and only a reload reconnects.
   */
  readonly onClosed?: () => void;
}

export async function openAppDatabase(
  events: DatabaseEvents = {},
): Promise<IDBPDatabase<AppDatabase>> {
  return openDB<AppDatabase>(DB_NAME, DB_VERSION, {
    blocked() {
      events.onBlocked?.();
    },
    /*
     * Step aside for the newer build. Holding on would gain nothing: this tab's
     * code cannot write the newer schema anyway, and the newer tab cannot start
     * until this connection closes.
     */
    blocking(_currentVersion, _blockedVersion, event) {
      (event.target as IDBDatabase).close();
      events.onClosed?.();
    },
    terminated() {
      events.onClosed?.();
    },
    async upgrade(db, oldVersion, _newVersion, tx) {
      if (oldVersion < 1) {
        /*
         * Today's shape, not version 1's. A store created here is created by
         * *this* build, so it gets `subject` and `by-subject` directly and every
         * later branch is a no-op for it — which is why each of them opens with
         * `if (oldVersion < 1) return`.
         */
        const progress = db.createObjectStore('progress', { keyPath: 'subject' });
        progress.createIndex('by-due', 'dueAt');
        progress.createIndex('by-status', 'status');

        const attempts = db.createObjectStore('attempts', { keyPath: 'id' });
        attempts.createIndex('by-subject', 'subject');
        attempts.createIndex('by-time', 'at');

        const sessions = db.createObjectStore('sessions', { keyPath: 'id' });
        sessions.createIndex('by-time', 'startedAt');

        db.createObjectStore('meta');
      }

      if (oldVersion < 2) await upgradeToV2(tx, oldVersion);

      /*
       * Version 3: somewhere to keep the sets a learner assembles.
       *
       * A dozen characters against version 2's careful rewrite, and the
       * difference is worth naming rather than leaving as a happy accident: this
       * version *adds* a store, so there is no existing record to bring up to a
       * new shape and therefore nothing to backfill. Version 2 had to backfill
       * because a row missing its new key path drops out of the index built on
       * it. Neither claim is general — check which kind a future bump is before
       * copying either one.
       */
      if (oldVersion < 3) db.createObjectStore('batches', { keyPath: 'id' });

      if (oldVersion < 4) await upgradeToV4(tx, oldVersion);

      if (oldVersion < 5) await upgradeToV5(db, tx, oldVersion);

      if (oldVersion < 6) await upgradeToV6(db, tx, oldVersion);
    },
  });
}

/**
 * Version 2: a progress row learns which pack it belongs to and when it was last
 * written, and a session row learns which course it was.
 *
 * The backfill is the point of it, and it runs inside the version-change
 * transaction rather than after it. An IndexedDB index is built from a stored key
 * path and nothing else, so a record missing that path is *absent* from the index
 * — a row left without `packId` would disappear from every per-pack query, which
 * reads exactly like lost history. Either the bump and the backfill both happen
 * or neither does.
 */
async function upgradeToV2(tx: UpgradeTransaction, oldVersion: number): Promise<void> {
  const progress = tx.objectStore('progress');
  if (!progress.indexNames.contains('by-pack')) progress.createIndex('by-pack', 'packId');

  // A database the branch above created a moment ago has nothing to backfill.
  if (oldVersion < 1) return;

  /*
   * Cast through `unknown`, because `AppDatabase` describes the store as this
   * build declares it and these rows predate version 5's rename. A migration
   * always handles a shape the current schema no longer admits; the named
   * `PreV5*` / `Legacy*` types are what keep that honest rather than loose.
   */
  const rows = (await progress.getAll()) as unknown as readonly LegacyProgress[];
  for (const record of rows) {
    const packId = packIdOf(record.itemId);
    await progress.put({
      ...record,
      ...(packId ? { packId } : {}),
      // The row's own last review is the only evidence of when it was written.
      // Deliberately not `Date.now()`: stamping every old row as "just now" would
      // make a merge prefer whichever device happened to migrate last.
      updatedAt: record.updatedAt ?? record.lastReviewedAt ?? 0,
    } as unknown as SubjectProgress);
  }

  const sessions = tx.objectStore('sessions');
  const stored = (await tx.objectStore('meta').get(PREFERENCES_KEY)) as
    Partial<Preferences> | undefined;
  // Which course a past session was practised in is recorded nowhere, so the
  // learner's own stored language is the best evidence available — and `all` is
  // not a claim that the session was unnarrowed, it is the absence of one.
  const course: Course = {
    language: stored?.targetLanguage ?? DEFAULT_PREFERENCES.targetLanguage,
    level: LEVEL_SCOPE_ALL,
  };

  for (const record of (await sessions.getAll()) as readonly LegacySession[]) {
    if (record.course) continue;
    await sessions.put({ ...record, course });
  }
}

/**
 * Version 4: the settings that are properties of a *course* stop being global.
 *
 * `level`, `focusTopics`, `focus`, `pronunciationLocale` and `voiceName` move out
 * of `meta:preferences` and into `meta:courses`, under the language the learner
 * was studying when they were written. Spanish-at-A2 and French-at-A1 could not
 * both be true of one `level`, and one `voiceName` is how a French course came to
 * be read aloud by a Spanish voice (`docs/tasks/learner-profile.md` §4.1).
 *
 * Nothing is guessed. The stored `targetLanguage` is *exactly* the course those
 * five values were chosen in — there was only one — so the move is a fact rather
 * than an attribution, unlike version 2's session backfill, which had to settle
 * for the best evidence available.
 *
 * A third kind of upgrade, and worth naming beside the other two: version 2 had
 * to backfill because a row missing a new key path drops out of the index built
 * on it, version 3 added an empty store and had nothing to do, and this one
 * *rewrites* one record into two. It is the only one so far where doing nothing
 * would silently reset a setting rather than hide a row — an un-migrated
 * `meta:preferences` still reads, it just answers with the defaults for
 * everything that moved.
 */
async function upgradeToV4(tx: UpgradeTransaction, oldVersion: number): Promise<void> {
  // A database created a moment ago has no preferences to split.
  if (oldVersion < 1) return;

  const meta = tx.objectStore('meta');
  const stored = (await meta.get(PREFERENCES_KEY)) as LegacyPreferences | undefined;
  if (!stored) return;

  const { level, focusTopics, focus, pronunciationLocale, voiceName, ...device } = stored;
  const moved = { level, focusTopics, focus, pronunciationLocale, voiceName };

  /*
   * Only the fields that were actually there. A record written before one of
   * them existed has no value for it, and writing `undefined` into the course
   * would shadow the default with a hole — `courseStateOf` answers with the
   * defaults for a course it has never seen, and that is the right answer for a
   * field nobody ever set.
   */
  const present = Object.fromEntries(
    Object.entries(moved).filter(([, value]) => value !== undefined),
  );

  if (Object.keys(present).length > 0) {
    const courses = ((await meta.get(COURSES_KEY)) as Record<string, unknown> | undefined) ?? {};
    const language = stored.targetLanguage ?? DEFAULT_PREFERENCES.targetLanguage;
    await meta.put(
      { ...courses, [language]: { ...(courses[language] ?? {}), ...present } },
      COURSES_KEY,
    );
  }

  await meta.put(device, PREFERENCES_KEY);
}

/**
 * Version 5: a progress row stops being about an item, and starts being about a
 * subject.
 *
 * `SubjectProgress.subject` is any content entity — an item, a verb form, a
 * grammatical pattern — because three things the app wants to practise are not
 * items and never can be. The field is the `progress` store's **key path**, so
 * unlike every bump before it this one cannot be done in place: a key path is
 * fixed when the store is created, and the only way to change it is to delete
 * the store and build it again.
 *
 * So this reads every row out, recreates the store, and writes them back with
 * `subject` set to what `itemId` held. That is safe for exactly one reason worth
 * stating: it all happens inside the version-change transaction, so a throw
 * part-way **aborts the whole upgrade** rather than leaving a store with half a
 * learner's history in it. The database either comes up at version 5 with
 * everything, or stays at version 4 with everything.
 *
 * `attempts` keeps its key path (`id`) and only swaps an index — but the rows
 * still have to be rewritten, for the reason version 2's comment gives at
 * length: an index is built from a stored key path and nothing else, so a row
 * without `subject` would be *absent* from `by-subject`, which reads exactly
 * like lost history.
 */
async function upgradeToV5(
  db: IDBPDatabase<AppDatabase>,
  tx: UpgradeTransaction,
  oldVersion: number,
): Promise<void> {
  // A database the version-1 branch created a moment ago is already in the new
  // shape, because that branch builds it from today's declarations.
  if (oldVersion < 1) return;

  /*
   * A store that is not there has nothing to convert, and asking for one throws.
   * Not a hypothetical: an upgrade that aborted part-way leaves a database at
   * the old version with whatever stores it had got to, and a migration is
   * exactly the code that has to survive meeting one.
   */
  if (!db.objectStoreNames.contains('progress')) return;

  const rows = (await tx.objectStore('progress').getAll()) as unknown as readonly PreV5Progress[];
  db.deleteObjectStore('progress');
  const progress = db.createObjectStore('progress', { keyPath: 'subject' });
  progress.createIndex('by-due', 'dueAt');
  progress.createIndex('by-status', 'status');
  progress.createIndex('by-pack', 'packId');

  for (const row of rows) {
    const { itemId, ...rest } = row;
    await progress.put({ ...rest, subject: itemId });
  }

  if (!db.objectStoreNames.contains('attempts')) return;
  const attempts = tx.objectStore('attempts');
  /*
   * One loose view of the store, for the index this *removes*: `by-item` is not
   * among today's declared index names, so neither `contains` nor `deleteIndex`
   * will accept it. Same reason the row reads cast through `unknown` — a
   * migration deals in shapes the current schema has stopped describing.
   */
  const previous = attempts as unknown as {
    readonly indexNames: DOMStringList;
    deleteIndex(name: string): void;
  };
  if (previous.indexNames.contains('by-item')) previous.deleteIndex('by-item');
  if (!attempts.indexNames.contains('by-subject')) {
    attempts.createIndex('by-subject', 'subject');
  }
  for (const row of (await attempts.getAll()) as unknown as readonly PreV5Attempt[]) {
    const { itemId, ...rest } = row;
    await attempts.put({ ...rest, subject: itemId });
  }
}

/**
 * Version 6: "mastered" came to require a production answer that passed.
 *
 * The fold applies that from now on, but a row is only rewritten when it is next
 * answered, which for a mastered item can be a year away. Until then Home would go
 * on repeating a claim the app no longer makes, so the rows are corrected here.
 *
 * Only the status moves; the schedule is still true. A row with no evidence map
 * predates evidence, which reads as unknown rather than as never produced.
 */
async function upgradeToV6(
  db: IDBPDatabase<AppDatabase>,
  tx: UpgradeTransaction,
  oldVersion: number,
): Promise<void> {
  if (oldVersion < 1 || !db.objectStoreNames.contains('progress')) return;

  const progress = tx.objectStore('progress');
  for (const row of await progress.getAll()) {
    if (row.status === 'mastered' && row.evidence && !hasProduced(row.evidence)) {
      await progress.put({ ...row, status: 'review' });
    }
  }
}

type Store = StoreNames<AppDatabase>;
type ReadTransaction = IDBPTransaction<AppDatabase, Store[], 'readonly' | 'readwrite'>;
type WriteTransaction = IDBPTransaction<AppDatabase, Store[], 'readwrite'>;
const STORES: Store[] = ['progress', 'attempts', 'sessions', 'batches', 'meta'];

async function finish<T>(
  tx: { readonly done: Promise<void>; abort(): void },
  work: () => Promise<T>,
): Promise<T> {
  try {
    const result = await work();
    await tx.done;
    return result;
  } catch (error) {
    try {
      tx.abort();
    } catch {
      /* A failed request may already have aborted it. */
    }
    await tx.done.catch(() => {});
    throw error;
  }
}

export function createIndexedDbStorage(db: IDBPDatabase<AppDatabase>): LearnerStorage {
  function stores(scope?: WriteTransaction): LearnerStores {
    async function read<T>(names: Store[], work: (tx: ReadTransaction) => Promise<T>): Promise<T> {
      if (scope) return work(scope);
      const tx = db.transaction(names, 'readonly');
      return finish(tx, () => work(tx));
    }
    async function write<T>(
      names: Store[],
      work: (tx: WriteTransaction) => Promise<T>,
    ): Promise<T> {
      if (scope) return work(scope);
      const tx = db.transaction(names, 'readwrite');
      return finish(tx, () => work(tx));
    }
    return {
      progress: {
        get: (subject) => read(['progress'], (tx) => tx.objectStore('progress').get(subject)),
        getMany: (subjects) =>
          read(['progress'], async (tx) => {
            const rows = await Promise.all(
              subjects.map(
                async (subject) =>
                  [subject, await tx.objectStore('progress').get(subject)] as const,
              ),
            );
            return new Map(
              rows.filter(
                (row): row is readonly [EntityId, SubjectProgress] => row[1] !== undefined,
              ),
            );
          }),
        all: () => read(['progress'], (tx) => tx.objectStore('progress').getAll()),
        count: () => read(['progress'], (tx) => tx.objectStore('progress').count()),
        put: (row) =>
          write(['progress'], async (tx) => {
            await tx.objectStore('progress').put(row);
          }),
        putMany: (rows) =>
          write(['progress'], async (tx) => {
            await Promise.all(rows.map((row) => tx.objectStore('progress').put(row)));
          }),
        clear: () => write(['progress'], (tx) => tx.objectStore('progress').clear()),
      },
      attempts: {
        get: (id) => read(['attempts'], (tx) => tx.objectStore('attempts').get(id)),
        append: (row) =>
          write(['attempts'], async (tx) => {
            await tx.objectStore('attempts').put(row);
          }),
        appendMany: (rows) =>
          write(['attempts'], async (tx) => {
            await Promise.all(rows.map((row) => tx.objectStore('attempts').put(row)));
          }),
        count: () => read(['attempts'], (tx) => tx.objectStore('attempts').count()),
        recent: (limit) =>
          read(['attempts'], async (tx) => {
            const rows: Attempt[] = [];
            let cursor = await tx.objectStore('attempts').index('by-time').openCursor(null, 'prev');
            while (cursor && rows.length < limit) {
              rows.push(cursor.value);
              cursor = await cursor.continue();
            }
            return rows;
          }),
        forSubject: (subject, limit = 20) =>
          read(['attempts'], async (tx) => {
            const rows = await tx.objectStore('attempts').index('by-subject').getAll(subject);
            return rows.sort((a, b) => b.at - a.at).slice(0, limit);
          }),
        all: () => read(['attempts'], (tx) => tx.objectStore('attempts').index('by-time').getAll()),
        clear: () => write(['attempts'], (tx) => tx.objectStore('attempts').clear()),
      },
      sessions: {
        put: (row) =>
          write(['sessions'], async (tx) => {
            await tx.objectStore('sessions').put(row);
          }),
        putMany: (rows) =>
          write(['sessions'], async (tx) => {
            await Promise.all(rows.map((row) => tx.objectStore('sessions').put(row)));
          }),
        all: () => read(['sessions'], (tx) => tx.objectStore('sessions').index('by-time').getAll()),
        count: () => read(['sessions'], (tx) => tx.objectStore('sessions').count()),
        recent: (limit, language) =>
          read(['sessions'], async (tx) => {
            const rows: SessionRecord[] = [];
            let cursor = await tx.objectStore('sessions').index('by-time').openCursor(null, 'prev');
            while (cursor && rows.length < limit) {
              if (!language || cursor.value.course.language === language) rows.push(cursor.value);
              cursor = await cursor.continue();
            }
            return rows;
          }),
        clear: () => write(['sessions'], (tx) => tx.objectStore('sessions').clear()),
      },
      batches: {
        all: () => read(['batches'], (tx) => tx.objectStore('batches').getAll()),
        put: (row) =>
          write(['batches'], async (tx) => {
            await tx.objectStore('batches').put(row);
          }),
        remove: (id) => write(['batches'], (tx) => tx.objectStore('batches').delete(id)),
        clear: () => write(['batches'], (tx) => tx.objectStore('batches').clear()),
      },
      preferences: {
        read: () =>
          read(['meta'], async (tx) =>
            readPreferences(await tx.objectStore('meta').get(PREFERENCES_KEY)),
          ),
        write: (patch) =>
          write(['meta'], async (tx) => {
            const next = mergePreferences(
              readPreferences(await tx.objectStore('meta').get(PREFERENCES_KEY)),
              patch,
            );
            await tx.objectStore('meta').put(next, PREFERENCES_KEY);
            return next;
          }),
      },
      courses: {
        read: () =>
          read(['meta'], async (tx) =>
            readCourseStates(await tx.objectStore('meta').get(COURSES_KEY)),
          ),
        write: (language, patch) =>
          write(['meta'], async (tx) => {
            const current = readCourseStates(await tx.objectStore('meta').get(COURSES_KEY));
            const next = {
              ...current,
              [language]: mergeCourseState(courseStateOf(current, language), patch),
            };
            await tx.objectStore('meta').put(next, COURSES_KEY);
            return next;
          }),
      },
    };
  }
  return {
    ...stores(),
    transaction(operation) {
      const tx = db.transaction(STORES, 'readwrite');
      return finish(tx, () => operation(stores(tx)));
    },
    async clearAll() {
      const tx = db.transaction(STORES, 'readwrite');
      await finish(tx, async () => {
        await Promise.all(STORES.map((name) => tx.objectStore(name).clear()));
      });
    },
  };
}
