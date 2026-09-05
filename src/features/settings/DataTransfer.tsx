import { useId, useRef, useState } from 'react';
import { APP } from '../../app/identity';
import { useServices } from '../../app/services-context';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import {
  applyExport,
  buildExport,
  exportFileName,
  parseExport,
  serialiseExport,
  type ImportIssue,
  type ImportReport,
  type LearnerExport,
} from '../../storage/transfer';
import styles from './Settings.module.css';

/**
 * Taking your practice off the device, and putting it back.
 *
 * There is no account and no server, which the section above this one says
 * plainly — so a file is the only backup a learner can have, and a browser
 * evicting the app's storage is the thing it exists to survive. It is also the
 * same four records a sync would need (`docs/tasks/accounts-and-sync.md`), which
 * is why the merge lives in `storage/transfer` rather than here: this file asks,
 * confirms and reports, and decides nothing.
 *
 * **Import is a merge, and the confirm says so.** The counts a learner sees
 * before agreeing are the counts of what will be *added* — an import that would
 * add nothing says that instead of pretending to work, and one run twice adds
 * nothing the second time. The dangerous framing here would be "restore", which
 * implies the device is about to be overwritten; nothing here deletes anything.
 *
 * The one thing that does replace rather than add is settings, so it is a choice
 * rather than a consequence, and it is off by default: somebody merging a second
 * device's history is not usually asking for that device's theme.
 */
export function DataTransfer() {
  const { services, updatePreferences, updateCourse, saveBatch } = useServices();
  const ids = useId();
  const fileInput = useRef<HTMLInputElement>(null);

  const [saved, setSaved] = useState<string | null>(null);
  const [pending, setPending] = useState<LearnerExport | null>(null);
  const [issues, setIssues] = useState<readonly ImportIssue[]>([]);
  const [takeSettings, setTakeSettings] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);

  const packs = services.repository.packs.map((manifest) => ({
    id: manifest.id,
    version: manifest.version,
  }));

  const save = async () => {
    const envelope = await buildExport(services.storage, {
      packs,
      now: Date.now(),
      app: APP.id,
    });
    const name = exportFileName(APP.id, envelope.exportedAt);
    download(name, serialiseExport(envelope));
    setSaved(name);
  };

  const choose = async (file: File) => {
    setReport(null);
    setSaved(null);
    let value: unknown;
    try {
      value = JSON.parse(await file.text());
    } catch {
      setPending(null);
      setIssues([
        { severity: 'error', section: 'file', message: 'That file is not readable JSON.' },
      ]);
      return;
    }

    const parsed = parseExport(value, APP.id);
    setIssues(parsed.issues);
    setPending(parsed.envelope ?? null);
  };

  const confirm = async (envelope: LearnerExport) => {
    const result = await applyExport(services.storage, envelope, {
      installedPacks: packs.map((pack) => pack.id),
      settings: takeSettings,
    });

    /*
     * The live app catches up with what was just written, rather than the
     * learner being asked to reload to see it — the same call the reset control
     * makes, and for the same reason. `saveBatch` writes the row a second time;
     * it is an idempotent `put` of a handful of records, and the alternative is
     * two places that both have to remember.
     */
    if (takeSettings) {
      updatePreferences(envelope.preferences);
      for (const [language, state] of Object.entries(envelope.courses)) {
        updateCourse(language, state);
      }
    }
    for (const batch of result.batchesAdded) saveBatch(batch);

    setPending(null);
    setReport(result);
  };

  const dismiss = () => {
    setPending(null);
    setIssues([]);
    // The picker keeps the name of the file it read, and a learner who cancels
    // and picks the same file again would otherwise get no `change` event.
    if (fileInput.current) fileInput.current.value = '';
  };

  const errors = issues.filter((issue) => issue.severity === 'error');

  return (
    <>
      <div className={styles.field}>
        <span className={styles.label}>
          <Icon name="download" size="sm" className={styles.labelIcon} />
          Save a backup
        </span>
        <p className={styles.hint}>
          Everything you have practised, your sets and your settings, as one file you keep. Nothing
          is uploaded — the file goes wherever this browser saves downloads.
        </p>
        <Button block onClick={() => void save()}>
          Save a backup file
        </Button>
        {saved && (
          <p className={styles.resetStatus} role="status">
            <Icon name="check" size="sm" />
            Saved as {saved}.
          </p>
        )}
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor={`${ids}-import`}>
          <Icon name="upload" size="sm" className={styles.labelIcon} />
          Restore from a backup
        </label>
        <p className={styles.hint}>
          Adds what the file holds to what is already here. Nothing on this device is deleted, and
          importing the same file twice changes nothing the second time.
        </p>
        <input
          id={`${ids}-import`}
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void choose(file);
          }}
        />
        {errors.length > 0 && (
          <p className={styles.resetWarning} role="alert">
            {errors.map((issue) => issue.message).join(' ')}
          </p>
        )}
      </div>

      {pending && (
        <Sheet title="Add this backup?" onClose={dismiss}>
          <ul className={styles.stats}>
            <Summary value={pending.attempts.length} label="answers in the file" />
            <Summary value={pending.sessions.length} label="sessions" />
            <Summary value={pending.batches.length} label="sets" />
          </ul>
          <p className={styles.hint}>
            Only what this device does not already have is added, so the numbers above are the most
            it can change. Your review schedule is recalculated from the answers themselves rather
            than copied, which is what makes merging two devices safe.
          </p>

          {/* A choice rather than a consequence: history adds, settings replace,
              and the two should not ride on one press. */}
          <label className={styles.choice} htmlFor={`${ids}-settings`}>
            <input
              id={`${ids}-settings`}
              type="checkbox"
              checked={takeSettings}
              onChange={(event) => setTakeSettings(event.target.checked)}
            />
            <span className={styles.choiceText}>
              <strong className={styles.checkLabel}>Also take the file’s settings</strong>
              <span className={styles.hint}>
                Replaces your name, colours, text size, level, categories and voice with the ones in
                the file. Your practice is added either way.
              </span>
            </span>
          </label>

          {issues.length > 0 && (
            <p className={styles.hint} role="status">
              {issues.length} {issues.length === 1 ? 'record' : 'records'} in the file could not be
              read and will be skipped. Everything else is added.
            </p>
          )}

          <div className={styles.confirm}>
            <Button onClick={dismiss}>Cancel</Button>
            <Button variant="primary" onClick={() => void confirm(pending)}>
              Add to this device
            </Button>
          </div>
        </Sheet>
      )}

      {report && (
        <p className={styles.resetStatus} role="status">
          <Icon name="check" size="sm" />
          {describe(report)}
        </p>
      )}
    </>
  );
}

