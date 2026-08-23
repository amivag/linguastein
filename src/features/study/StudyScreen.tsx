import { useEffect, useId, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCourse } from '../../app/course';
import { MISSIONS } from '../../app/missions';
import { useServices } from '../../app/services-context';
import { AppShell } from '../../components/AppShell';
import { CourseBar } from '../../components/CourseBar';
import { Icon, type IconName } from '../../components/Icon';
import { SectionTabs } from '../../components/SectionTabs';
import { Sheet } from '../../components/Sheet';
import { ThemeToggle } from '../../components/ThemeToggle';
import {
  levelLabel,
  POS_LABELS,
  type ItemId,
  type PartOfSpeech,
  type SkillKind,
} from '../../domain/content';
import {
  missionStandings,
  missionUseEvidence,
  type MissionEvidence,
  type MissionStanding,
} from '../../domain/missions';
import { batchStandings, type BatchStanding } from '../../domain/batches';
import type { Attempt, ItemProgress } from '../../domain/progress';
import { localDay } from '../../utils/calendar';
import { browsePath } from '../browse/browse-url';
import { missionPath } from '../missions/mission-url';
import { readPath } from '../read/read-url';
import { sessionPath } from '../practice/session-url';
import { parseStudyTab, studyPath, type StudyTab } from './study-url';
import styles from './StudyScreen.module.css';

const NO_EVIDENCE: MissionEvidence = { practised: new Set(), used: new Map() };

/**
 * One read of the learner's history, in the shapes the two derived lists need.
 *
 * Missions want "what has been practised at all" plus the Use-stage evidence;
 * batches want the progress records themselves, because absorbing an item is a
 * question about its memory stability rather than about having met it. Held as
 * one state so the attempt log is read once — it is the whole log, and reading it
 * twice on one screen is the cost `learner-profile.md` §4.5 warns about.
 *
 * `now` is captured here rather than read during render: the React Compiler rules
 * forbid `Date.now()` in a render pass, and a due count that changed on every
 * re-render would be worse anyway.
 */
interface History {
  readonly evidence: MissionEvidence;
  readonly progress: ReadonlyMap<ItemId, ItemProgress>;
  readonly attempts: readonly Attempt[];
  readonly now: number;
}

const NO_HISTORY: History = {
  evidence: NO_EVIDENCE,
  progress: new Map(),
  attempts: [],
  now: 0,
};

/**
 * Study: the material, before anything grades you on it.
 *
 * The app had six ways to be tested and none to be taught — every entry point on
 * the home screen started a session. Browse held the sheets all along (Spanish
 * with its meaning beside it, audio per row, tap a word for its gender and
 * forms) but it was named after the act of searching and its filters lived in
 * component state, so there was no address to send a learner to and nothing to
 * put on a tile.
 *
 * The split is not a new idea in this codebase, only a newly visible one: the
 * domain has drawn it since sessions existed. `mode: 'study'` records nothing
 * and `mode: 'practice'` feeds the scheduler, because a self-rated reveal is not
 * evidence of retrieval. Every sheet on this screen leads somewhere that records
 * nothing.
 *
 * The missions are the deliberate exception, and they are here rather than on
 * Test because a mission is mostly material: an exchange to understand, then the
 * same language used somewhere new. Only its last stage records anything, and
 * both the section note and the row say so — a screen that promised "nothing is
 * recorded" over a control that records would be worse than no promise.
 *
 * **One section at a time.** All of it on one page came to about seventy rows in
 * the shipped course, which is a page you scroll past rather than read: the
 * thirty-five categories buried the three sheets above them. The sections are
 * addresses now (`?tab=grammar`), so a switch is a navigation and a sheet of
 * grammar patterns is a thing you can link someone to.
 *
 * Nothing here is a hard-coded list — the sections included. Word kinds,
 * categories and grammar all come from the packs, counted over the current
 * course, so a pack that grows adverbs or a second language grows a tile with no
 * edit; and a section with nothing in it is not offered at all, which is the same
 * rule the tiles, the categories and the letters already follow.
 */
