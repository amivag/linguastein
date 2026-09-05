/**
 * Export and import: the only thing standing between a browser evicting the
 * app's storage and a lost year of practice.
 *
 * Three things are worth testing here and one of them is the whole feature.
 * A round trip has to be lossless, because a backup that quietly drops the
 * beginning of a log is worse than no backup. An import has to **merge** rather
 * than replace, because a learner running it on a device that has been used is
 * the case a restore would destroy. And progress has to be **rebuilt from the
 * merged log** rather than merged as rows — `docs/tasks/learner-profile.md` §9.1
 * shows why last-write-wins on an accumulator desynchronises two stores that are
 * meant to be one fact, with nothing able to detect it afterwards.
 */

import { describe, expect, it } from 'vitest';
import type { EntityId, ItemId } from '../../src/domain/content';
import { recordAttempt, replaySubject, type Attempt } from '../../src/domain/progress';
import { createMemoryStorage, type LearnerStorage } from '../../src/storage';
import {
  applyExport,
  buildExport,
  EXPORT_SCHEMA,
  exportFileName,
  parseExport,
  serialiseExport,
} from '../../src/storage/transfer';
import { id } from '../fixtures/pack';

const APP = 'linguastein';
const ITEM = id<ItemId>('test-es:item:001');
const OTHER = id<ItemId>('test-es:item:002');
const NOW = 1_757_030_400_000;
const DAY = 86_400_000;

const options = { packs: [{ id: 'test-es', version: '1.0.0' }], now: NOW, app: APP };
const importing = { installedPacks: ['test-es'], settings: true };

/** Records one attempt the way the app does — through the tracker, into storage. */
async function practise(
  storage: LearnerStorage,
  subject: ItemId,
  at: number,
  grade: 'again' | 'good' = 'good',
): Promise<Attempt> {
  const current = await storage.progress.get(subject);
  const { progress, attempt } = recordAttempt(
    current,
    { subject, exerciseKind: 'think-say', grade },
    at,
  );
  await storage.progress.put(progress);
  await storage.attempts.append(attempt);
  return attempt;
}

/** A device with a week of history on two items, plus a set and a session. */
async function usedDevice(): Promise<LearnerStorage> {
  const storage = createMemoryStorage();
  for (let day = 0; day < 5; day++) {
    await practise(storage, ITEM, NOW - (7 - day) * DAY, day === 2 ? 'again' : 'good');
    await practise(storage, OTHER, NOW - (7 - day) * DAY + 1000);
  }
  await storage.sessions.put({
    id: 'session-1',
    course: { language: 'es', level: 'a1' },
    startedAt: NOW - DAY,
    endedAt: NOW - DAY + 60_000,
    planned: 10,
    completed: 10,
    correct: 9,
  });
  await storage.batches.put({
    id: 'batch-1',
    label: 'Words · Nouns',
    course: { language: 'es', level: 'a1' },
    itemIds: [ITEM, OTHER],
    createdAt: NOW - 3 * DAY,
    perSession: 5,
  });
  await storage.preferences.write({ displayName: 'Ada', palette: 'sand', readingSize: 'large' });
  await storage.courses.write('es', { level: 'a2', voiceName: 'Mónica' });
  return storage;
}

describe('exporting', () => {
  it('carries the whole log, not the recent page of it', async () => {
    const storage = await usedDevice();

    const envelope = await buildExport(storage, options);

    expect(envelope.app).toBe(APP);
    expect(envelope.schema).toBe(EXPORT_SCHEMA);
    // Ten attempts across two items — the number the device actually holds.
    expect(envelope.attempts).toHaveLength(10);
    expect(envelope.progress).toHaveLength(2);
    expect(envelope.sessions).toHaveLength(1);
    expect(envelope.batches).toHaveLength(1);
    expect(envelope.preferences.displayName).toBe('Ada');
    expect(envelope.courses['es']?.level).toBe('a2');
    // Which algorithm built the projections, so a replay under another one is a
    // deliberate rebuild rather than something an import does quietly.
    expect(envelope.scheduler).toBe('fsrs-v1');
  });

  /** The learner's day rather than Greenwich's — see the note on the helper. */
  it('names the file by the day it was written', () => {
    const at = new Date(NOW);
    const pad = (value: number) => String(value).padStart(2, '0');
    expect(exportFileName(APP, NOW)).toBe(
      `linguastein-progress-${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}.json`,
    );
  });
});