/**
 * What the import actually did, in the terms it did it.
 *
 * "Nothing to add" is a real outcome and the one worth naming: it is what a
 * second run of the same file looks like, and a learner who sees "imported" both
 * times cannot tell a working import from one that silently did nothing.
 */
function describe(report: ImportReport): string {
  /*
   * Only what moved, and never a zero. A file can legitimately add a set and no
   * answers — restoring a set somebody deleted is exactly that — and leading
   * with "0 answers added" makes a working import read as a failed one.
   */
  const parts = [
    report.attemptsAdded > 0 ? count(report.attemptsAdded, 'answer') : '',
    report.itemsRebuilt > 0 ? `${count(report.itemsRebuilt, 'item')} rescheduled` : '',
    report.sessionsAdded > 0 ? count(report.sessionsAdded, 'session') : '',
    report.batchesAdded.length > 0 ? count(report.batchesAdded.length, 'set') : '',
    // Reported rather than hidden: the rows are kept, and a learner whose packs
    // have changed should know why some of their history has nothing to point at.
    report.orphans > 0
      ? `${count(report.orphans, 'item')} from a pack this device does not have`
      : '',
  ].filter(Boolean);

  return parts.length === 0
    ? 'Nothing to add — this device already had everything in that file.'
    : `Added: ${parts.join(' · ')}.`;
}

const count = (value: number, noun: string) => `${value} ${value === 1 ? noun : `${noun}s`}`;

function Summary({ value, label }: { readonly value: number; readonly label: string }) {
  return (
    <li className={styles.stat}>
      <span className={styles.statValue}>{value.toLocaleString()}</span>
      <span className={styles.statLabel}>{label}</span>
    </li>
  );
}

/**
 * A file the browser saves, from a string the app made.
 *
 * An object URL rather than a `data:` one: a year of attempts is megabytes, and
 * some browsers cap a `data:` URL well below that. Revoked immediately — the
 * click has already handed the blob to the download, and an un-revoked URL keeps
 * the whole file in memory for the life of the document.
 */
function download(name: string, contents: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
