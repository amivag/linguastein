import { Button } from './Button';
import { Icon } from './Icon';
import { SpeakingBars } from './SpeakingBars';
import type { Sequence } from './usePlayback';
import styles from './PlaybackTransport.module.css';

interface PlaybackTransportProps {
  readonly sequence: Sequence;
  /** What one item is called here: `Sentence` in a text, `Line` in a dialogue. */
  readonly unit: string;
  /** The idle button's words — `Listen`, or `Listen to all` where it is a part. */
  readonly playLabel?: string;
}

/**
 * Play, hold, drop — for a passage read end to end.
 *
 * A whole text used to be one button that spoke one enormous utterance, which
 * is the shape that makes every other control impossible: there is no position
 * to report, no line to start from, and nothing to hold, because the engine was
 * handed a paragraph and asked to deal with it. The queue in `audio-service.ts`
 * is what this is a face for.
 *
 * Three states, and the controls change with them rather than staying put and
 * greying out: nothing playing is one button, playing is Pause and Stop,
 * paused is Resume and Stop. A learner reading along has one thumb free and
 * needs the control that is next, not the full set.
 *
 * The position is not a live region. It changes every few seconds, over the top
 * of speech the learner is listening to, and the rule the session timer already
 * follows applies exactly: a value that changes on its own is read when asked
 * for, not announced. Which line is speaking is on the line itself, as
 * `aria-current` — a fact about the list, where a screen reader can find it.
 */
export function PlaybackTransport({
  sequence,
  unit,
  playLabel = 'Listen',
}: PlaybackTransportProps) {
  // Nothing on this device can speak any of it: the transport would be three
  // controls that do nothing. The screen says so where it says it about
  // everything else — in the voice chip, which is in every header.
  if (!sequence.available) return null;

  if (sequence.status === 'idle') {
    return (
      <div className={styles.transport}>
        <Button onClick={sequence.play}>
          <Icon name="speak" /> {playLabel}
        </Button>
      </div>
    );
  }

  const playing = sequence.status === 'playing';

  return (
    <div className={styles.transport}>
      {playing ? (
        <Button variant="primary" onClick={sequence.pause}>
          <Icon name="pause" /> Pause
        </Button>
      ) : (
        <Button variant="primary" onClick={sequence.resume}>
          <Icon name="play" /> Resume
        </Button>
      )}
      <Button onClick={sequence.stop}>
        <Icon name="stop" /> Stop
      </Button>
      <p className={styles.position}>
        <SpeakingBars paused={!playing} />
        {sequence.position > 0
          ? `${unit} ${sequence.position} of ${sequence.total}`
          : playing
            ? 'Playing'
            : 'Paused'}
      </p>
    </div>
  );
}
