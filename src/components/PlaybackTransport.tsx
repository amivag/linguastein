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
 * **The same three slots in every state**, and that is a correction. It was one
 * button while idle and three controls while playing, on the argument that a
 * learner reading along needs the control that is next rather than the full set.
 * True of the controls and false of the layout: Pause and Stop appeared where
 * the single button had been, so the row grew and everything under it jumped —
 * at the exact moment a thumb was on its way back to the screen. A control that
 * moves when you press a control beside it is worse than a control you cannot
 * use, because you can see the second one.
 *
 * So the play button changes its word (`Listen` → `Pause` → `Resume`) and Stop
 * is simply disabled while there is nothing to stop. The readout keeps the row's
 * shape too, and says how long the thing is before it starts — which is a fact
 * worth having before pressing play, rather than filler.
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

  const idle = sequence.status === 'idle';
  const playing = sequence.status === 'playing';

  return (
    <div className={styles.transport}>
      <Button
        variant={idle ? 'default' : 'primary'}
        onClick={playing ? sequence.pause : idle ? sequence.play : sequence.resume}
      >
        <Icon name={playing ? 'pause' : idle ? 'speak' : 'play'} />{' '}
        {playing ? 'Pause' : idle ? playLabel : 'Resume'}
      </Button>
      {/* Present rather than absent while there is nothing to stop: it is the
          control beside the one being pressed, and a control that appears under a
          thumb is a control that gets pressed by accident. */}
      <Button onClick={sequence.stop} disabled={idle}>
        <Icon name="stop" /> Stop
      </Button>
      <p className={styles.position}>
        {/* Motion means sound, so there is none while nothing is playing — the
            readout beside it is what holds the row's height either way. */}
        {!idle && <SpeakingBars paused={!playing} />}
        {idle
          ? `${sequence.total} ${unit.toLowerCase()}${sequence.total === 1 ? '' : 's'}`
          : sequence.position > 0
            ? `${unit} ${sequence.position} of ${sequence.total}`
            : playing
              ? 'Playing'
              : 'Paused'}
      </p>
    </div>
  );
}
