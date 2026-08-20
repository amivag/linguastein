import { useState } from 'react';
import { useServices } from '../../app/services-context';
import { AppShell } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { ThemeToggle } from '../../components/ThemeToggle';
import { VoiceSettings } from '../../components/VoiceSettings';
import { REFERENCE_LANGUAGES } from '../../domain/content';
import { buildDate, buildLabel } from '../../app/version';
import styles from './SettingsScreen.module.css';

/**
 * Resetting is a three-state control rather than one button, because the action
 * is irreversible and there is nowhere to restore from: learner state is local
 * to the device by design, so a mis-tap is the whole history gone.
 */
type ResetState = 'idle' | 'confirming' | 'cleared';

export function SettingsScreen() {
  const { services, preferences, updatePreferences } = useServices();
  const [reset, setReset] = useState<ResetState>('idle');

  const resetProgress = async () => {
    await services.storage.progress.clear();
    await services.storage.attempts.clear();
    await services.storage.sessions.clear();
    // Preferences are deliberately kept: nobody asking to clear their history
    // is also asking to have their voice and theme picked again.
    setReset('cleared');
  };

  const errors = services.datasetIssues.filter((issue) => issue.severity === 'error');

  return (
    <AppShell title="Settings">
      <section className={styles.group} aria-labelledby="group-language">
        <h2 className={styles.groupTitle} id="group-language">
          Language
        </h2>
        <label className={styles.field}>
          <span className={styles.label}>Reference language</span>
          <select
            value={preferences.referenceLanguage}
            onChange={(event) => updatePreferences({ referenceLanguage: event.target.value })}
          >
            {REFERENCE_LANGUAGES.map((language) => (
              <option key={language.tag} value={language.tag}>
                {language.nativeName}
              </option>
            ))}
          </select>
          <span className={styles.hint}>
            The language meanings are shown in. More will follow — English is only the first.
          </span>
        </label>
      </section>

      <section className={styles.group} aria-labelledby="group-audio">
        <h2 className={styles.groupTitle} id="group-audio">
          Audio
        </h2>
        {/* The same control the header's voice menu opens, so a change made
            in either place is the same change — there is nothing here that the
            menu cannot reach, and nothing in the menu that stops here. */}
        <VoiceSettings />
      </section>

      <section className={styles.group} aria-labelledby="group-appearance">
        <h2 className={styles.groupTitle} id="group-appearance">
          Appearance
        </h2>
        <div className={styles.field}>
          <span className={styles.label} id="theme-label">
            Theme
          </span>
          <ThemeToggle />
          <span className={styles.hint}>
            System follows your device setting and switches with it.
          </span>
        </div>
      </section>

      <section className={styles.group} aria-labelledby="group-data">
        <h2 className={styles.groupTitle} id="group-data">
          Data
        </h2>
        <div className={styles.field}>
          <span className={styles.label}>Content</span>
          <p className={styles.hint}>
            {services.repository.itemCount} items in {services.repository.packs.length} pack(s).
            {errors.length > 0 && ` ${errors.length} dataset error(s) were skipped.`}
          </p>
        </div>

        <div className={styles.field}>
          <span className={styles.label}>Version</span>
          {/* The string a bug report should quote, and the pack version beside it:
              content ships and updates independently of the app. */}
          <p className={styles.hint}>
            Linguastein {buildLabel()}
            {buildDate() && ` · built ${buildDate()}`}
          </p>
          <p className={styles.hint}>
            {services.repository.packs.map((pack) => `${pack.name} ${pack.version}`).join(' · ') ||
              'No content packs loaded'}
          </p>
        </div>

        {reset === 'confirming' ? (
          <>
            {/* Announced, not just coloured: the warning is the only thing
                standing between a tap and an unrecoverable delete. */}
            <p className={styles.hint} role="alert">
              This erases every attempt, session and review schedule stored on this device. It
              cannot be undone.
            </p>
            <div className={styles.confirm}>
              <Button onClick={() => setReset('idle')}>Cancel</Button>
              <Button onClick={() => void resetProgress()}>Erase everything</Button>
            </div>
          </>
        ) : (
          <Button block onClick={() => setReset('confirming')}>
            {reset === 'cleared' ? 'Progress cleared ✓' : 'Reset progress'}
          </Button>
        )}
      </section>
    </AppShell>
  );
}
