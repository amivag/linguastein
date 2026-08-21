import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useCourse } from '../../app/course';
import { useServices } from '../../app/services-context';
import { AppShell } from '../../components/AppShell';
import { CourseBar } from '../../components/CourseBar';
import { Icon, type IconName } from '../../components/Icon';
import { ThemeToggle } from '../../components/ThemeToggle';
import { coursePath, POS_LABELS, type PartOfSpeech } from '../../domain/content';
import { browsePath } from '../browse/browse-url';
import { sessionPath } from '../practice/session-url';
import styles from './StudyScreen.module.css';

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
 * evidence of retrieval. Every link on this screen leads somewhere that records
 * nothing.
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
        Everything here is for reading and listening — nothing is graded and nothing is recorded.
      </p>

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
  readonly children: React.ReactNode;
}

function Section({ label, icon, note, children }: SectionProps) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionLabel}>
        <Icon name={icon} size="sm" />
        {label}
      </h2>
      {note && <p className={styles.sectionNote}>{note}</p>}
      <ul className={styles.tiles}>{children}</ul>
    </section>
  );
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
