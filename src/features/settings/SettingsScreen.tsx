import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useServices } from '../../app/services-context';
import { AppShell } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { CourseBar } from '../../components/CourseBar';
import { ThemeToggle } from '../../components/ThemeToggle';
import { VoiceSettings } from '../../components/VoiceSettings';
import { REFERENCE_LANGUAGES } from '../../domain/content';
import { APP } from '../../app/identity';
import { buildDate, buildLabel } from '../../app/version';
import { Icon } from '../../components/Icon';
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
        {/* The same control the course bar offers everywhere else, so there is
            one way to change course rather than two that can disagree. */}
        <div className={styles.field}>
          <span className={styles.label}>
            <Icon name="language" size="sm" className={styles.labelIcon} />
            Learning
          </span>
          <CourseBar />
          <span className={styles.hint}>
            A level is a ceiling, not a chapter: choosing A2 keeps A1 material in rotation as
            review.
          </span>
        </div>
        <label className={styles.field}>
          <span className={styles.label}>
            <Icon name="explain" size="sm" className={styles.labelIcon} />
            Reference language
          </span>
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

      <section className={styles.group} aria-labelledby="group-practice">
        <h2 className={styles.groupTitle} id="group-practice">
          Practice
        </h2>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={preferences.showTimer}
            onChange={(event) => updatePreferences({ showTimer: event.target.checked })}
          />
          <span>Show elapsed time</span>
        </label>
        <span className={styles.hint}>
          How long the session has been running. There is no limit and no penalty — switch it off if
          a clock is a distraction.
        </span>
      </section>

      <section className={styles.group} aria-labelledby="group-appearance">
        <h2 className={styles.groupTitle} id="group-appearance">
          Appearance
        </h2>
        <div className={styles.field}>
          <span className={styles.label} id="theme-label">
            <Icon name="theme" size="sm" className={styles.labelIcon} />
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
          <span className={styles.label}>
            <Icon name="topic" size="sm" className={styles.labelIcon} />
            Content
          </span>
          <p className={styles.hint}>
            {services.repository.itemCount} items in {services.repository.packs.length} pack(s).
            {errors.length > 0 && ` ${errors.length} dataset error(s) were skipped.`}
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
          <span className={styles.label}>
            <Icon name="explain" size="sm" className={styles.labelIcon} />
            Version
          </span>
          {/* The string a bug report should quote, and the pack version beside it:
              content ships and updates independently of the app. */}
          <p className={styles.hint}>
            {APP.name} {buildLabel()}
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
            {reset === 'cleared' ? (
              <>
                <Icon name="check" /> Progress cleared
              </>
            ) : (
              'Reset progress'
            )}
          </Button>
        )}
      </section>
    </AppShell>
  );
}
