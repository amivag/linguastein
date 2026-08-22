import { useEffect, useId, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCourse } from '../../app/course';
import { useServices } from '../../app/services-context';
import { MISSIONS } from '../../app/missions';
import { AppShell } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { CourseBar } from '../../components/CourseBar';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { ThemeToggle } from '../../components/ThemeToggle';
import { levelLabel } from '../../domain/content';
import { summarise, type ProgressSummary } from '../../domain/progress';
import { missionIsComplete, missionsForCourse } from '../../domain/missions';
import { DEFAULT_SESSION_MINUTES, type SessionSize } from '../../domain/sessions';
import { FocusPicker } from '../practice/FocusPicker';
import { PRESET_IDS, PRESETS, type PresetId } from '../practice/presets';
import { sessionPath } from '../practice/session-url';
import { missionPath } from '../missions/mission-url';
import styles from './HomeScreen.module.css';

/**
 * The course coach: one trustworthy next action, with the laboratory still one
 * tap away for a learner who already knows what they want.
 */
export function HomeScreen() {
  const { services, preferences } = useServices();
  const { course, option, filter, path } = useCourse();
  const navigate = useNavigate();
  const practiceSheetId = useId();
  const [summary, setSummary] = useState<ProgressSummary | null>(null);
  const [practiceDays, setPracticeDays] = useState(0);
  const [practisedIds, setPractisedIds] = useState<ReadonlySet<string>>(new Set());
  const [practiceOpen, setPracticeOpen] = useState(false);

  // Every recommendation and count is scoped to the course in the URL.
  const scope = useMemo(() => {
    const items = services.repository.query(filter);
    return { total: items.length, ids: new Set(items.map((item) => item.id)) };
  }, [services.repository, filter]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [progress, attempts] = await Promise.all([
        services.storage.progress.all(),
        services.storage.attempts.recent(1_000),
      ]);
      if (cancelled) return;

      const now = Date.now();
      const inScope = progress.filter((entry) => scope.ids.has(entry.itemId));
      setSummary(summarise(inScope, scope.total, now));
      setPractisedIds(new Set(inScope.map((entry) => entry.itemId)));
      setPracticeDays(daysPractisedThisWeek(attempts, now));
    })();
    return () => {
      cancelled = true;
    };
  }, [services, scope]);

  // The next unfinished authored mission leads. A pack with no mission catalog
  // still gets a useful first passage rather than Spanish sequencing leaking in.
  const mission = useMemo(() => {
    const inCourse = (candidate: ReturnType<typeof services.repository.passageByLocalId>) =>
      candidate !== undefined &&
      services.repository.itemsOfPassage(candidate.id).some((item) => scope.ids.has(item.id));

    const authored = missionsForCourse(MISSIONS, course).flatMap((definition) => {
      const passage = services.repository.passageByLocalId(definition.passage);
      return passage && inCourse(passage) ? [{ definition, passage }] : [];
    });
    const unfinished = authored.findIndex(({ passage }) =>
      !missionIsComplete(passage.items, practisedIds),
    );
    const selected = authored[unfinished >= 0 ? unfinished : Math.max(0, authored.length - 1)];

    const passage =
      selected?.passage ??
      services.repository
        .allPassages()
        .filter((candidate) => inCourse(candidate))
        .sort((a, b) => Number(b.kind === 'dialogue') - Number(a.kind === 'dialogue'))[0];

    if (!passage) return null;
    const items = services.repository.itemsOfPassage(passage.id);
    const localId = passage.id.split(':').at(-1) ?? '';
    const titleTranslation = services.repository.translationOf(
      passage.id,
      preferences.referenceLanguage,
    );
    const phrase = items[selected?.definition.spotlight ?? 0];

    return {
      id: selected?.definition.id,
      localId,
      title: selected?.definition.title ?? titleTranslation?.text ?? passage.title,
      phrase: phrase?.text ?? passage.title,
      phraseMeaning: phrase
        ? services.repository.translationOf(phrase.id, preferences.referenceLanguage)?.text
        : undefined,
      lineCount: items.length,
      estimatedMinutes: selected?.definition.estimatedMinutes ?? 5,
      position: selected ? authored.indexOf(selected) + 1 : 1,
      total: selected ? authored.length : 1,
    };
  }, [course, practisedIds, preferences.referenceLanguage, scope.ids, services]);

  // The standing focus is written into every free-practice link so the session
  // remains reloadable and shareable rather than secretly reading preferences.
  const focused = {
    ...(preferences.focusTopics.length ? { filter: { topics: preferences.focusTopics } } : {}),
    ...(preferences.focus !== 'balanced' ? { focus: preferences.focus } : {}),
  };

  const start = (preset: PresetId, size: SessionSize) => {
    setPracticeOpen(false);
    void navigate(sessionPath(course, { preset, size, ...focused }));
  };

  const due = summary?.due ?? 0;
  const reviewDue = due > 0;
  const startRecommended = () => {
    if (reviewDue) {
      void navigate(
        sessionPath(course, {
          preset: 'quick',
          size: { kind: 'items', count: due },
          dueOnly: true,
        }),
      );
      return;
    }

    if (mission) {
      void navigate(
        mission.id ? missionPath(course, mission.id) : path(`read/${mission.localId}`),
      );
      return;
    }

    start('quick', { kind: 'time', minutes: 5 });
  };

  const title = `${option?.label ?? 'Practice'} · ${levelLabel(course.level)}`;

  return (
    <AppShell title={title} action={<ThemeToggle variant="compact" />}>
      <section className={styles.mission} aria-labelledby="mission-title">
        <p className={styles.eyebrow}>
          {reviewDue
            ? 'Ready for review'
            : mission
              ? `Mission ${mission.position} of ${mission.total}`
              : "Today's mission"}
        </p>
        <div className={styles.missionHeading}>
          <div>
            <h2 id="mission-title" className={styles.missionTitle}>
              {reviewDue ? 'Keep it fresh' : (mission?.title ?? 'Build your foundation')}
            </h2>
            <p className={styles.missionPhrase} lang={course.language}>
              {reviewDue
                ? 'Repasa lo que ya sabes.'
                : (mission?.phrase ?? 'Empieza con frases útiles.')}
            </p>
            {!reviewDue && mission?.phraseMeaning && (
              <p className={styles.missionMeaning}>{mission.phraseMeaning}</p>
            )}
          </div>
          <span className={styles.missionIcon} aria-hidden="true">
            <Icon name={reviewDue ? 'memory' : 'speak'} size="xl" />
          </span>
        </div>

        <div className={styles.missionFacts}>
          <span>
            <Icon name="passage" />
            {reviewDue
              ? `${due} ${due === 1 ? 'item' : 'items'} ready`
              : `${mission?.lineCount ?? 8} useful lines`}
          </span>
          <span>
            <Icon name="waveform" />
            {reviewDue ? 'Adaptive recall' : 'Short exchange'}
          </span>
        </div>

        <Button variant="primary" block large onClick={startRecommended}>
          <Icon name="play" />
          {reviewDue
            ? `Review ${due} due`
            : `Begin mission · ${mission?.estimatedMinutes ?? 5} min`}
        </Button>
      </section>

      {!reviewDue && (
        <section aria-labelledby="path-title">
          <h2 id="path-title" className={styles.sectionTitle}>
            Your learning path
          </h2>
          <ol className={styles.learningPath}>
            <li className={styles.pathCurrent} aria-current="step">
              <span className={styles.stepNumber}>1</span>
              <span><strong>Understand</strong><small>Meet the phrases</small></span>
            </li>
            <li>
              <span className={styles.stepNumber}>2</span>
              <span><strong>Practise</strong><small>Build confidence</small></span>
            </li>
            <li>
              <span className={styles.stepNumber}>3</span>
              <span><strong>Use</strong><small>Speak it out</small></span>
            </li>
          </ol>
        </section>
      )}

      <section className={styles.rhythm} aria-label="Learning rhythm">
        <div className={styles.rhythmStat}>
          <Icon name="due" />
          <span><strong>{due}</strong><small>due today</small></span>
        </div>
        <div className={styles.rhythmWeek}>
          <strong>{practiceDays} of 7 days</strong>
          <span className={styles.rhythmDots} aria-hidden="true">
            {Array.from({ length: 7 }, (_, index) => (
              <span key={index} data-active={index < practiceDays || undefined} />
            ))}
          </span>
          <small>this week</small>
        </div>
      </section>

      <Button
        block
        className={styles.freePractice}
        onClick={() => setPracticeOpen(true)}
        aria-expanded={practiceOpen}
        aria-controls={practiceSheetId}
      >
        <span className={styles.freePracticeIcon}><Icon name="listen" size="lg" /></span>
        <span className={styles.freePracticeText}>
          <strong>Free practice</strong>
          <small>Choose the time and training mode</small>
        </span>
        <Icon name="next" />
      </Button>

      <div className={styles.advancedPractice}>
        <FocusPicker />
      </div>

      {practiceOpen && (
        <Sheet id={practiceSheetId} title="Free practice" onClose={() => setPracticeOpen(false)}>
          <div className={styles.practiceSheet}>
            <div>
              <h3 className={styles.sheetTitle}>Course</h3>
              <p className={styles.scopeNote}>
                {scope.total} {scope.total === 1 ? 'item' : 'items'} in your course
              </p>
              <CourseBar compact />
            </div>
            <div>
              <h3 className={styles.sheetTitle}>Quick session</h3>
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
            </div>
            <div>
              <h3 className={styles.sheetTitle}>Practice mode</h3>
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
                      <Icon name={preset.icon} />
                      <span><strong>{preset.label}</strong><small>{preset.description}</small></span>
                      <Icon name="next" size="sm" />
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
        </Sheet>
      )}
    </AppShell>
  );
}

function daysPractisedThisWeek(attempts: readonly { readonly at: number }[], now: number): number {
  const current = new Date(now);
  const start = new Date(current.getFullYear(), current.getMonth(), current.getDate());
  const dayFromMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - dayFromMonday);

  return new Set(
    attempts
      .filter((attempt) => attempt.at >= start.getTime() && attempt.at <= now)
      .map((attempt) => new Date(attempt.at).toDateString()),
  ).size;
}