describe('a round trip', () => {
  /**
   * The property the feature is for: serialise, restore onto an empty device,
   * and the two devices hold the same thing. Nothing is compared field by field
   * against a literal — a second export of the restored device is what proves it,
   * because it exercises the same reader a learner's file would go through.
   */
  it('restores an empty device to exactly what was exported', async () => {
    const source = await usedDevice();
    const file = serialiseExport(await buildExport(source, options));

    const restored = createMemoryStorage();
    const parsed = parseExport(JSON.parse(file), APP);
    expect(parsed.issues).toEqual([]);
    const report = await applyExport(restored, parsed.envelope!, importing);

    expect(report.attemptsAdded).toBe(10);
    expect(report.attemptsAlreadyHeld).toBe(0);
    expect(report.itemsRebuilt).toBe(2);
    expect(report.orphans).toBe(0);

    const again = await buildExport(restored, options);
    const before = await buildExport(source, options);
    expect(sorted(again)).toEqual(sorted(before));
  });

  /**
   * Importing the same file twice is what an interrupted import looks like from
   * the outside, and a learner will do it. It must not double anything.
   */
  it('is idempotent', async () => {
    const source = await usedDevice();
    const envelope = await buildExport(source, options);
    const target = createMemoryStorage();

    await applyExport(target, envelope, importing);
    const second = await applyExport(target, envelope, importing);

    expect(second.attemptsAdded).toBe(0);
    expect(second.attemptsAlreadyHeld).toBe(10);
    expect(await target.attempts.count()).toBe(10);
    expect(sorted(await buildExport(target, options))).toEqual(sorted(envelope));
  });
});

describe('merging into a device that has been used', () => {
  /**
   * The case a "replace everything" import would destroy, and the reason there
   * is no such mode: history the file does not know about has to survive it.
   */
  it('keeps local history the file does not contain', async () => {
    const phone = await usedDevice();
    const envelope = await buildExport(phone, options);

    const laptop = createMemoryStorage();
    const third = id<ItemId>('test-es:item:003');
    await practise(laptop, third, NOW - 2 * DAY);

    await applyExport(laptop, envelope, importing);

    expect(await laptop.attempts.count()).toBe(11);
    expect(await laptop.progress.get(third)).toBeDefined();
  });

  /**
   * **The heart of it.** Two devices practise the same item apart, and the
   * merged row must be the fold of both logs — not either device's row, and not
   * a sum of counters. Asserted against `replaySubject` over the union rather than
   * against numbers written here, so the test states the invariant instead of
   * restating an implementation.
   */
  it('rebuilds a contested item from both logs', async () => {
    const phone = createMemoryStorage();
    const laptop = createMemoryStorage();
    const onPhone: Attempt[] = [];
    const onLaptop: Attempt[] = [];

    // Interleaved in time, and on purpose: the file's attempts are partly
    // *older* than the local ones, so folding only the tail would be wrong.
    for (let day = 0; day < 6; day++) {
      const attempt = await practise(phone, ITEM, NOW - (10 - day) * DAY);
      onPhone.push(attempt);
    }
    for (let day = 0; day < 4; day++) {
      const attempt = await practise(laptop, ITEM, NOW - (9 - day * 2) * DAY, 'again');
      onLaptop.push(attempt);
    }

    await applyExport(laptop, await buildExport(phone, options), importing);

    const merged = await laptop.progress.get(ITEM);
    expect(merged).toEqual(replaySubject(ITEM, [...onPhone, ...onLaptop]));
    // The counters are the fold's, so nothing was lost the way last-write-wins
    // would have lost it: ten attempts recorded, ten counted.
    expect(merged?.attempts).toBe(10);
    expect(await laptop.attempts.count()).toBe(10);
  });

  it('leaves untouched items alone', async () => {
    const laptop = await usedDevice();
    const before = await laptop.progress.get(OTHER);

    const phone = createMemoryStorage();
    await practise(phone, ITEM, NOW);
    const report = await applyExport(laptop, await buildExport(phone, options), importing);

    expect(report.itemsRebuilt).toBe(1);
    expect(await laptop.progress.get(OTHER)).toEqual(before);
  });

  it('keeps a set the device already has, and adds one it does not', async () => {
    const laptop = await usedDevice();
    const phone = await usedDevice();
    await phone.batches.put({
      id: 'batch-2',
      label: 'Words · Verbs',
      course: { language: 'es', level: 'a1' },
      itemIds: [ITEM],
      createdAt: NOW,
    });

    const report = await applyExport(laptop, await buildExport(phone, options), importing);

    expect(report.batchesAdded.map((batch) => batch.id)).toEqual(['batch-2']);
    expect((await laptop.batches.all()).map((batch) => batch.id).sort()).toEqual([
      'batch-1',
      'batch-2',
    ]);
  });

  /**
   * Settings are wholesale or not at all — never field-merged, because a
   * half-merged course state is one neither device chose. Declining leaves this
   * device's own choices exactly as they were.
   */
  it('takes the file’s settings only when asked', async () => {
    const phone = await usedDevice();
    const envelope = await buildExport(phone, options);

    const kept = createMemoryStorage();
    await kept.preferences.write({ displayName: 'Bea', palette: 'slate' });
    await applyExport(kept, envelope, { ...importing, settings: false });
    expect((await kept.preferences.read()).displayName).toBe('Bea');
    expect((await kept.preferences.read()).palette).toBe('slate');

    const taken = createMemoryStorage();
    await taken.preferences.write({ displayName: 'Bea', palette: 'slate' });
    await applyExport(taken, envelope, { ...importing, settings: true });
    expect((await taken.preferences.read()).displayName).toBe('Ada');
    expect((await taken.preferences.read()).palette).toBe('sand');
    expect((await taken.courses.read())['es']?.voiceName).toBe('Mónica');
  });
});

