import { useDeferredValue, useEffect, useId, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useCourse, usePronunciationLocale } from '../../app/course';
import { useServices } from '../../app/services-context';
import { MISSIONS } from '../../app/missions';
import { AppShell } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { CourseBar } from '../../components/CourseBar';
import { Icon, type IconName } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { ThemeToggle } from '../../components/ThemeToggle';
import { TokenizedText } from '../../components/TokenizedText';
import { useWordSelection } from '../../components/useWordSelection';
import { WordInfoSheet } from '../../components/WordInfoSheet';
import { kindHue } from '../../styles/kinds';
import surfaces from '../../styles/surfaces.module.css';
import { levelLabel, reachableTopics, searchContent, type ItemId } from '../../domain/content';
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
  type SessionRecord,
  type SessionSize,
} from '../../domain/sessions';
import { FocusPicker } from '../practice/FocusPicker';
import { PRESET_IDS, PRESETS, type PresetId } from '../practice/presets';
import { sessionPath } from '../practice/session-url';
import { missionPath } from '../missions/mission-url';
import { readPath } from '../read/read-url';
import { studyPath } from '../study/study-url';
import { SearchBox } from '../search/SearchBox';
import { SearchResults } from '../search/SearchResults';
import { parseSearchQuery, writeSearchQuery } from '../search/search-url';
import { formatDuration } from '../practice/duration';
import styles from './HomeScreen.module.css';

/**
 * How many recently practised items Home shows.
 *
 * Five, because this is a reminder rather than a log: it exists so a learner who
 * opens the app after two days can see what they were working on and pick it back
 * up, and the full history already has a screen of its own in Progress. A list
 * long enough to scroll would make Home a second Progress and push the material
 * survey below the fold.
 */
const RECENT_ITEMS = 5;

/**
 * The course coach: one trustworthy next action, with the laboratory still one
 * tap away for a learner who already knows what they want.
 */
