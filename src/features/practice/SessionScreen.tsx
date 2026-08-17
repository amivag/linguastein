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

  const config = useMemo(
    () =>
      buildSessionConfig(preset, {
        repository: services.repository,
        preferences,
        size,
      }),
    // The URL is the source of truth; rebuilding on every render would replan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [preset.id, params.toString(), services.repository, preferences],
  );

  const runner = useSessionRunner(config);

  return (
    <AppShell title={preset.label} onBack="history">
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
            <span>
              {runner.index + 1}/{runner.total}
            </span>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${((runner.index + 1) / Math.max(runner.total, 1)) * 100}%` }}
              />
            </div>
          </div>

          {runner.exercise ? (
            <ExerciseView exercise={runner.exercise} runner={runner} />
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
