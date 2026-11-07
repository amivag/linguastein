import styles from './SpeakingBars.module.css';

interface SpeakingBarsProps {
  /** Held rather than stopped: the bars stay up, and stop moving. */
  readonly paused?: boolean;
}

/**
 * Sound, while it lasts.
 *
 * The sibling of `MicLevel` and the answer to the same complaint, the other way
 * round: a device voice can take a second to start, can be interrupted by
 * anything else on the phone, and can fail silently — so "did that do
 * something?" is a question a play button on its own cannot answer. Three bars
 * that move say the app is talking.
 *
 * Unlike `MicLevel` these are decoration, not a measurement — nothing here is
 * derived from the audio — so they are hidden from assistive technology and
 * every screen that shows them also says in words what is playing. Motion is
 * never the only signal: `global.css` collapses the animation under
 * prefers-reduced-motion and the bars simply hold their shape.
 */
export function SpeakingBars({ paused = false }: SpeakingBarsProps) {
  return (
    <span className={styles.bars} aria-hidden="true" {...(paused ? { 'data-paused': 'true' } : {})}>
      <span className={styles.bar} />
      <span className={styles.bar} />
      <span className={styles.bar} />
    </span>
  );
}
