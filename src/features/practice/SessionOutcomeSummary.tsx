import type { SessionOutcome } from './useSessionRunner';
import styles from './Practice.module.css';

interface SessionOutcomeSummaryProps {
  readonly outcome: SessionOutcome;
}

/** Longest list worth reading on a results screen; the rest is a count. */
const SHOWN = 4;

/**
 * What the session achieved, rather than how many questions went past.
 *
 * A bare fraction is not feedback: it says nothing a learner can act on and
 * nothing they would want to be told. Which words moved up a stage, which
 * slipped back, and when the set returns are all derived from the progress the
 * session was already writing.
 *
 * It renders nothing when there is nothing to say. A session where every item
 * held its stage is a normal session, and an empty panel announcing that would
 * read as a failure.
 */
export function SessionOutcomeSummary({ outcome }: SessionOutcomeSummaryProps) {
  const { advanced, lapsed, nextDueInDays } = outcome;

  // Pure: the runner already resolved this to whole days when the answer landed,
  // so nothing here reads a clock.
  const returning = nextDueInDays === undefined ? null : describeDue(nextDueInDays);
  if (advanced.length === 0 && lapsed.length === 0 && returning === null) return null;

  return (
    <div className={styles.outcome}>
      {advanced.length > 0 && (
        <p className={styles.outcomeLine}>
          <strong>{advanced.length}</strong>{' '}
          {advanced.length === 1 ? 'word moved up' : 'words moved up'}:{' '}
          <span lang="es">{list(advanced.map((change) => change.text))}</span>
        </p>
      )}

      {/* Named, not hidden. A word slipping back is the most useful thing the
          screen can tell you, and softening it would waste the information. */}
      {lapsed.length > 0 && (
        <p className={styles.outcomeLine}>
          <strong>{lapsed.length}</strong> to see again sooner:{' '}
          <span lang="es">{list(lapsed.map((change) => change.text))}</span>
        </p>
      )}

      {returning && <p className={styles.outcomeLine}>Back for review {returning}.</p>}
    </div>
  );
}

/** `a, b and c`, with the tail counted once the list stops being readable. */
function list(texts: readonly string[]): string {
  const shown = texts.slice(0, SHOWN);
  const rest = texts.length - shown.length;
  const joined =
    shown.length > 1 ? `${shown.slice(0, -1).join(', ')} and ${shown.at(-1)}` : (shown[0] ?? '');
  return rest > 0 ? `${joined} +${rest} more` : joined;
}

/** Relative, because a learner thinks in "tomorrow" rather than in dates. */
function describeDue(days: number): string {
  if (days <= 0) return 'later today';
  if (days === 1) return 'tomorrow';
  if (days < 7) return `in ${days} days`;
  if (days < 14) return 'in about a week';
  if (days < 60) return `in about ${Math.round(days / 7)} weeks`;
  return `in about ${Math.round(days / 30)} months`;
}
