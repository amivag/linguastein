import styles from './MicLevel.module.css';

interface MicLevelProps {
  /** Loudness, 0–1, as the microphone reports it. */
  readonly level: number;
}

/**
 * What the microphone is hearing, while it is hearing it (spec §6.2).
 *
 * Recognition is otherwise a black box: press, speak, and either a transcript
 * appears or nothing does. When nothing does there is no way to tell whether
 * the device heard you, so the first thing a learner tries is saying it louder
 * — which is the wrong fix for a blocked permission, a muted headset or a
 * recogniser that gave up. A level that moves separates "it cannot hear you"
 * from "it heard you and made nothing of it", which are different problems with
 * different answers.
 *
 * Hidden from assistive technology on purpose. It carries no information that
 * the live region beside it does not also say in words, and a value that
 * changes twenty times a second is not something to announce.
 */
export function MicLevel({ level }: MicLevelProps) {
  const clamped = Math.min(1, Math.max(0, level));

  return (
    <div className={styles.meter} aria-hidden="true" data-level={clamped.toFixed(2)}>
      {BARS.map((weight, index) => (
        <span
          key={index}
          className={styles.bar}
          style={{ transform: `scaleY(${FLOOR + clamped * weight * (1 - FLOOR)})` }}
        />
      ))}
    </div>
  );
}

/**
 * Per-bar response, centre-heavy. Equal bars read as a progress bar cut into
 * pieces; weighting them like this reads as a voice, which is what it is.
 */
const BARS = [0.3, 0.5, 0.72, 0.9, 1, 0.9, 0.72, 0.5, 0.3];

/**
 * The height every bar keeps at silence. A meter that collapses to nothing
 * looks broken rather than quiet, and "quiet" is a state worth being able to
 * see: the microphone is open, and it is hearing nothing.
 */
const FLOOR = 0.12;
