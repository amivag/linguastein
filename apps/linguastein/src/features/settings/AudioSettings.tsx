import { VoiceSettings } from '../../components/VoiceSettings';
import { SpeechInputCheck } from './SpeechInputCheck';
import styles from './Settings.module.css';

/**
 * Audio, in both directions: what the app says, and what it hears.
 *
 * This section used to be the voice picker alone, which quietly implied that
 * audio *was* playback. Speech input is the half that fails, and it fails for
 * reasons no exercise can explain in the one line it has — so the section that
 * owns audio is where a learner can see what this device supports, run a listen
 * on purpose, and be told which settings screen to open when it does not work.
 *
 * Two subsections rather than two tabs: they share a locale, a device and most
 * of their causes. A missing Spanish voice and a missing Spanish recognition
 * language are the same complaint on most phones, and splitting them across
 * addresses would have hidden that.
 */
export function AudioSettings() {
  return (
    <div className={styles.group}>
      <section className={styles.group} aria-labelledby="audio-playback">
        <h3 className={styles.groupTitle} id="audio-playback">
          Playback
        </h3>
        <p className={styles.sectionSummary}>Which voice speaks, in which accent, and how fast.</p>
        {/* The same control the header's voice menu opens, so a change made in
            either place is the same change. */}
        <VoiceSettings />
      </section>

      <section className={styles.group} aria-labelledby="audio-input">
        <h3 className={styles.groupTitle} id="audio-input">
          Speech input
        </h3>
        <p className={styles.sectionSummary}>
          What this device can hear, and how to fix it when it cannot.
        </p>
        <SpeechInputCheck />
      </section>
    </div>
  );
}