export function HomeScreen() {
  const { services, preferences, batches } = useServices();
  const { course, option, filter, path, state } = useCourse();
  const navigate = useNavigate();
  const practiceSheetId = useId();
  const words = useWordSelection();
  const locale = usePronunciationLocale();
  // Named once, as `StudyScreen` does: every derivation below depends on the
  // repository rather than on the whole services bag, and saying so keeps the
  // memo from re-running when an unrelated service is replaced.
  const repository = services.repository;

  /**
   * The lookup lives in the address, exactly as a session and a sheet do, so a
   * word a learner found can be reloaded, shared and driven by an agent.
   * `search-url.ts` owns the spelling in both directions.
   */
  const [params, setParams] = useSearchParams();
  // As typed, so a space survives a keystroke — see `writeSearchQuery`. Trimmed
  // only to decide whether anything was actually asked.
  const query = parseSearchQuery(params);
  const searching = query.trim() !== '';
  /**
   * Deferred, because the results are recomputed from scratch per keystroke and
   * the passes are linear over the pack — around 15ms on the shipped course,
   * which is most of a frame. React keeps the previous results on screen while
   * the next ones are worked out, so typing stays at the speed of the keyboard
   * rather than the speed of the search.
   */
  const deferredQuery = useDeferredValue(query);
  const results = useMemo(
    () =>
      searchContent(repository, deferredQuery, {
        referenceLanguage: preferences.referenceLanguage,
        // The course, and the whole reason `scope` is an `ItemFilter`: putting
        // this box on a Study section later means passing that section's filter
        // here instead, with no second code path.
        scope: filter,
        // Generous, because the screen shows five and expands in place. The
        // domain's own default is the five; a cap the UI cannot see past is how a
        // truncated list comes to read as the whole of what exists.
        maxExamples: 24,
      }),
    [repository, deferredQuery, preferences.referenceLanguage, filter],
  );

  const search = (value: string) => {
    const next = new URLSearchParams(params);
    writeSearchQuery(next, value);
    // `replace`, as Browse does: typing four letters into the box must not put
    // four entries in the history for Back to walk out through.
    setParams(next, { replace: true });
  };
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
  /**
   * The item ids this learner touched most recently, newest first.
   *
   * Ids rather than items, because what is stored is history and what is rendered
   * is content: an id that no longer resolves — a pack removed, a level lowered —
   * has to drop out at render rather than be missing from state, or the list
   * silently shortens and nothing says why.
   */
  const [recentIds, setRecentIds] = useState<readonly ItemId[]>([]);
  const [sessions, setSessions] = useState<readonly RecentSession[]>([]);

  // Every recommendation and count is scoped to the course in the URL.
  const scope = useMemo(() => {
    const items = services.repository.query(filter);
    return { total: items.length, ids: new Set(items.map((item) => item.id)) };
  }, [services.repository, filter]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [progress, attempts, recentSessions] = await Promise.all([
        services.storage.progress.all(),
        services.storage.attempts.recent(10_000),
        // Narrowed by language rather than by course, the call `SessionStore`
        // documents: a level is a ceiling, so a session practised at A1 is part
        // of the history an A2 learner is looking at.
        services.storage.sessions.recent(3, course.language),
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
      setSessions(recentSessions.map((session) => describeSession(session, now)));
      setRecentIds(mostRecentItems(attemptsInScope, RECENT_ITEMS));
    })();
    return () => {
      cancelled = true;
    };
  }, [services, scope, course.language]);

  /**
   * The material behind {@link recentIds}, as far as it still resolves.
   *
   * Resolved here rather than stored, so switching level or unloading a pack
   * shortens this list instead of showing rows that lead nowhere.
   */
  const recent = useMemo(
    () =>
      recentIds
        .map((itemId) => services.repository.getItem(itemId))
        .filter((item): item is NonNullable<typeof item> => item !== undefined)
        .map((item) => ({
          item,
          translation: services.repository.translationOf(item.id, preferences.referenceLanguage)
            ?.text,
        })),
    [preferences.referenceLanguage, recentIds, services.repository],
  );

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

  /**
   * What this course actually holds, as one row per kind of material.
   *
   * The question a learner arriving at a course asks first and the app had no
   * screen answering: Study lists the material, but a learner has to open each of
   * its seven sections to find out whether there is anything in them. Counted with
   * the filter each row links to — the mistake Study's word tiles made once and
   * `AGENTS.md` now warns about, where a tile advertised 546 verbs and led to a
   * sheet listing none.
   *
   * Rows with nothing in them drop out, exactly as an empty category and an unused
   * letter already do. A pack with no authored missions simply has no missions
   * row, rather than a row promising zero.
   */
  const contents = useMemo(() => {
    const count = (extra: Parameters<typeof repository.query>[0]) =>
      repository.query({ ...filter, ...extra }).length;

    return [
      {
        id: 'type:mission',
        label: 'Missions',
        note: 'Real situations, start to finish',
        icon: 'mission' as IconName,
        count: standings.length,
        to: studyPath(course, 'missions'),
      },
      {
        id: 'type:word',
        label: 'Words',
        note: 'Cards with meaning, gender and forms',
        icon: 'word' as IconName,
        count: count({ types: ['word'] }),
        to: studyPath(course, 'words'),
      },
      {
        id: 'type:sentence',
        label: 'Phrases & sentences',
        note: 'Language in use, not in isolation',
        icon: 'quick' as IconName,
        count: count({ types: ['phrase'] }) + count({ types: ['sentence'] }),
        to: studyPath(course, 'phrases'),
      },
      {
        id: 'type:passage',
        label: 'Texts to read',
        note: 'Dialogues and short monologues',
        icon: 'passage' as IconName,
        count: repository.allPassages().length,
        to: readPath(course),
      },
      {
        id: 'type:grammar',
        label: 'Grammar patterns',
        note: 'How the language is put together',
        icon: 'grammar' as IconName,
        count: repository
          .allSkills()
          .filter((skill) => skill.kind !== 'function' && count({ skills: [skill.id] }) > 0).length,
        to: studyPath(course, 'grammar'),
      },
      {
        id: 'type:topic',
        label: 'Categories',
        note: 'Everything by what it is about',
        icon: 'topic' as IconName,
        count: repository.topics(filter).filter((topic) => topic.count > 0).length,
        to: studyPath(course, 'categories'),
      },
    ].filter((row) => row.count > 0);
  }, [course, filter, repository, standings.length]);

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

  /**
   * The chosen categories this course can actually reach.
   *
   * The list is this course's own now, so it can no longer name another
   * language's categories — but it still has to be narrowed, and the reason is
   * the other half of §4.2: a level is a ceiling, so a category whose content is
   * all B1 survives a switch down to A1 within one course. `FocusPicker` narrows
   * the same list for its summary, which is precisely why this cannot stay
   * inline: the two disagreeing is what put an unreachable `?topic=` into a link
   * under a bar that read "Everything".
   */
  const focusTopics = useMemo(
    () => reachableTopics(repository.topics(filter), state.focusTopics),
    [filter, state.focusTopics, repository],
  );

  // The standing focus is written into every free-practice link so the session
  // remains reloadable and shareable rather than secretly reading preferences.
  const focused = {
    ...(focusTopics.length ? { filter: { topics: focusTopics } } : {}),
    ...(state.focus !== 'balanced' ? { focus: state.focus } : {}),
  };

  const start = (preset: PresetId, size: SessionSize) => {
    setPracticeOpen(false);
    void navigate(sessionPath(course, { preset, size, ...focused }));
  };

  /**
   * Practise what was practised most recently, first.
   *
   * A focus rather than a list of ids, which is what makes it a link: `?ids=` is
   * deliberately not part of a session URL — see `session-url.ts` — and a session
   * that cannot be described by its address cannot be reloaded or shared. It is
   * also the honest shape of the request, because "again" is an ordering rather
   * than a narrowing: a learner who asks for it on a fresh install gets an
   * ordinary session instead of an empty screen.
   *
   * Sized to what is actually on screen, so the button's promise matches the list
   * above it rather than dealing an arbitrary ten.
   */
  const practiseRecent = () => {
    void navigate(
      sessionPath(course, {
        preset: 'quick',
        size: { kind: 'items', count: Math.max(recent.length, 5) },
        focus: 'recent',
      }),
    );
  };

  const startFocused = (focus: SessionFocus) => {
    void navigate(
      sessionPath(course, {
        preset: 'quick',
        size: { kind: 'items', count: 5 },
        focus,
        ...(focusTopics.length ? { filter: { topics: focusTopics } } : {}),
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

  const title = `${option?.label ?? 'Practice'} · ${levelLabel(course.level, option?.levelLabels)}`;

  return (
    <AppShell title={title} action={<ThemeToggle variant="compact" />} wide>
      {/* First, because every number below it is scoped to this course: the
          mission, the standing, the contents counts. It used to sit inside the
          Free-practice sheet, which left the one screen whose figures are all
          course-scoped as the only browsing screen with no visible way to change
          the scope — three taps from the count to the control that moves it.

          `compact` as on every other browsing screen, and here for a second
          reason: `design-qa.md` found a course-item count above the mission
          weakened the primary hierarchy, and the note is the count. Nothing is
          lost by dropping it, because the pressed chip's own count *is* the
          number in scope — a level is a ceiling, so "A1 2039" says what the
          note said. */}
      <CourseBar compact />

      {/* Above everything, and pinned rather than tucked behind an icon: "what
          does this mean" is a question a learner has while doing something else,
          which is the same argument `VoicePresence` makes for sitting in every
          header. Home is where they land, so this is where it belongs. */}
      <div className={styles.searchBar}>
        <SearchBox
          value={query}
          onChange={search}
          targetLanguage={course.language}
          referenceLanguage={preferences.referenceLanguage}
          locale={locale}
        />
      </div>

      {/* A search replaces the course survey rather than pushing it down. Every
          number below is about the whole course and none of it is about the word
          being looked up, so leaving it in place would put the answer under four
          screens of something else — and clearing the box brings it all back. */}
      {searching ? (
        <SearchResults results={results} words={words} />
      ) : (
        <>
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
                      <Button
                        className={styles.nextAction}
                        onClick={() => startFocused('struggling')}
                      >
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

          <div className={styles.columns}>
            {recent.length > 0 && (
              <section aria-labelledby="recent-title">
                <h2 id="recent-title" className={styles.sectionTitle}>
                  Where you left off
                </h2>
                {/* Tappable, like every other piece of language in the app: "the thing
              I was just working on" is exactly where a learner wants to ask which
              word was the problem, and Progress already answers that question the
              same way on its own list. */}
                <ul className={styles.recent}>
                  {recent.map(({ item, translation }) => (
                    <li key={item.id} className={styles.recentRow}>
                      <TokenizedText
                        item={item}
                        onSelect={(token) => words.open(item.id, token)}
                        selected={words.tokensFor(item.id)}
                        contextLabel={item.text}
                      />
                      {translation && <span className={styles.recentMeaning}>{translation}</span>}
                    </li>
                  ))}
                </ul>
                <Button block className={styles.recentAgain} onClick={practiseRecent}>
                  <Icon name="again" />
                  Practise this again
                </Button>
                {sessions.length > 0 && (
                  <ul className={styles.sessions} aria-label="Recent sessions">
                    {sessions.map((session) => (
                      <li key={session.id}>
                        <span>{session.when}</span>
                        <span className={styles.sessionScore}>
                          {session.score}
                          {session.duration ? ` · ${session.duration}` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {contents.length > 0 && (
              <section aria-labelledby="contents-title">
                <h2 id="contents-title" className={styles.sectionTitle}>
                  In this course
                </h2>
                <ul className={styles.contents}>
                  {contents.map((row) => (
                    <li key={row.id}>
                      {/* The count is inside the link's text rather than beside it, for
                    the reason Study's tiles record: six rows whose accessible
                    names differ only by a number rendered elsewhere give an agent
                    and a screen reader nothing to choose between. */}
                      {/* The hue is declared on the row, not on the badge inside it:
                    custom properties inherit, so the ground, the spine, the disc
                    and the count all resolve from one `data-kind` and cannot
                    disagree about which colour this kind of material is. */}
                      <Link className={styles.contentRow} data-kind={kindHue(row.id)} to={row.to}>
                        <span className={surfaces.kindBadge} aria-hidden="true">
                          <Icon name={row.icon} size="sm" />
                        </span>
                        <span className={styles.contentText}>
                          <strong>{row.label}</strong>
                          <small>{row.note}</small>
                        </span>
                        <span className={styles.contentCount}>{row.count}</span>
                        <Icon name="next" size="sm" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

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

          {summary && summary.seen > 0 && (
            <section className={styles.standing} aria-labelledby="standing-title">
              <h2 id="standing-title" className={styles.sectionTitle}>
                How far you are
              </h2>
              {/* Two numbers and the bar they describe, and deliberately not the four
              on Progress. This is the glance version: enough to know whether the
              course is moving, with the screen that explains it one tap away.
              `aria-hidden` on the bar because the sentence under it says the same
              thing in words. */}
              <p className={styles.standingLine}>
                <strong>{summary.seen}</strong> of {summary.total} practised ·{' '}
                <strong>{summary.mastered}</strong> mastered
              </p>
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
              <Link className={styles.missionAll} to={path('progress')}>
                See what you know
                <Icon name="next" size="sm" />
              </Link>
            </section>
          )}

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
        </>
      )}

      {practiceOpen && (
        <Sheet id={practiceSheetId} title="Free practice" onClose={() => setPracticeOpen(false)}>
          <div className={styles.practiceSheet}>
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

      {words.item && services.repository.getItem(words.item) && (
        <WordInfoSheet
          item={services.repository.getItem(words.item)!}
          tokenIds={words.tokens}
          onChange={words.set}
          onClose={words.close}
        />
      )}
    </AppShell>
  );
}

/**
 * The most recently practised distinct items, newest first.
 *
 * Distinct is the whole job: a session that drilled one sentence four times would
 * otherwise fill the list with one sentence. Sorted here rather than trusting the
 * store's order, because "newest first" is what this list means and a store that
 * paged differently would break it silently.
 */
function mostRecentItems(attempts: readonly Attempt[], limit: number): readonly ItemId[] {
  const seen = new Set<ItemId>();
  const result: ItemId[] = [];

  for (const attempt of [...attempts].sort((a, b) => b.at - a.at)) {
    if (seen.has(attempt.itemId)) continue;
    seen.add(attempt.itemId);
    result.push(attempt.itemId);
    if (result.length === limit) break;
  }

  return result;
}

/**
 * A finished session, as one readable line.
 *
 * Built in the loading effect rather than at render, and `now` is passed in for
 * the same reason every other timestamp on this screen is: reading the clock
 * during render is an impure call, which the React Compiler rules reject and
 * which would also make "Today" go stale without anything re-rendering. The same
 * constraint shaped `SessionOutcome.nextDueInDays`.
 */
function describeSession(session: SessionRecord, now: number): RecentSession {
  const day = (timestamp: number) => {
    const date = new Date(timestamp);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  };
  const daysAgo = Math.max(0, Math.round((day(now) - day(session.startedAt)) / 86_400_000));

  return {
    id: session.id,
    when: daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo} days ago`,
    score: `${session.correct}/${session.completed} correct`,
    ...(session.endedAt === undefined
      ? {}
      : { duration: formatDuration(session.endedAt - session.startedAt) }),
  };
}

interface RecentSession {
  readonly id: string;
  readonly when: string;
  readonly score: string;
  readonly duration?: string;
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
