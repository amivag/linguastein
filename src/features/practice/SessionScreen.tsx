import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCourse } from '../../app/course';
import { useServices } from '../../app/services-context';
import { AppShell } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { SessionOutcomeSummary } from './SessionOutcomeSummary';
import { SessionProgress } from './SessionProgress';
import { formatDuration, spokenDuration } from './duration';
import { SessionTimer } from './SessionTimer';
import { ExerciseView } from './ExerciseView';
import styles from './Practice.module.css';
import { buildSessionConfig, PRESETS } from './presets';
import { parseSessionUrl } from './session-url';
import { useSessionRunner } from './useSessionRunner';

/** A session is fully described by the URL, so it survives a reload or a share. */
export function SessionScreen() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { filter: courseScope, path } = useCourse();
  const { services, preferences } = useServices();

  // The URL is the source of truth for a session; rebuilding the config on
  // every render would replan the session on every keystroke of state. The
  // query string is the dependency, so the plan changes only when the link does.
  const search = params.toString();
  const repository = services.repository;
  const { preset, config } = useMemo(() => {
    const url = parseSessionUrl(new URLSearchParams(search));
    const chosen = PRESETS[url.preset];
    // `?passage=` practises exactly one text; facets narrow it further, since
    // the repository ANDs an id allow-list with everything else.
    const passageItems = url.passage
      ? (repository.passageByLocalId(url.passage)?.items ?? [])
      : undefined;
    const scope = { ...url.filter, ...(passageItems ? { ids: passageItems } : {}) };

    return {
      preset: chosen,
      config: buildSessionConfig(chosen, {
        repository,
        preferences,
        size: url.size,
        courseScope,
        scope,
        ...(url.ordering ? { ordering: url.ordering } : {}),
        ...(url.dueOnly ? { dueOnly: true } : {}),
        ...(url.focus ? { focus: url.focus } : {}),
        ...(url.seed !== undefined ? { seed: url.seed } : {}),
      }),
    };
  }, [search, repository, preferences, courseScope]);

  const runner = useSessionRunner(config);

  return (
    <AppShell title={preset.label} onBack="history" showNav={false}>
      {runner.status === 'loading' && <p className={styles.hint}>Preparing…</p>}

      {runner.status === 'empty' && (
        <section className={styles.summaryScreen}>
          <p>Nothing to practise here yet.</p>
          <Button variant="primary" block large onClick={() => void navigate(path())}>
            Back to home
          </Button>
        </section>
      )}

      {runner.status === 'active' && (
        <>
          <SessionProgress
            index={runner.index}
            total={runner.total}
            trailing={preferences.showTimer ? <SessionTimer startedAt={runner.startedAt} /> : null}
          />

          {runner.exercise ? (
            <ExerciseView key={runner.exercise.id} exercise={runner.exercise} runner={runner} />
          ) : (
            <p className={styles.hint}>This item has no exercise available yet.</p>
          )}

          <div className={styles.footer}>
            <Button variant="ghost" onClick={runner.previous} disabled={runner.index === 0}>
              ← Previous
            </Button>
            <Button variant="ghost" onClick={runner.next}>
              Skip →
            </Button>
          </div>
        </>
      )}

      {runner.status === 'complete' && (
        <section className={styles.summaryScreen}>
          {/* The score stays, good or bad. "4 of 10" is information a learner can
              act on, and hiding it would make every good result worth nothing. */}
          <p className={styles.summaryScore}>
            {runner.tracked ? `${runner.stats.correct}/${runner.stats.answered}` : runner.total}
          </p>
          <p className={styles.hint}>
            {runner.tracked
              ? 'Session complete. Progress saved on this device.'
              : `${runner.total === 1 ? 'Card' : 'Cards'} reviewed. Studying is not scored, so nothing was recorded.`}
          </p>

          {/* The total, announced once — here it is news, whereas a clock
              announcing itself every second during the session would not be.
              Reported for a study session too: it was not scored, but the time
              it took is still a fact about it. */}
          {runner.durationMs !== null && (
            <p className={styles.hint} aria-label={`Took ${spokenDuration(runner.durationMs)}`}>
              <span aria-hidden="true">{formatDuration(runner.durationMs)}</span>
              {runner.stats.answered > 0 && (
                <span aria-hidden="true">
                  {' · '}
                  {formatDuration(runner.durationMs / runner.stats.answered)} per card
                </span>
              )}
            </p>
          )}

          {/* Only where there is something real to report. A study session has
              nothing to say here by design, and an empty panel saying so would
              be worse than no panel. */}
          {runner.tracked && <SessionOutcomeSummary outcome={runner.outcome} />}

          <Button variant="primary" block large onClick={runner.restart}>
            {runner.tracked ? 'Practise again' : 'Study again'}
          </Button>
          <Button block onClick={() => void navigate(path())}>
            Home
          </Button>
        </section>
      )}
    </AppShell>
  );
}
