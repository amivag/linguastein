/** Version 6 brings stored status into line with the rule the fold now applies. */
import { deleteDB, openDB, type IDBPDatabase } from 'idb';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { APP } from '../../src/app/identity';
import type { ItemId } from '../../src/domain/content';
import { createIndexedDbStorage, openAppDatabase } from '../../src/storage/indexeddb-storage';
import { id } from '../fixtures/pack';

const RECOGNISED = id<ItemId>('test-es:item:001');
const PRODUCED = id<ItemId>('test-es:item:002');
const FAILED_PRODUCTION = id<ItemId>('test-es:item:003');
const UNKNOWN = id<ItemId>('test-es:item:004');
const REVIEWING = id<ItemId>('test-es:item:005');

const row = (subject: ItemId, status: string, evidence?: object) => ({
  subject,
  status,
  attempts: 5,
  correct: 5,
  incorrect: 0,
  difficulty: 0.4,
  stability: 40,
  hintsUsed: 0,
  streak: 5,
  dueAt: 9_000,
  updatedAt: 1_000,
  ...(evidence ? { evidence } : {}),
});

const pass = { attempts: 3, correct: 3, lastAt: 1_000 };
const fail = { attempts: 1, correct: 0, lastAt: 1_000 };

describe('upgrading a version-5 database', () => {
  let upgraded: IDBPDatabase<never> | undefined;

  beforeEach(async () => {
    await deleteDB(APP.id);
    const db = await openDB(APP.id, 5, {
      upgrade(database) {
        const progress = database.createObjectStore('progress', { keyPath: 'subject' });
        progress.createIndex('by-due', 'dueAt');
        progress.createIndex('by-status', 'status');
        progress.createIndex('by-pack', 'packId');
      },
    });
    for (const seeded of [
      row(RECOGNISED, 'mastered', { recognition: pass }),
      row(PRODUCED, 'mastered', { recognition: pass, production: pass }),
      row(FAILED_PRODUCTION, 'mastered', { recognition: pass, production: fail }),
      row(UNKNOWN, 'mastered'),
      row(REVIEWING, 'review', { recognition: pass }),
    ]) {
      await db.put('progress', seeded);
    }
    db.close();
  });

  afterEach(() => {
    upgraded?.close();
    upgraded = undefined;
  });

  const statuses = async () => {
    const db = await openAppDatabase();
    upgraded = db as unknown as IDBPDatabase<never>;
    const storage = createIndexedDbStorage(db);
    return new Map((await storage.progress.all()).map((entry) => [entry.subject, entry]));
  };

  it('moves mastered back to review where production never passed', async () => {
    const rows = await statuses();

    expect(rows.get(RECOGNISED)?.status).toBe('review');
    expect(rows.get(FAILED_PRODUCTION)?.status).toBe('review');
  });

  it('leaves what the rule allows alone', async () => {
    const rows = await statuses();

    expect(rows.get(PRODUCED)?.status).toBe('mastered');
    expect(rows.get(REVIEWING)?.status).toBe('review');
  });

  it('reads a row with no evidence as unknown, not as never produced', async () => {
    const rows = await statuses();

    expect(rows.get(UNKNOWN)?.status).toBe('mastered');
  });

  it('touches nothing but the status, so the schedule is unchanged', async () => {
    const rows = await statuses();

    expect(rows.get(RECOGNISED)).toMatchObject({
      stability: 40,
      dueAt: 9_000,
      streak: 5,
      updatedAt: 1_000,
    });
  });
});
