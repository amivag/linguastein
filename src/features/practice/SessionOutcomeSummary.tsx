import { useServices } from '../../app/services-context';
import { useTargetLanguage } from '../../app/course';
import { Icon } from '../../components/Icon';
import { TokenizedText } from '../../components/TokenizedText';
import { useWordSelection } from '../../components/useWordSelection';
import { WordInfoSheet } from '../../components/WordInfoSheet';
import type { StageChange } from './useSessionRunner';
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
 *
 * ## Why the sentences are rows and not a sentence
 *
 * They were prose: `3 words moved up: Tengo que trabajar, Necesito sal and …`,
 * joined with commas into one line. Two things were wrong with that, and the
 * roadmap records the second as a gap of its own.
 *
 * **A comma list of sentences is not readable.** Each entry is itself a sentence
 * with its own commas, so the separators stop separating — and the entries are
 * exactly the length at which a reader needs them stacked.
 *
 * **And a word in it could not be tapped.** *Every word of every phrase is
 * tappable on every screen* is the rule `AGENTS.md` states, and this was the one
 * place naming sentences that broke it — on the screen that has just told you a
 * word slipped back, which is precisely when "which word is the problem" is the
 * question. Tapping now opens the same sheet Progress and Browse open, from the
 * same two components.
 */
export function SessionOutcomeSummary({ outcome }: SessionOutcomeSummaryProps) {
  const lang = useTargetLanguage();
  const { services } = useServices();
  const words = useWordSelection();
  const { advanced, lapsed, nextDueInDays } = outcome;

  // Pure: the runner already resolved this to whole days when the answer landed,
  // so nothing here reads a clock.
  const returning = nextDueInDays === undefined ? null : describeDue(nextDueInDays);
  if (advanced.length === 0 && lapsed.length === 0 && returning === null) return null;

  const openItem = words.item ? services.repository.getItem(words.item) : undefined;

  /**
   * One stage change as a row, tokenised where the item is still loaded.
   *
   * A change carries the text it had at the time, so a row survives a pack being
   * removed mid-session — it simply stops being tappable, which is the honest
   * degradation rather than an empty row.
   */
  const row = (change: StageChange) => {
    const item = services.repository.getItem(change.itemId);
    return (
      <li key={change.itemId} className={styles.outcomeItem}>
        {item ? (
          <TokenizedText
            item={item}
            onSelect={(token) => words.open(item.id, token)}
            selected={words.tokensFor(item.id)}
            contextLabel={item.text}
          />
        ) : (
          <span lang={lang}>{change.text}</span>
        )}
      </li>
    );
  };

  return (
    <div className={styles.outcome}>
      {advanced.length > 0 && (
        <div className={styles.outcomeGroup}>
          <p className={styles.outcomeLine}>
            <Icon name="improving" size="sm" className={styles.outcomeIconUp} />
            <span>
              <strong>{advanced.length}</strong>{' '}
              {advanced.length === 1 ? 'word moved up' : 'words moved up'}
            </span>
          </p>
          <ul className={styles.outcomeItems}>
            {advanced.slice(0, SHOWN).map(row)}
            {rest(advanced)}
          </ul>
        </div>
      )}

      {/* Named, not hidden. A word slipping back is the most useful thing the
          screen can tell you, and softening it would waste the information. */}
      {lapsed.length > 0 && (
        <div className={styles.outcomeGroup}>
          <p className={styles.outcomeLine}>
            <Icon name="slipping" size="sm" className={styles.outcomeIconDown} />
            <span>
              <strong>{lapsed.length}</strong> to see again sooner
            </span>
          </p>
          <ul className={styles.outcomeItems}>
            {lapsed.slice(0, SHOWN).map(row)}
            {rest(lapsed)}
          </ul>
        </div>
      )}

      {returning && (
        <p className={styles.outcomeLine}>
          <Icon name="due" size="sm" className={styles.outcomeIconDue} />
          <span>Back for review {returning}.</span>
        </p>
      )}

      {openItem && (
        <WordInfoSheet
          item={openItem}
          tokenIds={words.tokens}
          onChange={words.set}
          onClose={words.close}
        />
      )}
    </div>
  );
}

/** The tail, counted once the list stops being worth reading in full. */
function rest(changes: readonly StageChange[]) {
  const hidden = changes.length - SHOWN;
  if (hidden <= 0) return null;
  return <li className={styles.outcomeMore}>+{hidden} more</li>;
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
