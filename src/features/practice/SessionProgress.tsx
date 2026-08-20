import styles from './Practice.module.css';

interface SessionProgressProps {
  /** Zero-based position of the item on screen. */
  readonly index: number;
  readonly total: number;
}

/**
 * Above this many items a pip is thinner than the gap beside it, so the segments
 * stop reading as countable and a continuous bar says more. Sessions are usually
 * ten to twenty items; "review everything due" is what pushes past it.
 */
const PIP_LIMIT = 20;

/**
 * Where you are in the session.
 *
 * A continuous bar under-sells a ten-item session: three quarters of the way
 * along is a smear, whereas "two left" is countable at a glance and is what
 * makes the end feel close. So short sessions get one pip per item.
 *
 * Position only — deliberately not correctness. Scoring each pip as it went
 * would turn the header into a running scoreboard, and a visible tally mid-loop
 * adds exactly the pressure §3 of the task doc argues against. It would also
 * have nothing to show in a study session, which is not scored at all.
 *
 * The `role="progressbar"` is unchanged: name, value, minimum and maximum are
 * what a screen reader and an agent read, and the segments are decoration on
 * top. Nothing here is the only signal for anything.
 */
export function SessionProgress({ index, total }: SessionProgressProps) {
  const position = index + 1;
  const segmented = total > 1 && total <= PIP_LIMIT;

  return (
    <div className={styles.progress}>
      <span aria-hidden="true">
        {position}/{total}
      </span>
      <div
        className={segmented ? styles.progressPips : styles.progressBar}
        role="progressbar"
        aria-label={`Item ${position} of ${total}`}
        aria-valuenow={position}
        aria-valuemin={0}
        aria-valuemax={total}
      >
        {segmented ? (
          Array.from({ length: total }, (_, pip) => (
            <span
              key={pip}
              className={styles.progressPip}
              // The progressbar above already carries the position; announcing
              // twenty anonymous spans as well would only add noise.
              aria-hidden="true"
              data-state={pip < index ? 'done' : pip === index ? 'current' : 'todo'}
            />
          ))
        ) : (
          <div
            className={styles.progressFill}
            style={{ width: `${(position / Math.max(total, 1)) * 100}%` }}
          />
        )}
      </div>
    </div>
  );
}
