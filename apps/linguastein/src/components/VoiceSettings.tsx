import { useEffect, useId, useMemo, useState } from 'react';
import { useCourse, usePronunciationLocale, useVoiceName } from '../app/course';
import { useServices } from '../app/services-context';
import type { TtsVoice } from '../audio';
import { languageOption, pronunciationLocales } from '../domain/content';
import { Button } from './Button';
import { Icon } from '../components/Icon';
import styles from './VoiceSettings.module.css';

/**
 * Sample the "Test voice" button speaks when the course has nothing to offer.
 *
 * A last resort rather than the sample: {@link useVoiceSample} reads a short
 * phrase out of the course itself, because a button that tests a German voice
 * by speaking Spanish tests the wrong thing — and a hard-coded sample is a
 * second place the shipped language is written down.
 */
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
  const { course, state, updateState } = useCourse();
  const ids = useId();
  const [voices, setVoices] = useState<readonly TtsVoice[]>([]);
  const [active, setActive] = useState<TtsVoice | undefined>(undefined);

  const locale = usePronunciationLocale();
  const voice = useVoiceName();
  const accents = useMemo(
    () => pronunciationLocales(services.repository, course.language),
    [services.repository, course.language],
  );
  const sample = useVoiceSample();
  // The advice is only actionable if it names the voice to go and install.
  const languageName = languageOption(course.language).englishName;

  // The browser loads its voice list asynchronously, so wait for it before
  // deciding what to offer (and before claiming there is nothing).
  useEffect(() => {
    let cancelled = false;
    void services.audio.ready().then(() => {
      if (cancelled) return;
      setVoices(services.audio.voicesFor(locale));
      setActive(services.audio.voiceFor(locale, voice));
    });
    return () => {
      cancelled = true;
    };
  }, [services.audio, locale, voice]);

  const testVoice = () =>
    void services.audio.speak({
      text: sample,
      locale,
      voice,
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
            <Icon name="silent" size="sm" /> Silent — no {locale} voice on this device
          </>
        ) : (
          <>
            <Icon name="speak" size="sm" /> Speaking as{' '}
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
            // Written to *this course*: an accent belongs to a language, so
            // choosing `es-MX` here says nothing about a German course.
            updateState({ pronunciationLocale: event.target.value, voiceName: '' })
          }
        >
          {accents.map((option) => (
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
          value={state.voiceName}
          disabled={silent}
          onChange={(event) => updateState({ voiceName: event.target.value })}
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
          Nothing is spoken — the app stays quiet rather than reading {languageName} with a voice
          from another language. Add a {languageName} voice in your operating system’s speech
          settings, or use a dataset that ships reviewed audio.
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
              {voices.length} voice(s) installed for {locale}. These come from your device, not from
              the app; reviewed audio in a dataset always takes priority over them.
            </p>
          )}
        </>
      )}
    </div>
  );
}

/**
 * A short phrase from the course to test a voice with.
 *
 * The shortest sentence in scope, so the sample is a sentence rather than a
 * bare word and still finishes quickly. Sorting by length rather than taking
 * the first is deliberate: pack order opens with whatever the dataset happens
 * to start on, and a fourteen-word one makes a poor button.
 */
function useVoiceSample(): string {
  const { services } = useServices();
  const { filter } = useCourse();
  return useMemo(() => {
    const spoken = services.repository
      .query({ ...filter, types: ['sentence'] })
      .filter((item) => item.text.length > 0);
    const shortest = spoken.reduce<string | undefined>(
      (best, item) => (best === undefined || item.text.length < best.length ? item.text : best),
      undefined,
    );
    return shortest ?? VOICE_SAMPLE;
  }, [services.repository, filter]);
}
