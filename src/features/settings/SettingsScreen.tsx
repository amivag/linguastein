import { useEffect, useState } from 'react';
import { useServices } from '../../app/services-context';
import type { TtsVoice } from '../../audio';
import { AppShell } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { ThemeToggle } from '../../components/ThemeToggle';
import { PRONUNCIATION_LOCALES, REFERENCE_LANGUAGES } from '../../domain/content';
import { buildDate, buildLabel } from '../../app/version';
import styles from './SettingsScreen.module.css';

/** Sample used by the "Test voice" button. */
const VOICE_SAMPLE = 'Tengo que trabajar.';

/**
 * Resetting is a three-state control rather than one button, because the action
 * is irreversible and there is nowhere to restore from: learner state is local
 * to the device by design, so a mis-tap is the whole history gone.
 */
type ResetState = 'idle' | 'confirming' | 'cleared';

export function SettingsScreen() {
  const { services, preferences, updatePreferences } = useServices();
  const [reset, setReset] = useState<ResetState>('idle');
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
    // Preferences are deliberately kept: nobody asking to clear their history
    // is also asking to have their voice and theme picked again.
    setReset('cleared');
  };

  const testVoice = () =>
    void services.audio.speak({
      text: VOICE_SAMPLE,
      locale: preferences.pronunciationLocale,
      voice: preferences.voiceName || undefined,
    });

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
