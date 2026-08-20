import { useEffect, useState } from 'react';
import { formatDuration, spokenDuration } from './duration';
import styles from './Practice.module.css';

interface SessionTimerProps {
  /** Epoch ms the session started; 0 before it has. */
  readonly startedAt: number;
}

/**
 * How long this session has been going.
 *
 * No limit, no penalty, no countdown. It answers a question a learner actually
 * has — "have I been at this for five minutes or twenty?" — and deliberately
 * answers nothing else: a countdown would turn practice into a test, and
 * §3 of the game-feel task rules out mechanics whose point is pressure. It can
 * be switched off in Settings for anyone who finds a clock distracting at all.
 *
 * A leaf on purpose. Ticking here rather than in the screen means one span
 * re-renders each second instead of the whole practice card.
 */
export function SessionTimer({ startedAt }: SessionTimerProps) {
  const elapsed = useElapsed(startedAt);

  return (
    <span
      className={styles.timer}
      // A timer that announced itself every second would be unusable with a
      // screen reader, so it is polite-by-omission: no live region, and the
      // name carries the reading for anyone who asks for it. The total is
      // announced once, on the summary screen, where it is actually news.
      role="timer"
      aria-label={`Elapsed time ${spokenDuration(elapsed)}`}
    >
      <span aria-hidden="true">{formatDuration(elapsed)}</span>
    </span>
  );
}

/**
 * Milliseconds since `startedAt`, updated once a second.
 *
 * The clock is read in an effect, never during render: the React Compiler rules
 * forbid an impure call there. There is no "stop" — the component is unmounted
 * when the session ends, and the total is reported from the frozen figure the
 * runner captured at that moment rather than from a still-running interval.
 */
function useElapsed(startedAt: number): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (startedAt === 0) return;

    const tick = () => setElapsed(Date.now() - startedAt);
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [startedAt]);

  return elapsed;
}
