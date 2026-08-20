import { useEffect, useId, useState } from 'react';
import { useServices } from '../app/services-context';
import type { TtsVoice } from '../audio';
import { PRONUNCIATION_LOCALES } from '../domain/content';
import { Button } from './Button';
import styles from './VoiceSettings.module.css';

/** Sample the "Test voice" button speaks — short, and in the target language. */
export const VOICE_SAMPLE = 'Tengo que trabajar.';

interface VoiceSettingsProps {
  /**
   * `panel` is the sticky voice menu, `page` the Settings screen. The controls
   * are identical; only the density and the trailing explanation differ, so
   * the two surfaces cannot drift apart in what they can actually change.
   */
  readonly variant?: 'page' | 'panel';
}

/**
 * Everything that decides how the app sounds: accent, voice, speed, and
 * whether it speaks on its own. One component behind both the voice menu in
 * the header and the Audio section of Settings.
 *
 * The voices are the device's own — `speechSynthesis`, listed by the operating
 * system — so this picker offers what is installed and nothing more. Reviewed
 * audio shipped with a dataset, where a pack has any, is played ahead of all
 * of it.
 */
export function VoiceSettings({ variant = 'page' }: VoiceSettingsProps) {
  const { services, preferences, updatePreferences } = useServices();
  const ids = useId();
  const [voices, setVoices] = useState<readonly TtsVoice[]>([]);
  const [active, setActive] = useState<TtsVoice | undefined>(undefined);

  const locale = preferences.pronunciationLocale;

  // The browser loads its voice list asynchronously, so wait for it before
  // deciding what to offer (and before claiming there is nothing).
  useEffect(() => {
    let cancelled = false;
    void services.audio.ready().then(() => {
      if (cancelled) return;
      setVoices(services.audio.voicesFor(locale));
      setActive(services.audio.voiceFor(locale, preferences.voiceName || undefined));
    });
    return () => {
      cancelled = true;
    };
  }, [services.audio, locale, preferences.voiceName]);

  const testVoice = () =>
    void services.audio.speak({
      text: VOICE_SAMPLE,
      locale,
      voice: preferences.voiceName || undefined,
    });

  const silent = voices.length === 0;

  return (
    <div className={`${styles.controls} ${variant === 'panel' ? styles.panel : ''}`}>
      {/* What is actually going to speak, named rather than implied: "best
          match automatically" is not an answer to "why does it sound like
          that?". */}
      <p className={styles.status} role="status">
        {silent ? (
          <>
            <span aria-hidden="true">🔇</span> Silent — no {locale} voice on this device
          </>
        ) : (
          <>
            <span aria-hidden="true">🔊</span> Speaking as{' '}
            <strong>{active?.name ?? 'the device default'}</strong>
            {active && <span className={styles.tag}> {active.locale}</span>}
          </>
        )}
      </p>

      <div className={styles.field}>
        <label className={styles.label} htmlFor={`${ids}-accent`}>
          Accent
        </label>
        <select
          id={`${ids}-accent`}
          value={locale}
          onChange={(event) =>
            // A voice chosen for one accent should not survive into another.
            updatePreferences({ pronunciationLocale: event.target.value, voiceName: '' })
          }
        >
          {PRONUNCIATION_LOCALES.map((option) => (
            <option key={option.locale} value={option.locale}>
              {option.label} ({option.locale})
            </option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor={`${ids}-voice`}>
          Voice
        </label>
        <select
          id={`${ids}-voice`}
          value={preferences.voiceName}
          disabled={silent}
          onChange={(event) => updatePreferences({ voiceName: event.target.value })}
        >
          <option value="">Best match automatically</option>
          {voices.map((voice) => (
            <option key={voice.name} value={voice.name}>
              {voice.name} ({voice.locale})
            </option>
          ))}
        </select>
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

      {silent ? (
        <p className={styles.hint}>
          Nothing is spoken — the app stays quiet rather than reading Spanish with a voice from
          another language. Add a Spanish voice in your operating system’s speech settings, or use
          a dataset that ships reviewed audio.
        </p>
      ) : (
        <>
          <div className={styles.actions}>
            <Button onClick={testVoice}>Test voice</Button>
            <Button variant="ghost" onClick={() => services.audio.stop()}>
              Stop
            </Button>
          </div>
          {variant === 'page' && (
            <p className={styles.hint}>
              {voices.length} voice(s) installed for {locale}. These come from your device, not
              from the app; reviewed audio in a dataset always takes priority over them.
            </p>
          )}
        </>
      )}
    </div>
  );
}
