/**
 * Two tabs, two builds, one database.
 *
 * Updates wait for the learner (`updates.ts` in `@platform/web`), so an old tab can still be
 * open when a newer build upgrades the schema. IndexedDB holds that upgrade
 * until every other connection closes. These tests pin both halves of the
 * handover: the old connection steps aside and says so, and a newer open that is
 * kept waiting reports that it is waiting.
 */

import { deleteDB, openDB } from 'idb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APP } from '../../src/app/identity';
import { createStorage, openAppDatabase } from '../../src/storage';

beforeEach(async () => {
  await deleteDB(APP.id);
});

afterEach(async () => {
  await deleteDB(APP.id);
});

describe('an open connection when a newer build upgrades', () => {
  it('closes itself so the upgrade can run, and reports that it closed', async () => {
    const onClosed = vi.fn();
    const current = await openAppDatabase({ onClosed });

    const newer = await openDB(APP.id, current.version + 1);

    expect(onClosed).toHaveBeenCalledTimes(1);
    expect(newer.version).toBe(current.version + 1);
    newer.close();
  });

  it('fails its writes from then on rather than hanging', async () => {
    const storage = await createStorage({ onClosed: () => {} });
    const db = await openAppDatabase({ onClosed: () => {} });
    const newer = await openDB(APP.id, db.version + 1);

    await expect(storage.progress.count()).rejects.toThrow();
    newer.close();
  });
});

describe('an upgrade kept waiting by an older tab', () => {
  it('reports the wait, then finishes once the old tab lets go', async () => {
    // An older build's connection that, like every build before this one, has no
    // `blocking` handler and so never closes by itself. Version 5's stores, so
    // the upgrade it was holding up has real work to do once it runs.
    const stale = await openDB(APP.id, 5, {
      upgrade(db) {
        const progress = db.createObjectStore('progress', { keyPath: 'subject' });
        progress.createIndex('by-due', 'dueAt');
        progress.createIndex('by-status', 'status');
        progress.createIndex('by-pack', 'packId');
        const attempts = db.createObjectStore('attempts', { keyPath: 'id' });
        attempts.createIndex('by-subject', 'subject');
        attempts.createIndex('by-time', 'at');
        db.createObjectStore('sessions', { keyPath: 'id' }).createIndex('by-time', 'startedAt');
        db.createObjectStore('batches', { keyPath: 'id' });
        db.createObjectStore('meta');
      },
    });
    const onBlocked = vi.fn();

    const opening = openAppDatabase({ onBlocked });
    await vi.waitFor(() => expect(onBlocked).toHaveBeenCalledTimes(1));

    stale.close();
    const db = await opening;
    expect(db.objectStoreNames.contains('progress')).toBe(true);
    db.close();
  });
});
