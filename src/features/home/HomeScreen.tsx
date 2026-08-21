import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCourse } from '../../app/course';
import { useServices } from '../../app/services-context';
import { AppShell } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { CourseBar } from '../../components/CourseBar';
import { Icon } from '../../components/Icon';
import { ThemeToggle } from '../../components/ThemeToggle';
import { summarise, type ProgressSummary } from '../../domain/progress';
import { DEFAULT_SESSION_MINUTES, type SessionSize } from '../../domain/sessions';
import { FocusPicker } from '../practice/FocusPicker';
import { PRESET_IDS, PRESETS, type PresetId } from '../practice/presets';
import { sessionPath } from '../practice/session-url';
import styles from './HomeScreen.module.css';

/** The two-tap entry point: pick how long, pick what (spec §3). */
export function HomeScreen() {
  const { services, preferences } = useServices();
  const { course, option, filter } = useCourse();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<ProgressSummary | null>(null);

  // Every count on this screen is a count of the course, not of everything
  // loaded: "12 due" has to mean twelve items this session could actually
  // contain, or the button under it is lying about what it will practise.
  const scope = useMemo(() => {
    const items = services.repository.query(filter);
    return { total: items.length, ids: new Set(items.map((item) => item.id)) };
  }, [services.repository, filter]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const progress = await services.storage.progress.all();
      if (!cancelled) {
        const inScope = progress.filter((entry) => scope.ids.has(entry.itemId));
        setSummary(summarise(inScope, scope.total, Date.now()));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [services, scope]);

  // The standing choice is written *into the link* rather than read from
  // preferences by the session screen: a session has to stay fully described by
  // its URL, or a shared link would practise the sharer's categories on the
  // recipient's device.
  const focused = {
    ...(preferences.focusTopics.length ? { filter: { topics: preferences.focusTopics } } : {}),
    ...(preferences.focus !== 'balanced' ? { focus: preferences.focus } : {}),
  };

  const start = (preset: PresetId, size: SessionSize) =>
    void navigate(sessionPath(course, { preset, size, ...focused }));

  return (
    <AppShell title={option?.label ?? 'Practice'} action={<ThemeToggle variant="compact" />}>
      <CourseBar />

      <div className={styles.stats}>
        <div className={`${styles.stat} ${styles.statDue}`}>
          <Icon name="due" size="sm" className={styles.statIcon} />
          <span className={styles.statValue}>{summary?.due ?? '—'}</span>
          <span className={styles.statLabel}>due</span>
        </div>
        <div className={`${styles.stat} ${styles.statNew}`}>
          <Icon name="new" size="sm" className={styles.statIcon} />
          <span className={styles.statValue}>
            {summary ? summary.total - summary.seen : scope.total}
          </span>
          <span className={styles.statLabel}>new</span>
        </div>
        <div className={`${styles.stat} ${styles.statDone}`}>
          <Icon name="mastered" size="sm" className={styles.statIcon} />
          <span className={styles.statValue}>{summary?.mastered ?? '—'}</span>
          <span className={styles.statLabel}>mastered</span>
        </div>
      </div>

      {summary !== null && summary.due > 0 && (
        <Button
          variant="primary"
          block
          large
          onClick={() =>
            void navigate(
              // Deliberately unfocused: the button names a number, and
              // narrowing it by category would review fewer items than it
              // promised.
              sessionPath(course, {
                preset: 'quick',
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

      <FocusPicker />

      <h2 className={styles.sectionTitle}>Quick session</h2>
      <div className={styles.quick}>
        {DEFAULT_SESSION_MINUTES.map((minutes) => (
          <Button
            key={minutes}
            variant="primary"
            onClick={() => start('quick', { kind: 'time', minutes })}
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
              onClick={() => start(id, { kind: 'items', count: 10 })}
            >
              <span
                className={`${styles.presetIcon} ${
                  // A study preset records nothing, so it does not wear the
                  // colour the app uses for what feeds the scheduler.
                  preset.mode === 'study' ? styles.presetIconStudy : ''
                }`}
              >
                <Icon name={preset.icon} size="lg" />
              </span>
              <span className={styles.presetText}>
                <span className={styles.presetLabel}>{preset.label}</span>
                <span className={styles.presetDescription}>{preset.description}</span>
              </span>
              <Icon name="next" size="sm" className={styles.presetChevron} />
            </Button>
          );
        })}
      </div>

      {/* The item count moved to the course bar, where it belongs: it is a
          property of the scope, and stating it twice invited the two to
          disagree. */}
      <p className={styles.footerNote}>
        <Icon name="check" size="sm" />
        Offline · progress stays on this device
      </p>
    </AppShell>
  );
}