describe('a file from the version before the rename', () => {
  /**
   * The compatibility shim, and the only reason the envelope carries a version.
   *
   * A v1 file says `itemId` where a v2 file says `subject`. Every row in one is
   * about an item, so reading it loses nothing — it simply arrives under the
   * name it had. Written out by hand rather than captured from a build, because
   * what is being pinned is the *format*, not whatever happened to be on a
   * device the day it was saved.
   */
  const v1 = {
    app: APP,
    schema: 1,
    exportedAt: NOW,
    scheduler: 'fsrs-v1',
    packs: [{ id: 'test-es', version: '1.0.0' }],
    preferences: { displayName: 'Ada' },
    courses: { es: { level: 'a2' } },
    progress: [
      {
        itemId: ITEM,
        packId: 'test-es',
        status: 'review',
        attempts: 1,
        correct: 1,
        incorrect: 0,
        difficulty: 0.3,
        hintsUsed: 0,
        streak: 1,
        updatedAt: NOW - DAY,
      },
    ],
    attempts: [
      {
        id: 'old-1',
        itemId: ITEM,
        exerciseKind: 'think-say',
        grade: 'good',
        at: NOW - DAY,
      },
    ],
    sessions: [],
    batches: [],
  };

  it('reads it, and the rows arrive as subjects', async () => {
    const parsed = parseExport(v1, APP);

    expect(parsed.issues).toEqual([]);
    expect(parsed.envelope?.attempts[0]?.subject).toBe(ITEM);
    expect(parsed.envelope?.progress[0]?.subject).toBe(ITEM);

    const target = createMemoryStorage();
    const report = await applyExport(target, parsed.envelope!, importing);

    expect(report.attemptsAdded).toBe(1);
    expect((await target.progress.get(ITEM))?.subject).toBe(ITEM);
  });

  /** A row with neither spelling is a row that says nothing about what it is. */
  it('drops a row that names no subject at all', () => {
    const parsed = parseExport(
      { ...v1, attempts: [{ id: 'x', exerciseKind: 'reveal', grade: 'good', at: NOW }] },
      APP,
    );

    expect(parsed.envelope?.attempts).toHaveLength(0);
    expect(parsed.issues[0]?.message).toMatch(/neither `subject` nor `itemId`/);
  });
});

describe('a subject that is not an item', () => {
  const PATTERN = id<EntityId>('test-es:skill:numerals-y-joining');

  /**
   * The whole point of the widening, carried end to end: a drill's evidence has
   * to survive an export and a merge exactly as a sentence's does, or a learner
   * loses it on the one day a backup is what they have.
   */
  it('round-trips a pattern the same way a sentence does', async () => {
    const source = createMemoryStorage();
    const { progress, attempt } = recordAttempt(
      undefined,
      { subject: PATTERN, exerciseKind: 'think-say', grade: 'good' },
      NOW - DAY,
    );
    await source.progress.put(progress);
    await source.attempts.append(attempt);

    const envelope = await buildExport(source, options);
    const parsed = parseExport(JSON.parse(serialiseExport(envelope)), APP);
    expect(parsed.issues).toEqual([]);

    const target = createMemoryStorage();
    const report = await applyExport(target, parsed.envelope!, importing);

    expect(report.attemptsAdded).toBe(1);
    expect(report.itemsRebuilt).toBe(1);
    expect(await target.progress.get(PATTERN)).toEqual(progress);
  });

  /**
   * A pattern belongs to a pack like anything else, so a device without that
   * pack counts it as an orphan and keeps it — the rule that stops an import on
   * the wrong device throwing away a year of work.
   */
  it('counts as an orphan where its pack is not installed', async () => {
    const source = createMemoryStorage();
    const { progress, attempt } = recordAttempt(
      undefined,
      { subject: PATTERN, exerciseKind: 'think-say', grade: 'good' },
      NOW - DAY,
    );
    await source.progress.put(progress);
    await source.attempts.append(attempt);

    const target = createMemoryStorage();
    const report = await applyExport(target, await buildExport(source, options), {
      installedPacks: ['core-fr'],
      settings: false,
    });

    expect(report.orphans).toBe(1);
    expect(await target.progress.count()).toBe(1);
  });
});