export function StudyScreen() {
  const { services, preferences, batches } = useServices();
  const { course, option, filter: courseScope } = useCourse();
  const repository = services.repository;
  const [params] = useSearchParams();
  const [history, setHistory] = useState<History>(NO_HISTORY);
  const [scopeOpen, setScopeOpen] = useState(false);
  const scopeSheetId = useId();

  /**
   * The one asynchronous thing on the page, and the one thing on it that is not
   * a count: how far the learner has got with each mission and each set.
   *
   * Read here rather than passed in because both are derived from the attempt log
   * — nothing writes down "mission finished" or "set absorbed", so nothing can be
   * handed a stale copy of either.
   */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [progress, attempts] = await Promise.all([
        services.storage.progress.all(),
        services.storage.attempts.recent(10_000),
      ]);
      if (cancelled) return;
      setHistory({
        evidence: {
          practised: new Set(progress.map((entry) => entry.itemId)),
          used: missionUseEvidence(attempts),
        },
        progress: new Map(progress.map((entry) => [entry.itemId, entry])),
        attempts,
        now: Date.now(),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [services.storage]);

  /** Item ids the course admits, which both derived lists narrow against. */
  const courseItemIds = useMemo(
    () => new Set(repository.query(courseScope).map((item) => item.id)),
    [courseScope, repository],
  );

  const missions = useMemo(
    () => missionStandings(MISSIONS, course, repository, courseItemIds, history.evidence),
    [course, courseItemIds, history.evidence, repository],
  );

  const sets = useMemo(
    () =>
      batchStandings(batches, course, {
        courseItemIds,
        progress: history.progress,
        attempts: history.attempts,
        now: history.now,
        dayOf: localDay,
      }),
    [batches, course, courseItemIds, history],
  );

  const counts = useMemo(() => {
    const inScope = (extra: Parameters<typeof repository.query>[0]) =>
      repository.query({ ...courseScope, ...extra }).length;

    return {
      /**
       * Counted with the filter the tile actually links to, not with
       * `partsOfSpeech`.
       *
       * They are different numbers and the difference is not small:
       * `partsOfSpeech` counts every item *exemplifying* a part of speech,
       * sentences included, so it reported 546 verbs and 847 nouns — while the
       * sheet behind the tile lists word cards, of which there are 357 nouns and
       * no verbs at all. A tile promising 546 and delivering an empty page is
       * worse than no tile.
       *
       * So the zero ones drop out, as an empty category and an unused letter
       * already do. `Verbs` is absent until verb cards exist, and appears the day
       * they do with nothing here to change.
       */
      words: repository
        .partsOfSpeech(courseScope)
        .map((facet) => ({
          pos: facet.pos,
          label: posLabel(facet.pos),
          count: inScope({ types: ['word'], pos: [facet.pos] }),
        }))
        .filter((facet) => facet.count > 0),
      phrases: inScope({ types: ['phrase'] }),
      sentences: inScope({ types: ['sentence'] }),
      topics: repository.topics(courseScope).filter((topic) => topic.count > 0),
      passages: repository.allPassages().length,
      /*
       * Grammar and abilities are two sections rather than one, because they are
       * two kinds of thing and the domain has said so since skills existed: a
       * pattern is how the language works, a `function` is what a learner can
       * accomplish with it. One list put `presente de indicativo` beside `Pedir
       * comida o bebida` — forty-one tiles of two unrelated ideas.
       *
       * `function` is the half that is named; everything else falls to grammar,
       * so a skill kind added later shows up somewhere rather than silently
       * disappearing from the screen.
       *
       * A skill with nothing attached is dropped either way — a tile that leads
       * to an empty sheet, which is the rule the categories and the letters
       * already follow.
       */
      ...groupSkills(
        repository
          .allSkills()
          .map((skill) => ({ skill, count: inScope({ skills: [skill.id] }) }))
          .filter((entry) => entry.count > 0),
      ),
    };
  }, [repository, courseScope]);

  /**
   * The sections this course actually has, in order.
   *
   * Derived rather than listed, so a pack with no authored missions simply has no
   * Missions tab — the alternative is a tab that opens an empty page, which is
   * the same mistake as a tile advertising 546 verbs.
   */
  const sections = useMemo(
    () =>
      (
        [
          { id: 'missions', label: 'Missions', icon: 'mission', size: missions.length },
          // Learner-made rather than pack-derived, so this is the one section
          // whose count is a property of what *they* have done — and the same
          // rule still applies: no sets, no tab, and creation lives on Browse
          // where the sheet being saved is already on screen.
          { id: 'batches', label: 'Sets', icon: 'batch', size: sets.length },
          { id: 'words', label: 'Words', icon: 'word', size: counts.words.length },
          {
            id: 'phrases',
            label: 'Phrases',
            icon: 'browse',
            size: counts.phrases + counts.sentences + counts.passages,
          },
          { id: 'grammar', label: 'Grammar', icon: 'grammar', size: counts.grammar.length },
          { id: 'abilities', label: 'Abilities', icon: 'speak', size: counts.abilities.length },
          { id: 'categories', label: 'Categories', icon: 'topic', size: counts.topics.length },
        ] as const satisfies readonly {
          id: StudyTab;
          label: string;
          icon: IconName;
          size: number;
        }[]
      ).filter((section) => section.size > 0),
    [counts, missions.length, sets.length],
  );

  // An unrecognised or absent section opens the first one this course has, the
  // way a stale course resolves to the widest real one rather than to an error.
  const requested = parseStudyTab(params);
  const current = sections.find((section) => section.id === requested) ?? sections[0];

  /**
   * Stamped onto every sheet this screen links to, so its Back button comes back
   * *here* rather than to bare `/study` — which resolves to whichever section the
   * course starts with, and so answered "back" with "Missions" no matter which
   * section you had left.
   *
   * Read off the open section rather than written out per link: the two cannot
   * then disagree, and a section added later carries the way back with no edit.
   */
  const from = current?.id;

  /** A study session: `flashcards` is `mode: 'study'`, so it records nothing. */
  const studyLink = (skills: readonly string[]) =>
    sessionPath(course, {
      preset: 'flashcards',
      size: { kind: 'all' },
      skills,
      ordering: 'random',
    });

  const inScope = option?.levels.find((entry) => entry.level === course.level)?.count ?? 0;

  return (
    <AppShell title="Study" action={<ThemeToggle variant="compact" />}>
      {/*
        The course, as one line that opens the control rather than as the control.
        It used to be a block of chips and a sentence at the top of every screen,
        which is four lines spent on something a learner changes once a week — and
        the same trade Test already makes for its session options.
      */}
      <button
        type="button"
        className={styles.scope}
        onClick={() => setScopeOpen(true)}
        aria-expanded={scopeOpen}
        aria-controls={scopeSheetId}
        aria-label={`Course: ${option?.label ?? course.language}, ${levelLabel(course.level)}, ${inScope} ${
          inScope === 1 ? 'item' : 'items'
        } in scope. Change course`}
      >
        <Icon name="language" size="sm" className={styles.scopeIcon} />
        <span className={styles.scopeName}>
          {option?.label ?? course.language} · {levelLabel(course.level)}
        </span>
        <span className={styles.scopeCount}>{inScope}</span>
        <Icon name="expand" size="sm" />
      </button>

      <p className={styles.intro}>
        Nothing is graded and nothing is recorded here — except the last stage of a mission, which
        says so.
      </p>

      {sections.length > 0 && (
        <SectionTabs
          label="Study sections"
          current={current?.id ?? ''}
          tabs={sections.map((section) => ({
            id: section.id,
            label: section.label,
            icon: section.icon,
            to: studyPath(course, section.id),
          }))}
        />
      )}

      {current?.id === 'missions' && (
        <Section
          label="Missions"
          icon="mission"
          layout="rows"
          note="A short journey to one real-world outcome: understand the exchange, practise it, then use it somewhere new. The last stage is recorded."
        >
          {missions.map((standing) => (
            <MissionRow key={standing.mission.id} standing={standing} course={course} />
          ))}
        </Section>
      )}

      {current?.id === 'batches' && (
        <Section
          label="Sets"
          icon="batch"
          layout="rows"
          note="Material you chose, to come back to across short sessions until it is absorbed. Practising a set is recorded, like any other practice."
        >
          {sets.map((standing) => (
            <BatchRow key={standing.batch.id} standing={standing} course={course} />
          ))}
        </Section>
      )}

      {current?.id === 'words' && (
        <Section label="Words" icon="word" note="Gender, forms and an example sentence per word.">
          {counts.words.map((kind) => (
            <Tile
              key={kind.pos}
              to={browsePath(course, { filter: { types: ['word'], pos: [kind.pos] }, from })}
              title={kind.label}
              count={kind.count}
            />
          ))}
        </Section>
      )}

      {current?.id === 'phrases' && (
        <Section label="Phrases" icon="browse" note="Every word tappable, on every row.">
          <Tile
            to={browsePath(course, { filter: { types: ['phrase'] }, from })}
            title="Set phrases"
            count={counts.phrases}
            note="Things said as a unit"
          />
          <Tile
            to={browsePath(course, { filter: { types: ['sentence'] }, from })}
            title="Sentences"
            count={counts.sentences}
            note="Full sentences with a verb"
          />
          <Tile
            to={readPath(course, { from })}
            title="Texts and dialogues"
            count={counts.passages}
            note="Several sentences that read as one"
            icon="passage"
          />
        </Section>
      )}

      {current?.id === 'grammar' && (
        // Wide tiles: a pattern's title is target-language text with a
        // translation under it — `estar + gerundio`, "what is happening right
        // now" — and the narrow grid the one-word sections use broke both of them
        // across three lines each on a desktop.
        <Section
          label="Grammar"
          icon="grammar"
          layout="wide"
          note="Opens a study session — see it, say it, reveal the meaning."
        >
          {counts.grammar.map(({ skill, count }) => (
            <Tile
              key={skill.id}
              to={studyLink([localIdOf(skill.id)])}
              title={skill.label}
              count={count}
              {...optionalNote(
                repository.translationOf(skill.id, preferences.referenceLanguage)?.text,
              )}
              lang={course.language}
            />
          ))}
        </Section>
      )}

      {current?.id === 'abilities' && (
        <Section
          label="Abilities"
          icon="speak"
          layout="wide"
          note="What you can do with the language, rather than how it works. Opens a study session."
        >
          {counts.abilities.map(({ skill, count }) => (
            <Tile
              key={skill.id}
              to={studyLink([localIdOf(skill.id)])}
              title={skill.label}
              count={count}
              {...optionalNote(
                repository.translationOf(skill.id, preferences.referenceLanguage)?.text,
              )}
              lang={course.language}
            />
          ))}
        </Section>
      )}

      {current?.id === 'categories' && (
        <Section label="Categories" icon="topic" note="One theme, whatever the type of item.">
          {counts.topics.map((topic) => (
            <Tile
              key={topic.id}
              to={browsePath(course, { filter: { topics: [topic.id] }, from })}
              title={topic.label}
              count={topic.count}
            />
          ))}
        </Section>
      )}

      {scopeOpen && (
        <Sheet id={scopeSheetId} title="Course" onClose={() => setScopeOpen(false)}>
          <div className={styles.scopeSheet}>
            <CourseBar />
            <p className={styles.sectionNote}>
              A level is a ceiling, not a chapter: choosing A2 keeps A1 material in rotation. Every
              count on this screen follows it.
            </p>
          </div>
        </Sheet>
      )}
    </AppShell>
  );
}

interface SectionProps {
  readonly label: string;
  readonly icon: IconName;
  readonly note?: string;
  /**
   * `tiles` is the narrow grid for one-word titles, `wide` for a title that
   * carries its own translation, `rows` for full-width rows.
   */
  readonly layout?: 'tiles' | 'wide' | 'rows';
  readonly children: React.ReactNode;
}

function Section({ label, icon, note, layout = 'tiles', children }: SectionProps) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionLabel}>
        <Icon name={icon} size="sm" />
        {label}
      </h2>
      {note && <p className={styles.sectionNote}>{note}</p>}
      <ul className={styles[layout]}>{children}</ul>
    </section>
  );
}

