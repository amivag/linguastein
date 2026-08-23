import { useEffect, useId, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCourse } from '../../app/course';
import { useServices } from '../../app/services-context';
import { MISSIONS } from '../../app/missions';
import { AppShell } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { CourseBar } from '../../components/CourseBar';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { ThemeToggle } from '../../components/ThemeToggle';
import { levelLabel, type ItemId } from '../../domain/content';
import {
  summarise,
  type Attempt,
  type ItemProgress,
  type ProgressSummary,
} from '../../domain/progress';
import { missionStandings, missionUseEvidence, nextMissionStanding } from '../../domain/missions';
import { batchStandings, nextBatchStanding, type BatchStanding } from '../../domain/batches';
import { localDay } from '../../utils/calendar';
import {
  DEFAULT_SESSION_MINUTES,
  type SessionFocus,
  type SessionSize,
} from '../../domain/sessions';
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
  const { services, preferences, batches } = useServices();
  const { course, option, filter, path } = useCourse();
  const navigate = useNavigate();
  const practiceSheetId = useId();
  const [summary, setSummary] = useState<ProgressSummary | null>(null);
  const [practiceDays, setPracticeDays] = useState(0);
  const [lastPractice, setLastPractice] = useState('Not yet');
  const [practisedIds, setPractisedIds] = useState<ReadonlySet<string>>(new Set());
  /**
   * The records themselves, not just which ids appear in them.
   *
   * A mission asks "has this been practised at all", which a set of ids answers;
   * a set asks whether each item is *absorbed*, which is a question about memory
   * stability and about which days it was produced on. Same one read either way.
   */
  const [history, setHistory] = useState<{
    readonly progress: ReadonlyMap<ItemId, ItemProgress>;
    readonly attempts: readonly Attempt[];
    readonly now: number;
  } | null>(null);
  const [missionUseItems, setMissionUseItems] = useState<ReadonlyMap<string, ReadonlySet<string>>>(
    new Map(),
  );
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
        services.storage.attempts.recent(10_000),
      ]);
      if (cancelled) return;

      const now = Date.now();
      const inScope = progress.filter((entry) => scope.ids.has(entry.itemId));
      const attemptsInScope = attempts.filter((attempt) => scope.ids.has(attempt.itemId));
      setSummary(summarise(inScope, scope.total, now));
      setPractisedIds(new Set(inScope.map((entry) => entry.itemId)));
      setMissionUseItems(missionUseEvidence(attempts));
      setHistory({
        progress: new Map(inScope.map((entry) => [entry.itemId, entry])),
        attempts,
        now,
      });
      setPracticeDays(daysPractisedThisWeek(attempts, now));
      setLastPractice(describeLastPractice(attemptsInScope, now));
    })();
    return () => {
      cancelled = true;
    };
  }, [services, scope]);

  // Where the learner stands in every mission this course offers. Study lists
  // all of them; the home screen only needs the one that leads.
  const standings = useMemo(
    () =>
      missionStandings(MISSIONS, course, services.repository, scope.ids, {
        practised: practisedIds,
        used: missionUseItems,
      }),
    [course, missionUseItems, practisedIds, scope.ids, services.repository],
  );

  // The next unfinished authored mission leads. A pack with no mission catalog
  // still gets a useful first passage rather than Spanish sequencing leaking in.
  const mission = useMemo(() => {
    const selected = nextMissionStanding(standings);
    const passage =
      selected?.passage ??
      services.repository
        .allPassages()
        .filter((candidate) =>
          services.repository.itemsOfPassage(candidate.id).some((item) => scope.ids.has(item.id)),
        )
        .sort((a, b) => Number(b.kind === 'dialogue') - Number(a.kind === 'dialogue'))[0];

    if (!passage) return null;
    const items = services.repository.itemsOfPassage(passage.id);
    const localId = passage.id.split(':').at(-1) ?? '';
    const titleTranslation = services.repository.translationOf(
      passage.id,
      preferences.referenceLanguage,
    );
    const phrase = items[selected?.mission.spotlight ?? 0];

    return {
      id: selected?.mission.id,
      localId,
      title: selected?.mission.title ?? titleTranslation?.text ?? passage.title,
      phrase: phrase?.text ?? passage.title,
      phraseMeaning: phrase
        ? services.repository.translationOf(phrase.id, preferences.referenceLanguage)?.text
        : undefined,
      lineCount: items.length,
      estimatedMinutes: selected?.mission.estimatedMinutes ?? 5,
      position: selected?.position ?? 1,
      total: selected?.total ?? 1,
      stage: selected?.stage ?? ('understand' as const),
      transferPosition: selected?.transferPosition ?? 1,
      transferTotal: selected?.transferTotal ?? 1,
    };
  }, [preferences.referenceLanguage, scope.ids, services.repository, standings]);

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

  const startFocused = (focus: SessionFocus) => {
    void navigate(
      sessionPath(course, {
        preset: 'quick',
        size: { kind: 'items', count: 5 },
        focus,
        ...(preferences.focusTopics.length ? { filter: { topics: preferences.focusTopics } } : {}),
      }),
    );
  };

  /**
   * The set to offer, or none.
   *
   * Unlike the mission, an absent one is a real answer: a learner with no sets,
   * or whose sets are all absorbed, should be offered something else rather than
   * a finished set to redo. `nextBatchStanding` is where that difference lives.
   */
  const set = useMemo(
    () =>
      history
        ? nextBatchStanding(
            batchStandings(batches, course, {
              courseItemIds: scope.ids,
              progress: history.progress,
              attempts: history.attempts,
              now: history.now,
              dayOf: localDay,
            }),
          )
        : undefined,
    [batches, course, history, scope.ids],
  );

  const due = summary?.due ?? 0;
  const reviewDue = due > 0;
  /*
   * At most two, and a set is never the first thing.
   *
   * Due reviews lead, always: items outside a set keep coming due while a learner
   * drills one, and a set that displaced them would build exactly the review debt
   * that gets a learner to give up. But a set the learner assembled themselves is
   * the strongest statement of intent on this screen, so it comes before the two
   * generic suggestions.
   */
  const followUps: readonly ('mission' | 'set' | 'reinforce' | 'fresh')[] = summary
    ? [
        ...(reviewDue && mission ? (['mission'] as const) : []),
        ...(set ? (['set'] as const) : []),
        ...(summary.seen > 0 ? (['reinforce'] as const) : []),
        ...(summary.seen < summary.total ? (['fresh'] as const) : []),
      ].slice(0, 2)
    : [];

  const continueSet = () => {
    if (!set) return;
    void navigate(
      sessionPath(course, {
        preset: 'quick',
        batch: set.batch.id,
        size: { kind: 'items', count: set.batch.perSession ?? set.total },
      }),
    );
  };

  const continueMission = () => {
    if (!mission) return;
    void navigate(
      mission.id ? missionPath(course, mission.id, mission.stage) : path(`read/${mission.localId}`),
    );
  };

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
      continueMission();
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
              ? mission.stage === 'use'
                ? `Mission ${mission.position} · Transfer ${mission.transferPosition} of ${mission.transferTotal}`
                : `Mission ${mission.position} of ${mission.total}`
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
            : mission?.stage === 'use'
              ? `Continue transfer · ${mission.estimatedMinutes} min`
              : `Begin mission · ${mission?.estimatedMinutes ?? 5} min`}
        </Button>

        {/* The whole ladder lives in Study, which is where a mission belongs:
            this card only ever shows the next rung, and a learner who wants to
            see the route — or go back to an earlier one — needs somewhere to
            look that is not this button. */}
        {standings.length > 1 && (
          <Link className={styles.missionAll} to={path('study')}>
            All {standings.length} missions
            <Icon name="next" size="sm" />
          </Link>
        )}
      </section>

      {followUps.length > 0 && (
        <section aria-labelledby="path-title">
          <h2 id="path-title" className={styles.sectionTitle}>
            Next steps
          </h2>
          <ol className={styles.nextSteps}>
            {followUps.map((action, index) => (
              <li key={action}>
                <span className={styles.stepNumber} aria-hidden="true">
                  {index + 2}
                </span>
                {action === 'mission' ? (
                  <Button className={styles.nextAction} onClick={continueMission}>
                    <span className={styles.nextActionIcon} aria-hidden="true">
                      <Icon name="speak" />
                    </span>
                    <span>
                      <strong>Continue {mission?.title}</strong>
                      <small>
                        {mission?.stage === 'use'
                          ? 'Use it in a new situation'
                          : 'Build flexible, useful language'}
                      </small>
                    </span>
                    <Icon name="next" />
                  </Button>
                ) : action === 'set' ? (
                  <Button className={styles.nextAction} onClick={continueSet}>
                    <span className={styles.nextActionIcon} aria-hidden="true">
                      <Icon name="batch" />
                    </span>
                    <span>
                      <strong>Continue {set?.batch.label}</strong>
                      {/* The standing is inside the label, not beside it: a card
                          saying only "Continue" tells a screen reader and an
                          agent nothing about which of a learner's sets this is
                          or how far through it they are. */}
                      <small>{set ? describeSetProgress(set) : ''}</small>
                    </span>
                    <Icon name="next" />
                  </Button>
                ) : action === 'reinforce' ? (
                  <Button className={styles.nextAction} onClick={() => startFocused('struggling')}>
                    <span className={styles.nextActionIcon} aria-hidden="true">
                      <Icon name="memory" />
                    </span>
                    <span>
                      <strong>Strengthen recall</strong>
                      <small>5 adaptive questions · your weakest material first</small>
                    </span>
                    <Icon name="next" />
                  </Button>
                ) : (
                  <Button className={styles.nextAction} onClick={() => startFocused('fresh')}>
                    <span className={styles.nextActionIcon} aria-hidden="true">
                      <Icon name="new" />
                    </span>
                    <span>
                      <strong>Meet something new</strong>
                      <small>5 adaptive questions · new material first</small>
                    </span>
                    <Icon name="next" />
                  </Button>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className={styles.rhythm} aria-label="Learning rhythm">
        <div className={styles.rhythmStat}>
          <Icon name="due" />
          <span>
            <strong>{due}</strong>
            <small>due today</small>
          </span>
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
        <div className={styles.lastPractice}>
          <Icon name="history" />
          <span>
            <strong>{lastPractice}</strong>
            <small>last practised</small>
          </span>
        </div>
      </section>

      <Button
        block
        className={styles.freePractice}
        onClick={() => setPracticeOpen(true)}
        aria-expanded={practiceOpen}
        aria-controls={practiceSheetId}
      >
        <span className={styles.freePracticeIcon}>
          <Icon name="listen" size="lg" />
        </span>
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
                      <span>
                        <strong>{preset.label}</strong>
                        <small>{preset.description}</small>
                      </span>
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

/**
 * What is left of a set, in one line.
 *
 * "Absorbed" and never "mastered" or a percentage: it means the specific
 * evidenced thing `domain/batches/progress.ts` defines, and a rounded percentage
 * would read as the lexeme mastery a set deliberately does not claim.
 */
function describeSetProgress(standing: BatchStanding): string {
  const absorbed = `${standing.absorbed} of ${standing.total} absorbed`;
  if (standing.dueNow > 0) return `${absorbed} · ${standing.dueNow} ready to review`;
  if (standing.untouched > 0) return `${absorbed} · ${standing.untouched} not started`;
  return absorbed;
}

function daysPractisedThisWeek(attempts: readonly { readonly at: number }[], now: number): number {
  const current = new Date(now);
  const start = new Date(current.getFullYear(), current.getMonth(), current.getDate());
  const dayFromMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - dayFromMonday);

  return new Set(
    attempts
      .filter((attempt) => attempt.at >= start.getTime() && attempt.at <= now)
      .map((attempt) => localDay(attempt.at)),
  ).size;
}

function describeLastPractice(attempts: readonly { readonly at: number }[], now: number): string {
  const latest = attempts.reduce<number | null>(
    (result, attempt) => (result === null || attempt.at > result ? attempt.at : result),
    null,
  );
  if (latest === null) return 'Not yet';

  const day = (timestamp: number) => {
    const date = new Date(timestamp);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  };
  const daysAgo = Math.max(0, Math.round((day(now) - day(latest)) / 86_400_000));
  if (daysAgo === 0) return 'Today';
  if (daysAgo === 1) return 'Yesterday';
  return `${daysAgo} days ago`;
}