describe('a file that is not quite right', () => {
  it('refuses another app’s file', () => {
    const parsed = parseExport({ app: 'something-else', schema: 1, exportedAt: NOW }, APP);

    expect(parsed.envelope).toBeUndefined();
    expect(parsed.issues[0]?.message).toMatch(/written by “something-else”/);
  });

  it('refuses a format it cannot read, and says to update', () => {
    const parsed = parseExport({ app: APP, schema: EXPORT_SCHEMA + 1, exportedAt: NOW }, APP);

    expect(parsed.envelope).toBeUndefined();
    expect(parsed.issues[0]?.message).toMatch(/Update the app/);
  });

  it('refuses something that is not an export at all', () => {
    expect(parseExport({ hello: 'world' }, APP).envelope).toBeUndefined();
    expect(parseExport('a string', APP).envelope).toBeUndefined();
  });

  /**
   * The precedent `src/data/validation` sets: report and skip, never reject the
   * lot. Three unreadable attempts must not cost a learner the other nine
   * hundred — this is a backup being restored, and it is the last copy.
   */
  it('drops the rows it cannot read and keeps the rest', async () => {
    const source = await usedDevice();
    const envelope = await buildExport(source, options);
    const damaged = {
      ...envelope,
      attempts: [
        ...envelope.attempts.slice(0, 8),
        { id: 'broken', subject: 'not-an-item-id', grade: 'good', at: NOW },
        { nonsense: true },
      ],
    };

    const parsed = parseExport(JSON.parse(JSON.stringify(damaged)), APP);

    expect(parsed.envelope?.attempts).toHaveLength(8);
    expect(parsed.issues).toHaveLength(2);
    expect(parsed.issues.every((issue) => issue.severity === 'warning')).toBe(true);
    // Named, so the report points at a row rather than at a number.
    expect(parsed.issues[0]?.id).toBe('broken');

    const target = createMemoryStorage();
    const report = await applyExport(target, parsed.envelope!, importing);
    expect(report.attemptsAdded).toBe(8);
  });

  /**
   * An edited settings block is repaired per field rather than obeyed or
   * rejected — the same boundary that reads a stale record out of storage, which
   * is exactly why it was built before there was an importer.
   */
  it('repairs settings rather than obeying them', () => {
    const parsed = parseExport(
      {
        app: APP,
        schema: 1,
        exportedAt: NOW,
        preferences: { displayName: 'Ada', palette: 'not-a-palette', readingSize: 'large' },
      },
      APP,
    );

    expect(parsed.envelope?.preferences.displayName).toBe('Ada');
    expect(parsed.envelope?.preferences.readingSize).toBe('large');
    expect(parsed.envelope?.preferences.palette).not.toBe('not-a-palette');
  });

  /**
   * Architecture rule 4 is what makes this survivable, so the count is reported
   * and the rows are kept. Pruning them would mean a learner who imports on a
   * device holding only the French pack loses a year of Spanish.
   */
  it('counts rows whose pack is not installed, and keeps them', async () => {
    const source = await usedDevice();
    const envelope = await buildExport(source, options);

    const target = createMemoryStorage();
    const report = await applyExport(target, envelope, {
      installedPacks: ['core-fr'],
      settings: false,
    });

    expect(report.orphans).toBe(2);
    expect(await target.progress.count()).toBe(2);
    expect(await target.attempts.count()).toBe(10);
  });
});

/** Order is not part of the contract; content is. */
function sorted(envelope: Awaited<ReturnType<typeof buildExport>>) {
  const by = <T extends { id: string }>(rows: readonly T[]) =>
    [...rows].sort((a, b) => a.id.localeCompare(b.id));
  return {
    ...envelope,
    attempts: by(envelope.attempts),
    sessions: by(envelope.sessions),
    batches: by(envelope.batches),
    progress: [...envelope.progress].sort((a, b) => a.subject.localeCompare(b.subject)),
  };
}
