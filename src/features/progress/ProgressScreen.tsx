import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useCourse, useTargetLanguage } from '../../app/course';
import { useServices } from '../../app/services-context';
import { AppShell } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { CourseBar } from '../../components/CourseBar';
import { Icon } from '../../components/Icon';
import { TokenizedText } from '../../components/TokenizedText';
import { useWordSelection } from '../../components/useWordSelection';
import { WordInfoSheet } from '../../components/WordInfoSheet';
import {
  inferMastery,
  summarise,
  weakest as weakestMastery,
  type ItemProgress,
  type MasteryRecord,
  type ProgressSummary,
} from '../../domain/progress';
import type { SessionRecord } from '../../domain/sessions';
import { formatDuration } from '../practice/duration';
import { sessionPath } from '../practice/session-url';
import styles from './ProgressScreen.module.css';

interface Loaded {
  readonly summary: ProgressSummary;
  readonly weakest: readonly ItemProgress[];
  readonly sessions: readonly SessionRecord[];
  readonly accuracy: number | null;
  /** Words and skills, not sentences — what has actually been acquired. */
  readonly mastery: readonly MasteryRecord[];
}

const MASTERY_LABELS: Record<MasteryRecord['status'], string> = {
  weak: 'shaky',
  developing: 'coming along',
  strong: 'solid',
};

