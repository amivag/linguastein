import { useEffect, useState } from 'react';
import { useServices } from '../../app/services-context';
import type { TtsVoice } from '../../audio';
import { AppShell } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { ThemeToggle } from '../../components/ThemeToggle';
import { PRONUNCIATION_LOCALES, REFERENCE_LANGUAGES } from '../../domain/content';
import styles from './SettingsScreen.module.css';

/** Sample used by the "Test voice" button. */
const VOICE_SAMPLE = 'Tengo que trabajar.';

export function SettingsScreen() {
  const { services, preferences, updatePreferences } = useServices();
  const [cleared, setCleared] = useState(false);
  const [voices, setVoices] = useState<readonly TtsVoice[]>([]);

  // The browser loads its voice list asynchronously, so wait for it before
  // deciding what to offer (and before claiming there is nothing).
  useEffect(() => {
    let cancelled = false;
    void services.audio.ready().then(() => {
      if (!cancelled) setVoices(services.audio.voicesFor(preferences.pronunciationLocale));
    });
    return () => {
      cancelled = true;
    };
  }, [services.audio, preferences.pronunciationLocale]);

  const resetProgress = async () => {
    await services.storage.progress.clear();
    await services.storage.attempts.clear();
    await services.storage.sessions.clear();
    setCleared(true);
  };

  const testVoice = () =>
    void services.audio.speak({
      text: VOICE_SAMPLE,
      locale: preferences.pronunciationLocale,
      voice: preferences.voiceName || undefined,
    });

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
          onChange={(event) =>
            // A voice chosen for one accent should not survive into another.
            updatePreferences({ pronunciationLocale: event.target.value, voiceName: '' })
          }
        >
          {PRONUNCIATION_LOCALES.map((locale) => (
            <option key={locale.locale} value={locale.locale}>
              {locale.label} ({locale.locale})
            </option>
          ))}
        </select>
      </label>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="voice">
          Voice
        </label>
        <select
          id="voice"
          value={preferences.voiceName}
          disabled={voices.length === 0}
          onChange={(event) => updatePreferences({ voiceName: event.target.value })}
        >
          <option value="">Best match automatically</option>
          {voices.map((voice) => (
            <option key={voice.name} value={voice.name}>
              {voice.name} ({voice.locale})
            </option>
          ))}
        </select>
        {voices.length === 0 ? (
          <span className={styles.hint}>
            This device has no {preferences.pronunciationLocale} voice installed, so nothing is
            spoken — the app stays silent rather than reading Spanish with a voice from another
            language. Add a Spanish voice in your operating system’s speech settings, or use a
            dataset that ships reviewed audio.
          </span>
        ) : (
          <>
            <Button onClick={testVoice}>Test voice</Button>
            <span className={styles.hint}>
              {voices.length} voice(s) available for {preferences.pronunciationLocale}. Reviewed
              audio in a dataset always takes priority over these.
            </span>
          </>
        )}
      </div>

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

      <div className={styles.field}>
        <span className={styles.label} id="theme-label">
          Theme
        </span>
        <ThemeToggle />
        <span className={styles.hint} aria-hidden="true">
          System follows your device setting and switches with it.
        </span>
      </div>

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