/**
 * One mission, and where the learner stands in it.
 *
 * The whole state is inside the link's own text — the number, the outcome and
 * what is left — because a list of seven links called "Continue" is unusable to
 * a screen reader and to an agent alike, and because "Transfer 2 of 3" is the
 * only thing that distinguishes a mission you are halfway through from one you
 * have not opened.
 */
function MissionRow({
  standing,
  course,
}: {
  readonly standing: MissionStanding;
  readonly course: Parameters<typeof missionPath>[0];
}) {
  const { mission, complete, position } = standing;

  return (
    <li>
      <Link className={styles.mission} to={missionPath(course, mission.id, standing.stage)}>
        <span
          className={`${styles.missionIndex} ${complete ? styles.missionDone : ''}`}
          aria-hidden="true"
        >
          {complete ? <Icon name="check" size="sm" /> : position}
        </span>
        <span className={styles.missionBody}>
          <span className={styles.missionTitle}>{mission.title}</span>
          <span className={styles.missionGoal}>{mission.goal}</span>
          <span className={styles.missionState}>{describeStanding(standing)}</span>
        </span>
        <Icon name="next" size="sm" />
      </Link>
    </li>
  );
}

/**
 * One set, and how much of it has landed.
 *
 * The whole state is inside the link's text for the reason `MissionRow` gives: a
 * list of links called "Practise" tells a screen reader and an agent nothing, and
 * "11 of 30 absorbed" is the only thing distinguishing a set halfway done from
 * one just made.
 *
 * The link starts a session over the set rather than opening a page about it.
 * There is nothing on such a page a learner needs that this row does not already
 * say, and the whole point of a set is that opening it is one tap.
 */