/** What the learner has actually done — the counterpart to the practice loop. */
export function ProgressScreen() {
  const lang = useTargetLanguage();
  const { services, preferences } = useServices();
  const { course, filter, path } = useCourse();
  const navigate = useNavigate();
  const [data, setData] = useState<Loaded | null>(null);
  const words = useWordSelection();

  // Progress is stored per item id and never per course, so a course switch
  // cannot lose anything. What it does change is which of it is being reported:
  // an A1 learner's accuracy should not be diluted by the A2 items they have
  // not met, and "142 of 1043" is the wrong denominator for the course they are
  // actually in.
  const scope = useMemo(() => {
    const items = services.repository.query(filter);
    return { total: items.length, ids: new Set(items.map((item) => item.id)) };
  }, [services.repository, filter]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [stored, sessions] = await Promise.all([
        services.storage.progress.all(),
        // Narrowed by language, like everything else on this screen. Progress
        // rows can be scoped after the fact because they carry item ids; a
        // session row cannot, which is why it now records its course.
        services.storage.sessions.recent(5, course.language),
      ]);
      if (cancelled) return;

      const progress = stored.filter((entry) => scope.ids.has(entry.itemId));
      const correct = progress.reduce((total, item) => total + item.correct, 0);
      const attempts = progress.reduce((total, item) => total + item.attempts, 0);

      setData({
        summary: summarise(progress, scope.total, Date.now()),
        weakest: [...progress]
          .filter((item) => item.attempts > 0)
          .sort((a, b) => b.difficulty - a.difficulty)
          .slice(0, 5),
        sessions,
        accuracy: attempts > 0 ? Math.round((correct / attempts) * 100) : null,
        mastery: weakestMastery(inferMastery(services.repository, progress), 8),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [services, scope, course.language]);

  if (!data) return <AppShell title="Progress">{null}</AppShell>;

  const { summary, weakest, sessions, accuracy, mastery } = data;

  /**
   * Where a word or a pattern goes when it is tapped: a study session over the
   * content that uses it.
   *
   * `flashcards` and `mode: 'study'`, so opening a weak word to look at it
   * records nothing and cannot reschedule what it happened to show — the same
   * choice Study makes for the same reason. A word travels as `?word=`, which
   * reaches `ItemFilter.lexemes`; that filter was honoured by the repository and
   * reachable from no link at all until this row needed it.
   */
  const practiseLink = (record: MasteryRecord) =>
    sessionPath(course, {
      preset: 'flashcards',
      size: { kind: 'all' },
      ordering: 'random',
      ...(record.kind === 'skill'
        ? { skills: [localIdOf(record.id)] }
        : { words: [localIdOf(record.id)] }),
    });
  const started = summary.seen > 0;
  const openItem = words.item ? services.repository.getItem(words.item) : undefined;

  return (
    <AppShell title="Progress">
      <CourseBar compact />

      {!started && (
        <section className={styles.empty}>
          <Icon name="progress" size="xl" className={styles.emptyIcon} />
          <p>No practice recorded yet.</p>
          <Button variant="primary" block large onClick={() => void navigate(path())}>
            <Icon name="play" />
            Start a session
          </Button>
        </section>
      )}

      {started && (
        <>
          <ul className={styles.stats} aria-label="Overall progress">
            {(
              [
                // `tint` names the glyph's class rather than a colour, so the
                // pairing with the meter below lives in the stylesheet with the
                // segments it has to agree with.
                {
                  icon: 'study',
                  value: summary.seen,
                  label: 'items practised',
                  tint: 'statIconSeen',
                },
                {
                  icon: 'mastered',
                  value: summary.mastered,
                  label: 'mastered',
                  tint: 'statIconMastered',
                },
                { icon: 'due', value: summary.due, label: 'due now', tint: null },
                {
                  icon: 'accuracy',
                  value: accuracy === null ? '—' : `${accuracy}%`,
                  label: 'accuracy',
                  tint: null,
                },
              ] as const
            ).map((entry) => (
              <li key={entry.label} className={styles.stat}>
                <Icon
                  name={entry.icon}
                  size="sm"
                  className={`${styles.statIcon} ${entry.tint ? (styles[entry.tint] ?? '') : ''}`}
                />
                <span className={styles.statValue}>{entry.value}</span>
                <span className={styles.statLabel}>{entry.label}</span>
              </li>
            ))}
          </ul>

          <div className={styles.bar} aria-hidden="true">
            <span
              className={styles.barMastered}
              style={{ width: `${(summary.mastered / summary.total) * 100}%` }}
            />
            <span
              className={styles.barSeen}
              style={{ width: `${((summary.seen - summary.mastered) / summary.total) * 100}%` }}
            />
          </div>
          <p className={styles.caption}>
            {summary.seen} of {summary.total} items in this course
          </p>

          {summary.due > 0 && (
            <Button
              variant="primary"
              block
              large
              onClick={() =>
                void navigate(
                  sessionPath(course, {
                    preset: 'quick',
                    // Exactly the due items, all of them: the label is a promise,
                    // and every attempt persists as it happens, so a long queue
                    // costs nothing to abandon part-way.
                    size: { kind: 'items', count: summary.due },
                    dueOnly: true,
                  }),
                )
              }
            >
              <Icon name="play" />
              Review {summary.due} due
            </Button>
          )}

          {mastery.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Words &amp; skills</h2>
              <ul className={styles.list}>
                {mastery.map((record) => (
                  <li key={record.id} className={styles.row}>
                    {/* A row on the one screen that says what is shaky had nowhere
                        to send anybody: inspection is entered through an item and
                        a mastery record is a lexeme or a skill. It links to a
                        study session over the sentences that use it now — the same
                        destination Study's own word and grammar tiles use, so
                        "this is weak" and "practise this" are one tap apart. */}
                    <Link className={styles.rowLink} to={practiseLink(record)}>
                      <span className={styles.rowLabel}>
                        <Icon
                          name={record.status === 'strong' ? 'improving' : 'slipping'}
                          size="sm"
                          className={
                            record.status === 'strong' ? styles.rowIconUp : styles.rowIconDown
                          }
                        />
                        <span lang={lang}>{record.label}</span>
                      </span>
                      <span className={styles.muted}>
                        {MASTERY_LABELS[record.status]} · seen in {record.encounters}{' '}
                        {record.encounters === 1 ? 'sentence' : 'sentences'}
                      </span>
                      <Icon name="next" size="sm" className={styles.rowChevron} />
                    </Link>
                  </li>
                ))}
              </ul>
              <p className={styles.caption}>
                Strength combines retrieval quality with evidence across different sentences, not
                just how well one prompt is remembered.
              </p>
            </section>
          )}

          {weakest.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Sentences to revisit</h2>
              <ul className={styles.list}>
                {weakest.map((record) => {
                  const item = services.repository.getItem(record.itemId);
                  if (!item) return null;
                  const translation = services.repository.translationOf(
                    item.id,
                    preferences.referenceLanguage,
                  );
                  return (
                    <li key={record.itemId} className={styles.row}>
                      {/* "Sentences to revisit" is exactly where a learner
                          wants to ask which word is the problem. */}
                      <TokenizedText
                        item={item}
                        onSelect={(token) => words.open(item.id, token)}
                        selected={words.tokensFor(item.id)}
                        contextLabel={item.text}
                      />
                      {translation && <span className={styles.muted}>{translation.text}</span>}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {sessions.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Recent sessions</h2>
              <ul className={styles.list}>
                {sessions.map((session) => (
                  <li key={session.id} className={styles.row}>
                    <span>{new Date(session.startedAt).toLocaleDateString()}</span>
                    <span className={styles.muted}>
                      {session.correct}/{session.completed} correct
                      {/* The record has always carried both ends; there was
                          simply nowhere showing how long a session took. */}
                      {session.endedAt !== undefined &&
                        ` · ${formatDuration(session.endedAt - session.startedAt)}`}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {openItem && (
        <WordInfoSheet
          item={openItem}
          tokenIds={words.tokens}
          onChange={words.set}
          onClose={words.close}
        />
      )}
    </AppShell>
  );
}

/**
 * The local half of a namespaced id — `core-es:lexeme:persona` → `persona`.
 *
 * A link addresses a word and a skill by their local id, so a shared link does
 * not carry a pack namespace it will outlive (`session-url.ts`). `StudyScreen`
 * has the same three lines for the same reason; they are worth sharing the day
 * there is a third.
 */
function localIdOf(id: string): string {
  return id.slice(id.lastIndexOf(':') + 1);
}
