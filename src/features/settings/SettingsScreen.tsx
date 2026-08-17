import { useState } from 'react';
import { useServices } from '../../app/services-context';
import { AppShell } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { PRONUNCIATION_LOCALES, REFERENCE_LANGUAGES } from '../../domain/content';
import styles from './SettingsScreen.module.css';

export function SettingsScreen() {
  const { services, preferences, updatePreferences } = useServices();
  const [cleared, setCleared] = useState(false);

  const resetProgress = async () => {
    await services.storage.progress.clear();
    await services.storage.attempts.clear();
    await services.storage.sessions.clear();
    setCleared(true);
  };

  const errors = services.datasetIssues.filter((issue) => issue.severity === 'error');

  return (
    <AppShell title="Settings" onBack="history">
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

      <label className={styles.field}>
        <span className={styles.label}>Pronunciation</span>
        <select
          value={preferences.pronunciationLocale}
          onChange={(event) => updatePreferences({ pronunciationLocale: event.target.value })}
        >
          {PRONUNCIATION_LOCALES.map((locale) => (
            <option key={locale.locale} value={locale.locale}>
              {locale.label} ({locale.locale})
            </option>
          ))}
        </select>
      </label>

      <label className={styles.toggle}>
        <input
          type="checkbox"
          checked={preferences.autoPlayAudio}
          onChange={(event) => updatePreferences({ autoPlayAudio: event.target.checked })}
        />
        <span>Play audio automatically</span>
      </label>

      <label className={styles.toggle}>
        <input
          type="checkbox"
          checked={preferences.slowAudio}
          onChange={(event) => updatePreferences({ slowAudio: event.target.checked })}
        />
        <span>Prefer slow playback</span>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Theme</span>
        <select
          value={preferences.theme}
          onChange={(event) =>
            updatePreferences({ theme: event.target.value as typeof preferences.theme })
          }
        >
          <option value="system">Follow system</option>
          <option value="dark">Dark</option>
          <option value="light">Light</option>
        </select>
      </label>

      <section className={styles.field}>
        <span className={styles.label}>Content</span>
        <p className={styles.hint}>
          {services.repository.itemCount} items in {services.repository.packs.length} pack(s).
          {errors.length > 0 && ` ${errors.length} dataset error(s) were skipped.`}
        </p>
      </section>

      <Button block onClick={() => void resetProgress()}>
        {cleared ? 'Progress cleared ✓' : 'Reset progress'}
      </Button>
    </AppShell>
  );
}
