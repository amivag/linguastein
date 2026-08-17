import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useServices } from '../../app/services-context';
import { AppShell } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { ExerciseView } from './ExerciseView';
import styles from './Practice.module.css';
import { buildSessionConfig, isPresetId, parseSize, PRESETS } from './presets';
import { useSessionRunner } from './useSessionRunner';

/** A session is fully described by the URL, so it survives a reload or a share. */
export function SessionScreen() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { services, preferences } = useServices();

  const presetId = params.get('preset');
  const preset = PRESETS[isPresetId(presetId) ? presetId : 'quick'];
  const size = parseSize(params.get('size'));

  // The URL is the source of truth for a session; rebuilding the config on
  // every render would replan the session on every keystroke of state.
  const search = params.toString();
  const repository = services.repository;
  const config = useMemo(
    () => buildSessionConfig(preset, { repository, preferences, size }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `search` stands in for preset+size
    [search, repository, preferences],
  );

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
          <p className={styles.summaryScore}>
            {runner.stats.correct}/{runner.stats.answered}
          </p>
          <p className={styles.hint}>Session complete. Progress saved on this device.</p>
          <Button variant="primary" block large onClick={runner.restart}>
            Practise again
          </Button>
          <Button block onClick={() => void navigate('/')}>
            Home
          </Button>
        </section>
      )}
    </AppShell>
  );
}