function BatchRow({
  standing,
  course,
}: {
  readonly standing: BatchStanding;
  readonly course: Parameters<typeof sessionPath>[0];
}) {
  const { batch, complete } = standing;

  return (
    <li>
      <Link
        className={styles.mission}
        to={sessionPath(course, {
          preset: 'quick',
          batch: batch.id,
          size: { kind: 'items', count: batch.perSession ?? standing.total },
        })}
      >
        <span
          className={`${styles.missionIndex} ${complete ? styles.missionDone : ''}`}
          aria-hidden="true"
        >
          {complete ? <Icon name="check" size="sm" /> : standing.absorbed}
        </span>
        <span className={styles.missionBody}>
          <span className={styles.missionTitle}>{batch.label}</span>
          <span className={styles.missionGoal}>{describeBatchSize(standing)}</span>
          <span className={styles.missionState}>{describeBatch(standing)}</span>
        </span>
        <Icon name="next" size="sm" />
      </Link>
    </li>
  );
}

/** How big the set is, and how much of it this course can still reach. */
function describeBatchSize(standing: BatchStanding): string {
  const items = `${standing.total} ${standing.total === 1 ? 'item' : 'items'}`;
  // Reported rather than hidden: a set drawn at a higher level, or before a pack
  // was removed, is not broken — part of it is simply out of reach from here.
  return standing.missing > 0 ? `${items} · ${standing.missing} outside this course` : items;
}

