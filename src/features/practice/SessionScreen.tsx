import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useServices } from '../../app/services-context';
import { AppShell } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { SessionOutcomeSummary } from './SessionOutcomeSummary';
import { ExerciseView } from './ExerciseView';
import styles from './Practice.module.css';
import { buildSessionConfig, PRESETS } from './presets';
import { parseSessionUrl } from './session-url';
import { useSessionRunner } from './useSessionRunner';

/** A session is fully described by the URL, so it survives a reload or a share. */
export function SessionScreen() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
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
        scope,
        ...(url.ordering ? { ordering: url.ordering } : {}),
        ...(url.dueOnly ? { dueOnly: true } : {}),
        ...(url.seed !== undefined ? { seed: url.seed } : {}),
      }),
    };
  }, [search, repository, preferences]);

  const runner = useSessionRunner(config);

  return (
    <AppShell title={preset.label} onBack="history" showNav={false}>
      {runner.status === 'loading' && <p className={styles.hint}>Preparing…</p>}

      {runner.status === 'empty' && (
        <section className={styles.summaryScreen}>
          <p>Nothing to practise here yet.</p>
          <Button variant="primary" block large onClick={() => void navigate('/')}>
            Back to home
          </Button>
        </section>
      )}

      {runner.status === 'active' && (
        <>
          <div className={styles.progress}>
            <span aria-hidden="true">
              {runner.index + 1}/{runner.total}
            </span>
            <div
              className={styles.progressBar}
              role="progressbar"
              aria-label={`Item ${runner.index + 1} of ${runner.total}`}
              aria-valuenow={runner.index + 1}
              aria-valuemin={0}
              aria-valuemax={runner.total}
            >
              <div
                className={styles.progressFill}
                style={{ width: `${((runner.index + 1) / Math.max(runner.total, 1)) * 100}%` }}
              />
            </div>
          </div>

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

          {/* Only where there is something real to report. A study session has
              nothing to say here by design, and an empty panel saying so would
              be worse than no panel. */}
          {runner.tracked && <SessionOutcomeSummary outcome={runner.outcome} />}

          <Button variant="primary" block large onClick={runner.restart}>
            {runner.tracked ? 'Practise again' : 'Study again'}
          </Button>
          <Button block onClick={() => void navigate('/')}>
            Home
          </Button>
        </section>
      )}
    </AppShell>
  );
}
