import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useCourse, usePronunciationLocale } from '../../app/course';
import { useServices } from '../../app/services-context';
import { MISSIONS } from '../../app/missions';
import { batchById } from '../../domain/batches';
import type { SkillId } from '../../domain/content';
import { missionById } from '../../domain/missions';
import { AppShell } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { SessionOutcomeSummary } from './SessionOutcomeSummary';
import { SessionProgress } from './SessionProgress';
import { formatDuration, spokenDuration } from './duration';
import { SessionTimer } from './SessionTimer';
import { ExerciseView } from './ExerciseView';
import { Icon } from '../../components/Icon';
import styles from './Practice.module.css';
import { buildSessionConfig, PRESETS } from './presets';
import { parseSessionUrl } from './session-url';
import { useSessionRunner } from './useSessionRunner';
import { MissionJourney } from '../missions/MissionJourney';
import { missionJourneyHrefs, missionPath } from '../missions/mission-url';
import { studyPath } from '../study/study-url';

/** A session is fully described by the URL, so it survives a reload or a share. */
export function SessionScreen() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { course, filter: courseScope, path } = useCourse();
  const { services, preferences, batches } = useServices();
  const pronunciationLocale = usePronunciationLocale();

  // The URL is the source of truth for a session; rebuilding the config on
  // every render would replan the session on every keystroke of state. The
  // query string is the dependency, so the plan changes only when the link does.
  const search = params.toString();
  const repository = services.repository;
  const { preset, config, mission, batchLabel, passageTitle, emptyBatch } = useMemo(() => {
    const url = parseSessionUrl(new URLSearchParams(search));
    const chosen = PRESETS[url.preset];
    // `?passage=` practises exactly one text; facets narrow it further, since
    // the repository ANDs an id allow-list with everything else.
    const passageRecord = url.passage ? repository.passageByRef(url.passage) : undefined;
    const passageItems = url.passage ? (passageRecord?.items ?? []) : undefined;
    /*
     * `?batch=` practises exactly the set a learner assembled.
     *
     * An unknown id resolves to nothing and drops out, widening the session
     * rather than emptying it — the rule `session-url.ts` is built on, and the
     * same thing a stale `?skill=` does. A batch that *is* known but whose items
     * have all fallen outside the current course is the one case that must not
     * widen, because practising the whole pack is not what the link asked for;
     * `emptyBatch` below is that case, reported rather than silently broadened.
     */
    const batch = url.batch ? batchById(batches, url.batch) : undefined;
    // `?skill=preterite` narrows to the items a skill is attached to. A slug no
    // loaded pack declares resolves to nothing and drops out, so a stale link
    // widens to a broader session rather than planning an empty one — a facet
    // like every other, not an id allow-list.
    const skills = (url.skills ?? [])
      .map((slug) => repository.skillByRef(slug)?.id)
      .filter((id): id is SkillId => id !== undefined);
    // Both spell "exactly these items", so a link carrying both would have one
    // quietly overwrite the other. A passage is the narrower and the authored
    // one, so it wins — and no screen builds such a link in the first place.
    const allowList = passageItems ?? batch?.itemIds;
    const scope = {
      ...url.filter,
      ...(allowList ? { ids: allowList } : {}),
      ...(skills.length ? { skills } : {}),
    };

    // A batch whose material has all fallen outside this course — a different
    // language, or a level ceiling below what it was drawn at. Asked here rather
    // than inferred from an empty plan, because "nothing to practise" and "this
    // set is not part of what you are studying" are different problems and only
    // one of them is fixed by switching course.
    const batchOutOfScope =
      batch !== undefined &&
      passageItems === undefined &&
      repository.query({ ...courseScope, ids: batch.itemIds }).length === 0;

    return {
      preset: chosen,
      mission: url.mission,
      // What the session is *over*, in the two shapes that have a name of their
      // own. The mission's title beats both and is resolved outside, where the
      // catalogue is.
      batchLabel: batch?.label,
      passageTitle: passageRecord?.title,
      emptyBatch: batchOutOfScope ? batch.label : undefined,
      config: buildSessionConfig(chosen, {
        repository,
        preferences,
        pronunciationLocale,
        size: url.size,
        courseScope,
        scope,
        ...(url.ordering ? { ordering: url.ordering } : {}),
        ...(url.dueOnly ? { dueOnly: true } : {}),
        ...(url.focus ? { focus: url.focus } : {}),
        ...(url.seed !== undefined ? { seed: url.seed } : {}),
      }),
    };
  }, [search, repository, preferences, pronunciationLocale, courseScope, batches]);

  const runner = useSessionRunner(config, course);
  const activeMission = mission ? missionById(MISSIONS, course, mission) : undefined;
  /*
   * What is being practised, which is the question the header used to answer
   * with the preset. "Quick practice" is *how*, and it is the same five words
   * over a mission, a set and the whole course — so the subject leads and the
   * preset becomes the line under it. A session with no subject keeps the
   * preset as its name, because then that genuinely is what the screen is.
   */
  const subject = activeMission?.title ?? batchLabel ?? passageTitle;
  /*
   * One step, to the thing the session is over. `history` was the other option
   * and it is the one the rule in `tests/features/back-navigation.test.tsx`
   * forbids: a learner who reached a mission session through three sections and
   * a stage was that many taps from the screen that sent them here.
   */
  const back = activeMission
    ? missionPath(course, activeMission.id, 'understand')
    : batchLabel !== undefined
      ? studyPath(course, 'batches')
      : path();

  return (
    <AppShell
      title={subject ?? preset.label}
      {...(subject ? { subtitle: preset.label } : {})}
      onBack={() => void navigate(back)}
      showNav={false}
    >
      {runner.status === 'loading' && <p className={styles.hint}>Preparing…</p>}

      {runner.status === 'empty' && (
        <section className={styles.summaryScreen}>
          <p>
            {emptyBatch
              ? `None of “${emptyBatch}” is part of this course. Switch course to practise it.`
              : 'Nothing to practise here yet.'}
          </p>
          <Button variant="primary" block large onClick={() => void navigate(path())}>
            Back to home
          </Button>
        </section>
      )}

      {runner.status === 'active' && (
        <>
          {activeMission && (
            <MissionJourney current="practise" hrefs={missionJourneyHrefs(course, activeMission)} />
          )}
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
              <Icon name="previous" /> Previous
            </Button>
            <Button variant="ghost" onClick={runner.next}>
              Skip <Icon name="skip" />
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

          {activeMission ? (
            <Button
              variant="primary"
              block
              large
              onClick={() => void navigate(missionPath(course, activeMission.id, 'use'))}
            >
              Continue to Use <Icon name="forward" />
            </Button>
          ) : (
            <Button variant="primary" block large onClick={runner.restart}>
              {runner.tracked ? 'Practise again' : 'Study again'}
            </Button>
          )}
          {activeMission && (
            <Button block onClick={runner.restart}>
              Practise again
            </Button>
          )}
          <Button block onClick={() => void navigate(path())}>
            Home
          </Button>
        </section>
      )}
    </AppShell>
  );
}