/**
 * What is left, in the terms the set is judged on.
 *
 * Deliberately never a percentage and never the word "mastered": absorbed means
 * the specific, evidenced thing `domain/batches/progress.ts` defines — produced
 * on two separate days and still held a week later — and a rounded percentage
 * would invite reading it as the lexeme mastery this screen must not claim.
 */
function describeBatch(standing: BatchStanding): string {
  if (standing.complete) return `Absorbed · ${standing.absorbed} of ${standing.total}`;
  const parts = [`${standing.absorbed} of ${standing.total} absorbed`];
  if (standing.dueNow > 0) parts.push(`${standing.dueNow} due`);
  else if (standing.untouched > 0) parts.push(`${standing.untouched} not started`);
  return parts.join(' · ');
}

/** What is left to do, in the words the mission screen itself uses. */
function describeStanding(standing: MissionStanding): string {
  if (standing.complete) return 'Complete';
  if (standing.stage === 'use') {
    return `Transfer ${standing.transferPosition} of ${standing.transferTotal}`;
  }
  return `${standing.lineCount} lines · about ${standing.mission.estimatedMinutes} min`;
}

interface TileProps {
  readonly to: string;
  readonly title: string;
  readonly count: number;
  readonly note?: string;
  readonly icon?: IconName;
  /**
   * Set when the title is target-language text, as a grammar pattern's is
   * (`tener que + infinitivo`), so a screen reader does not read Spanish with an
   * English voice.
   */
  readonly lang?: string;
}

function Tile({ to, title, count, note, icon, lang }: TileProps) {
  return (
    <li>
      {/* The count is inside the link's text rather than beside it: forty tiles
          all named "Nouns" with the number rendered separately gives an agent and
          a screen reader nothing to choose between. */}
      <Link className={styles.tile} to={to}>
        {icon && <Icon name={icon} size="sm" className={styles.tileIcon} />}
        <span className={styles.tileTitle} {...(lang ? { lang } : {})}>
          {title}
        </span>
        <span className={styles.tileCount}>{count}</span>
        {note && <span className={styles.tileNote}>{note}</span>}
      </Link>
    </li>
  );
}

/**
 * Skills split into the two sections they belong to.
 *
 * A `function` is what a learner can accomplish — ordering food, asking a price
 * — and everything else describes how the language works. Written as one pass
 * with a default rather than as two filters, so a skill kind nobody has thought
 * of yet lands in Grammar instead of vanishing from the screen.
 */
function groupSkills<T extends { readonly skill: { readonly kind: SkillKind } }>(
  entries: readonly T[],
): { grammar: readonly T[]; abilities: readonly T[] } {
  return {
    grammar: entries.filter((entry) => entry.skill.kind !== 'function'),
    abilities: entries.filter((entry) => entry.skill.kind === 'function'),
  };
}

/** "Verbs", "Nouns" — the plural of what a sheet calls one word. */
function posLabel(pos: PartOfSpeech): string {
  const singular = POS_LABELS[pos];
  return `${singular.charAt(0).toUpperCase()}${singular.slice(1)}s`;
}

/**
 * `exactOptionalPropertyTypes` is on, so an absent note is an absent *property*
 * rather than one set to `undefined` — a skill with no translation in the
 * learner's language must render no note, not an empty one.
 */
function optionalNote(text: string | undefined): { note?: string } {
  return text ? { note: text } : {};
}

/** `core-es:skill:preterite` → `preterite`, as a session link carries it. */
function localIdOf(id: string): string {
  return id.slice(id.lastIndexOf(':') + 1);
}
