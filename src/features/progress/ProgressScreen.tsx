import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useServices } from '../../app/services-context';
import { AppShell } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { summarise, type ItemProgress, type ProgressSummary } from '../../domain/progress';
import type { SessionRecord } from '../../domain/sessions';
import styles from './ProgressScreen.module.css';

interface Loaded {
  readonly summary: ProgressSummary;
  readonly weakest: readonly ItemProgress[];
  readonly sessions: readonly SessionRecord[];
  readonly accuracy: number | null;
}

/** What the learner has actually done — the counterpart to the practice loop. */
export function ProgressScreen() {
  const { services, preferences } = useServices();
  const navigate = useNavigate();
  const [data, setData] = useState<Loaded | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [progress, sessions] = await Promise.all([
        services.storage.progress.all(),
        services.storage.sessions.recent(5),
      ]);
      if (cancelled) return;

      const correct = progress.reduce((total, item) => total + item.correct, 0);
      const attempts = progress.reduce((total, item) => total + item.attempts, 0);

      setData({
        summary: summarise(progress, services.repository.itemCount, Date.now()),
        weakest: [...progress]
          .filter((item) => item.attempts > 0)
          .sort((a, b) => b.difficulty - a.difficulty)
          .slice(0, 5),
        sessions,
        accuracy: attempts > 0 ? Math.round((correct / attempts) * 100) : null,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [services]);

  if (!data) return <AppShell title="Progress">{null}</AppShell>;

  const { summary, weakest, sessions, accuracy } = data;
  const started = summary.seen > 0;

  return (
    <AppShell title="Progress">
      {!started && (
        <section className={styles.empty}>
          <p>No practice recorded yet.</p>
          <Button variant="primary" block large onClick={() => void navigate('/')}>
            Start a session
          </Button>
        </section>
      )}

      {started && (
        <>
          <ul className={styles.stats} aria-label="Overall progress">
            <li className={styles.stat}>
              <span className={styles.statValue}>{summary.seen}</span>
              <span className={styles.statLabel}>items practised</span>
            </li>
            <li className={styles.stat}>
              <span className={styles.statValue}>{summary.mastered}</span>
              <span className={styles.statLabel}>mastered</span>
            </li>
            <li className={styles.stat}>
              <span className={styles.statValue}>{summary.due}</span>
              <span className={styles.statLabel}>due now</span>
            </li>
            <li className={styles.stat}>
              <span className={styles.statValue}>{accuracy === null ? '—' : `${accuracy}%`}</span>
              <span className={styles.statLabel}>accuracy</span>
            </li>
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
            {summary.seen} of {summary.total} items in this pack
          </p>

          {summary.due > 0 && (
            <Button
              variant="primary"
              block
              large
              onClick={() => void navigate('/session?preset=quick&size=items:20')}
            >
              Review {summary.due} due
            </Button>
          )}

          {weakest.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Needs work</h2>
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
                      <span lang="es">{item.text}</span>
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
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </AppShell>
  );
}
