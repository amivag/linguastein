import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCourse } from '../../app/course';
import { MISSIONS } from '../../app/missions';
import { useServices } from '../../app/services-context';
import { AppShell } from '../../components/AppShell';
import { CourseBar } from '../../components/CourseBar';
import { Icon, type IconName } from '../../components/Icon';
import { ThemeToggle } from '../../components/ThemeToggle';
import { coursePath, POS_LABELS, type PartOfSpeech } from '../../domain/content';
import {
  missionStandings,
  missionUseEvidence,
  type MissionEvidence,
  type MissionStanding,
} from '../../domain/missions';
import { browsePath } from '../browse/browse-url';
import { missionPath } from '../missions/mission-url';
import { sessionPath } from '../practice/session-url';
import styles from './StudyScreen.module.css';

const NO_EVIDENCE: MissionEvidence = { practised: new Set(), used: new Map() };

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
 * Nothing here is a hard-coded list. The word kinds, the categories and the
 * grammar all come from the packs, counted over the current course, so a pack
 * that grows adverbs or a second language grows a tile with no edit — and a
 * category that would lead nowhere is not offered, which is what quietly hides
 * the seven numeral skills no item carries.
 */
export function StudyScreen() {
  const { services, preferences } = useServices();
  const { course, filter: courseScope } = useCourse();
  const repository = services.repository;
  const [evidence, setEvidence] = useState<MissionEvidence>(NO_EVIDENCE);

  /**
   * The one asynchronous thing on the page, and the one thing on it that is not
   * a count: how far the learner has got with each mission.
   *
   * Read here rather than passed in because a mission's completion is derived
   * from the attempt log — nothing writes down "mission finished", so nothing can
   * be handed a stale copy of it.
   */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [progress, attempts] = await Promise.all([
        services.storage.progress.all(),
        services.storage.attempts.recent(10_000),
      ]);
      if (cancelled) return;
      setEvidence({
        practised: new Set(progress.map((entry) => entry.itemId)),
        used: missionUseEvidence(attempts),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [services.storage]);

  const missions = useMemo(() => {
    const courseIds = new Set(repository.query(courseScope).map((item) => item.id));
    return missionStandings(MISSIONS, course, repository, courseIds, evidence);
  }, [course, courseScope, evidence, repository]);

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
      // A skill with nothing attached is a tile that leads to an empty sheet —
      // the same rule the categories and the letters already follow.
      grammar: repository
        .allSkills()
        .map((skill) => ({ skill, count: inScope({ skills: [skill.id] }) }))
        .filter((entry) => entry.count > 0),
    };
  }, [repository, courseScope]);

  /** A study session: `flashcards` is `mode: 'study'`, so it records nothing. */
  const studyLink = (skills: readonly string[]) =>
    sessionPath(course, {
      preset: 'flashcards',
      size: { kind: 'all' },
      skills,
      ordering: 'random',
    });

  return (
    <AppShell title="Study" action={<ThemeToggle variant="compact" />}>
      <CourseBar />

      <p className={styles.intro}>
        The sheets here are for reading and listening — nothing is graded and nothing is recorded. A
        mission is the exception, and says so: it ends in practice that counts.
      </p>

      {/* Missions lead, because they are the one thing on this screen that says
          what to do *next*. They belong to Study rather than to Test for the
          reason the section split exists at all: a mission is material and a
          route through it, and only its last stage is a test. */}
      {missions.length > 0 && (
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

      <Section label="Words" icon="word">
        {counts.words.map((kind) => (
          <Tile
            key={kind.pos}
            to={browsePath(course, { filter: { types: ['word'], pos: [kind.pos] } })}
            title={kind.label}
            count={kind.count}
          />
        ))}
      </Section>

      <Section label="Phrases and sentences" icon="browse">
        <Tile
          to={browsePath(course, { filter: { types: ['phrase'] } })}
          title="Set phrases"
          count={counts.phrases}
          note="Things said as a unit"
        />
        <Tile
          to={browsePath(course, { filter: { types: ['sentence'] } })}
          title="Sentences"
          count={counts.sentences}
          note="Full sentences with a verb"
        />
        <Tile
          to={coursePath(course, 'read')}
          title="Texts and dialogues"
          count={counts.passages}
          note="Several sentences that read as one"
          icon="passage"
        />
      </Section>

      {counts.grammar.length > 0 && (
        <Section
          label="Grammar and patterns"
          icon="grammar"
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

      <Section label="By category" icon="topic">
        {counts.topics.map((topic) => (
          <Tile
            key={topic.id}
            to={browsePath(course, { filter: { topics: [topic.id] } })}
            title={topic.label}
            count={topic.count}
          />
        ))}
      </Section>
    </AppShell>
  );
}

interface SectionProps {
  readonly label: string;
  readonly icon: IconName;
  readonly note?: string;
  /** Square tiles by default; full-width rows where a title needs the room. */
  readonly layout?: 'tiles' | 'rows';
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
      <ul className={layout === 'rows' ? styles.missions : styles.tiles}>{children}</ul>
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
