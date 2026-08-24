import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { APP } from '../../app/identity';
import { useServices } from '../../app/services-context';
import { buildDate, buildLabel } from '../../app/version';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { DEFAULT_PREFERENCES } from '../../storage';
import { CONTRAST_STORAGE_KEY } from '../../styles/contrast';
import { READING_SIZE_STORAGE_KEY } from '../../styles/reading-size';
import { PALETTE_STORAGE_KEY, THEME_STORAGE_KEY } from '../../styles/themes';
import styles from './Settings.module.css';

/**
 * Resetting is a three-state control rather than one button, because the action
 * is irreversible and there is nowhere to restore from: learner state is local
 * to the device by design, so a mis-tap is the whole history gone.
 */
type ResetTarget = 'progress' | 'all';
type ResetResult = ResetTarget | null;

/** This build, the design system, and the data this device is holding. */
export function AboutSettings() {
  const { services, updatePreferences, batches, removeBatch } = useServices();
  const navigate = useNavigate();
  const [resetTarget, setResetTarget] = useState<ResetTarget | null>(null);
  const [resetResult, setResetResult] = useState<ResetResult>(null);

  const resetProgress = async () => {
    await services.storage.progress.clear();
    await services.storage.attempts.clear();
    await services.storage.sessions.clear();
    // Preferences are deliberately kept: nobody asking to clear their history
    // is also asking to have their voice and theme picked again. Batches are
    // kept for the same reason and a stronger one — a batch is material the
    // learner chose, not evidence of what they did with it, so clearing the
    // evidence hands back the same sets to start again on.
    setResetTarget(null);
    setResetResult('progress');
  };

  const resetAllLocalData = async () => {
    await services.storage.clearAll();
    clearPreferenceCaches();
    // Update the live app as well as storage. Reloading should not be required
    // to see that the reset worked, and the next route should be the same clean
    // A1 course a new install opens.
    updatePreferences(DEFAULT_PREFERENCES);
    // `clearAll` has already emptied the store; this is the live list catching
    // up, which is the same thing the line above does for preferences. Without
    // it a reset would leave every batch on screen until a reload.
    for (const batch of batches) removeBatch(batch.id);
    setResetTarget(null);
    setResetResult('all');
    void navigate(`/${DEFAULT_PREFERENCES.targetLanguage}/${DEFAULT_PREFERENCES.level}`);
  };

  return (
    <>
      <div className={styles.field}>
        <span className={styles.label}>
          <Icon name="explain" size="sm" className={styles.labelIcon} />
          Version
        </span>
        {/* The string a bug report should quote. Pack versions live with the
            packs, where the rest of what a content report needs is too. */}
        <p className={styles.hint}>
          {APP.name} {buildLabel()}
          {buildDate() && ` · built ${buildDate()}`}
        </p>
      </div>

      <div className={styles.field}>
        <span className={styles.label}>
          <Icon name="theme" size="sm" className={styles.labelIcon} />
          Design system
        </span>
        <p className={styles.hint}>
          Every colour role, token, icon and control this build is drawing with, read from the
          stylesheets themselves.
        </p>
        <Link className={styles.link} to="/design">
          Open the design system
          <Icon name="next" size="sm" />
        </Link>
      </div>

      <div className={styles.field}>
        <span className={styles.label}>Learning history</span>
        <p className={styles.hint}>
          Clear attempts, sessions and review schedules while keeping your course and appearance
          settings.
        </p>
        <Button block onClick={() => setResetTarget('progress')}>
          Reset progress
        </Button>
      </div>

      <div className={styles.field}>
        <span className={`${styles.label} ${styles.dangerLabel}`}>
          <Icon name="delete" size="sm" />
          Clean-install testing
        </span>
        <p className={styles.hint}>
          Restore this device to the app defaults, including progress, course, theme, colours,
          contrast, text size, voice and practice preferences.
        </p>
        <Button variant="danger" block onClick={() => setResetTarget('all')}>
          Reset all local data
        </Button>
      </div>

      {resetResult && (
        <p className={styles.resetStatus} role="status">
          <Icon name="check" size="sm" />
          {resetResult === 'progress'
            ? 'Learning history cleared.'
            : 'All local data reset to app defaults.'}
        </p>
      )}

      {resetTarget && (
        <Sheet
          title={resetTarget === 'progress' ? 'Reset progress?' : 'Reset all local data?'}
          onClose={() => setResetTarget(null)}
        >
          {/* Announced, not just coloured: the warning is the only thing
              standing between a tap and an unrecoverable delete. */}
          <p className={styles.resetWarning} role="alert">
            {resetTarget === 'progress'
              ? 'This erases every attempt, session and review schedule stored on this device. Your settings stay unchanged. It cannot be undone.'
              : 'This erases all learning history and restores every app setting on this device to its default. It cannot be undone.'}
          </p>
          <div className={styles.confirm}>
            <Button onClick={() => setResetTarget(null)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() =>
                void (resetTarget === 'progress' ? resetProgress() : resetAllLocalData())
              }
            >
              {resetTarget === 'progress' ? 'Erase learning history' : 'Erase all local data'}
            </Button>
          </div>
        </Sheet>
      )}
    </>
  );
}

/**
 * Removes the pre-paint mirrors; IndexedDB remains the preference source of
 * truth.
 *
 * Every appearance axis has one, and each has to be cleared: a reset that left
 * the palette key behind would restore the defaults everywhere except in the
 * colours, which is the one part of a clean install you can see.
 */
function clearPreferenceCaches(): void {
  try {
    for (const key of [
      THEME_STORAGE_KEY,
      PALETTE_STORAGE_KEY,
      CONTRAST_STORAGE_KEY,
      READING_SIZE_STORAGE_KEY,
    ]) {
      localStorage.removeItem(key);
    }
  } catch {
    // A locked-down browser may refuse localStorage; clearAll still removes the source data.
  }
}
