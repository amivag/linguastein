import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useServices } from '../../app/services-context';
import { AppShell } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { ThemeToggle } from '../../components/ThemeToggle';
import { summarise, type ProgressSummary } from '../../domain/progress';
import { DEFAULT_SESSION_MINUTES } from '../../domain/sessions';
import { formatSize, PRESET_IDS, PRESETS } from '../practice/presets';
import styles from './HomeScreen.module.css';

/** The two-tap entry point: pick how long, pick what (spec §3). */
export function HomeScreen() {
  const { services } = useServices();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<ProgressSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const progress = await services.storage.progress.all();
      if (!cancelled) {
        setSummary(summarise(progress, services.repository.itemCount, Date.now()));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [services]);

  const pack = services.repository.packs[0];
  const start = (preset: string, size: string) =>
    void navigate(`/session?preset=${preset}&size=${size}`);

  return (
    <AppShell title={pack?.name ?? 'Practice'} action={<ThemeToggle variant="compact" />}>
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{summary?.due ?? '—'}</span>
          <span className={styles.statLabel}>due</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>
            {summary ? summary.total - summary.seen : services.repository.itemCount}
          </span>
          <span className={styles.statLabel}>new</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{summary?.mastered ?? '—'}</span>
          <span className={styles.statLabel}>mastered</span>
        </div>
      </div>

      <h2 className={styles.sectionTitle}>Quick session</h2>
      <div className={styles.quick}>
        {DEFAULT_SESSION_MINUTES.map((minutes) => (
          <Button
            key={minutes}
            variant="primary"
            onClick={() => start('quick', formatSize({ kind: 'time', minutes }))}
          >
            {minutes} min
          </Button>
        ))}
      </div>

      <h2 className={styles.sectionTitle}>Practice</h2>
      <div className={styles.presets}>
        {PRESET_IDS.map((id) => {
          const preset = PRESETS[id];
          return (
            <Button
              key={id}
              block
              className={styles.preset}
              onClick={() => start(id, formatSize({ kind: 'items', count: 10 }))}
            >
              <span className={styles.presetLabel}>{preset.label}</span>
              <span className={styles.presetDescription}>{preset.description}</span>
            </Button>
          );
        })}
      </div>

      <p className={styles.footerNote}>
        {services.repository.itemCount} items · offline · progress stays on this device
      </p>
    </AppShell>
  );
}
