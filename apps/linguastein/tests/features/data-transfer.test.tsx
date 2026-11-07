/**
 * Backup and restore, as a learner meets it.
 *
 * The storage-level merge is tested in `tests/storage/transfer.test.ts`; what is
 * worth asserting here is the part that decides whether somebody trusts the
 * feature. **The confirm has to name what will happen** — an import adds and
 * never deletes, and the numbers shown before agreeing are the most it can
 * change. **Settings replace rather than add**, so they are a separate choice
 * and off unless asked for. And a file that cannot be read has to say so instead
 * of appearing to work.
 */

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ItemId } from '../../src/domain/content';
import { recordAttempt } from '../../src/domain/progress';
import { SettingsScreen } from '../../src/features/settings/SettingsScreen';
import { createMemoryStorage, type LearnerStorage } from '../../src/storage';
import { buildExport, serialiseExport } from '../../src/storage/transfer';
import { id } from '../fixtures/pack';
import { renderWithServices, testServices } from '../fixtures/services';

const ITEM = id<ItemId>('test-es:item:001');
const NOW = 1_757_030_400_000;
const ROUTE = '/es/all/settings?tab=user';

/** jsdom implements neither, and a download is the whole point of the button. */
let downloads: { name: string; blob: Blob }[] = [];

beforeEach(() => {
  downloads = [];
  // The blob is kept rather than read here: `createObjectURL` is synchronous and
  // `Blob.text()` is not, so reading it now would hand the assertion an empty
  // string — and a test that only checked the file *name* would pass on an
  // empty file, which is the failure worth catching.
  let pending: Blob | undefined;
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: (blob: Blob) => {
      pending = blob;
      return 'blob:test';
    },
    revokeObjectURL: () => {},
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    if (pending) downloads.push({ name: this.download, blob: pending });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** A device with something on it, so an export has something to carry. */
async function practised(): Promise<LearnerStorage> {
  const storage = createMemoryStorage();
  const { progress, attempt } = recordAttempt(
    undefined,
    { subject: ITEM, exerciseKind: 'think-say', grade: 'good' },
    NOW - 86_400_000,
  );
  await storage.progress.put(progress);
  await storage.attempts.append(attempt);
  await storage.preferences.write({ displayName: 'Ada', readingSize: 'large' });
  return storage;
}

/** The file such a device would write, as a `File` a picker can be handed. */
async function backupFile(storage?: LearnerStorage): Promise<File> {
  const envelope = await buildExport(storage ?? (await practised()), {
    packs: [{ id: 'test-es', version: '1.0.0' }],
    now: NOW,
    app: 'linguastein',
  });
  return new File([serialiseExport(envelope)], 'backup.json', { type: 'application/json' });
}

/** A second device holding the same answers, so only new records stand out. */
async function sameHistoryAs(source: LearnerStorage): Promise<LearnerStorage> {
  const twin = createMemoryStorage();
  await twin.attempts.appendMany(await source.attempts.all());
  await twin.progress.putMany(await source.progress.all());
  return twin;
}

describe('saving a backup', () => {
  it('writes a dated file with the learner’s history in it', async () => {
    const user = userEvent.setup();
    renderWithServices(<SettingsScreen />, {
      services: testServices({ storage: await practised() }),
      route: ROUTE,
    });

    await user.click(await screen.findByRole('button', { name: 'Save a backup file' }));

    expect(downloads).toHaveLength(1);
    const [saved] = downloads;
    expect(saved?.name).toMatch(/^linguastein-progress-\d{4}-\d{2}-\d{2}\.json$/);
    const written = JSON.parse(await saved!.blob.text()) as Record<string, unknown>;
    expect(written['app']).toBe('linguastein');
    expect(written['attempts']).toHaveLength(1);

    // Said out loud, because a download in a browser is otherwise invisible:
    // some browsers show no shelf, and "did that work?" has no other answer.
    expect(await screen.findByRole('status')).toHaveTextContent(/Saved as linguastein-progress/);
  });
});

describe('restoring a backup', () => {
  it('names what will be added before it adds it', async () => {
    const user = userEvent.setup();
    renderWithServices(<SettingsScreen />, { route: ROUTE });

    await user.upload(await screen.findByLabelText(/Restore from a backup/), await backupFile());

    const dialog = within(await screen.findByRole('dialog', { name: /Add this backup/ }));
    expect(dialog.getByText('answers in the file')).toBeInTheDocument();
    // The reassurance the whole framing rests on: this adds, it does not replace.
    expect(
      screen.getByText(/Only what this device does not already have is added/),
    ).toBeInTheDocument();
  });

  it('adds the history, and reports what it did', async () => {
    const user = userEvent.setup();
    const storage = createMemoryStorage();
    renderWithServices(<SettingsScreen />, { services: testServices({ storage }), route: ROUTE });

    await user.upload(await screen.findByLabelText(/Restore from a backup/), await backupFile());
    await user.click(await screen.findByRole('button', { name: 'Add to this device' }));

    expect(await screen.findByText(/Added: 1 answer/)).toBeInTheDocument();
    expect(await storage.attempts.count()).toBe(1);
    expect(await storage.progress.count()).toBe(1);
  });

  /**
   * History adds; settings replace. Riding both on one press would mean a
   * learner merging a second device's practice silently inherits its theme.
   */
  it('leaves settings alone unless they are asked for', async () => {
    const user = userEvent.setup();
    const updatePreferences = vi.fn();
    const storage = createMemoryStorage();
    renderWithServices(<SettingsScreen />, {
      services: testServices({ storage }),
      route: ROUTE,
      updatePreferences,
    });

    await user.upload(await screen.findByLabelText(/Restore from a backup/), await backupFile());
    await user.click(await screen.findByRole('button', { name: 'Add to this device' }));

    expect(updatePreferences).not.toHaveBeenCalled();
    expect((await storage.preferences.read()).displayName).toBe('');
  });

  it('takes them when they are', async () => {
    const user = userEvent.setup();
    const storage = createMemoryStorage();
    renderWithServices(<SettingsScreen />, { services: testServices({ storage }), route: ROUTE });

    await user.upload(await screen.findByLabelText(/Restore from a backup/), await backupFile());
    await user.click(screen.getByRole('checkbox', { name: /take the file’s settings/i }));
    await user.click(screen.getByRole('button', { name: 'Add to this device' }));

    await screen.findByText(/Added: 1 answer/);
    expect((await storage.preferences.read()).displayName).toBe('Ada');
  });

  /**
   * "Nothing to add" is a real outcome and the one worth naming: it is what a
   * second run of the same file looks like, and a learner who reads "imported"
   * both times cannot tell a working import from one that did nothing.
   */
  it('says so when there is nothing to add', async () => {
    const user = userEvent.setup();
    // The file this device itself wrote, so every id in it is one it holds —
    // which is exactly the re-import case.
    const storage = await practised();
    renderWithServices(<SettingsScreen />, { services: testServices({ storage }), route: ROUTE });

    await user.upload(
      await screen.findByLabelText(/Restore from a backup/),
      await backupFile(storage),
    );
    await user.click(await screen.findByRole('button', { name: 'Add to this device' }));

    expect(await screen.findByText(/Nothing to add/)).toBeInTheDocument();
  });

  /**
   * A file that adds a set and no answers is a real case — restoring a set
   * somebody deleted is exactly that — and "0 answers added" would make a
   * working import read as a failed one.
   */
  it('names only what actually moved', async () => {
    const user = userEvent.setup();
    const source = await practised();
    await source.batches.put({
      id: 'batch-1',
      label: 'Words · Nouns',
      course: { language: 'es', level: 'a1' },
      itemIds: [ITEM],
      createdAt: NOW,
    });
    // The same history, so only the set is new.
    renderWithServices(<SettingsScreen />, {
      services: testServices({ storage: await sameHistoryAs(source) }),
      route: ROUTE,
    });

    await user.upload(
      await screen.findByLabelText(/Restore from a backup/),
      await backupFile(source),
    );
    await user.click(await screen.findByRole('button', { name: 'Add to this device' }));

    const status = await screen.findByText(/^Added:/);
    expect(status).toHaveTextContent('Added: 1 set.');
    expect(status).not.toHaveTextContent(/0 answers/);
  });

  it('refuses a file that is not an export, and says why', async () => {
    const user = userEvent.setup();
    renderWithServices(<SettingsScreen />, { route: ROUTE });

    await user.upload(
      await screen.findByLabelText(/Restore from a backup/),
      new File(['{"hello":"world"}'], 'nope.json', { type: 'application/json' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(/not a Linguastein export/);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('refuses something that is not JSON at all', async () => {
    const user = userEvent.setup();
    renderWithServices(<SettingsScreen />, { route: ROUTE });

    await user.upload(
      await screen.findByLabelText(/Restore from a backup/),
      new File(['not json'], 'nope.json', { type: 'application/json' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(/not readable JSON/);
  });

  it('changes nothing when the confirm is declined', async () => {
    const user = userEvent.setup();
    const storage = createMemoryStorage();
    renderWithServices(<SettingsScreen />, { services: testServices({ storage }), route: ROUTE });

    await user.upload(await screen.findByLabelText(/Restore from a backup/), await backupFile());
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await storage.attempts.count()).toBe(0);
  });
});
