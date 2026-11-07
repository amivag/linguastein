import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  useCourse,
  usePronunciationLocale,
  useTargetLanguage,
  useVoiceName,
} from '../../app/course';
import { MISSIONS } from '../../app/missions';
import { useServices } from '../../app/services-context';
import { Annotation } from '../../components/Annotation';
import { Button } from '../../components/Button';
import { GrammarTags } from '../../components/GrammarTags';
import { Icon, type IconName } from '../../components/Icon';
import { TokenizedText } from '../../components/TokenizedText';
import { UsageBadges } from '../../components/UsageBadges';
import type { WordSelection } from '../../components/useWordSelection';
import {
  parseEntityId,
  searchFoundNothing,
  type PartOfSpeech,
  type PhraseResult,
  type SearchDestination,
  type SearchResults as Results,
  type WordResult,
} from '../../domain/content';
import { missionsUsingPassage } from '../../domain/missions';
import { kindHue } from '../../styles/kinds';
import surfaces from '../../styles/surfaces.module.css';
import { browsePath } from '../browse/browse-url';
import { missionPath } from '../missions/mission-url';
import { sessionPath } from '../practice/session-url';
import styles from './SearchResults.module.css';

/** Five, then the rest in place — see {@link SearchResults} on why not a scroller. */
const SHOWN = 5;

interface SearchResultsProps {
  readonly results: Results;
  /**
   * The screen's word selection, so language is tappable here as everywhere else.
   *
   * The whole hook rather than an id and a token list: token ids are item-scoped
   * (`t1` in every phrase), so `tokensFor` is what stops one selection lighting
   * up the first word of every row — the reason `useWordSelection` holds the item
   * as part of its state.
   */
  readonly words: WordSelection;
}

/**
 * What the app knows about what a learner typed: the words, the phrases, and
 * where the words are taught.
 *
 * Three blocks in that order, because they answer progressively wider questions —
 * "what is this", then "where have I seen it", then "where do I go for more". A
 * block with nothing in it is not rendered at all, which is the rule every tile
 * and category in the app already follows.
 *
 * Long lists expand **in place** rather than into a capped, scrolling panel. Two
 * places in the app have already rejected the inner scroller — Browse keeps its
 * filters in one overlay so "the page never has nested scroll regions", and
 * `CategoryPicker` records that a second scroll region made its tiles feel
 * clipped — and a results page is the worst case for it, since the thing you
 * scrolled away is the thing you came to read.
 */
export function SearchResults({ results, words }: SearchResultsProps) {
  if (searchFoundNothing(results)) return <NothingFound results={results} />;

  return (
    <div className={styles.results}>
      {/* One live region for the whole answer, announced once. Each block below
          is a plain section: three regions would talk over each other, and a
          count that changes per keystroke is not three separate pieces of news. */}
      <p role="status" className="visually-hidden">
        {summarise(results)}
      </p>

      {results.words.length > 0 && (
        <section aria-labelledby="search-words">
          <h2 id="search-words" className={styles.sectionTitle}>
            {results.words.length === 1 ? 'Word' : 'Words'}
          </h2>
          {results.words.map((word) => (
            <WordEntry key={`${word.term}:${word.lexeme}`} word={word} words={words} />
          ))}
        </section>
      )}

      {results.unresolved.length > 0 && results.words.length > 0 && (
        <p className={styles.unresolved}>
          {/* Named rather than counted: "3 words not found" tells a learner
              nothing they can act on, and which ones is the whole message. */}
          Nothing yet for {list(results.unresolved.map((term) => `“${term}”`))}.
        </p>
      )}

      {results.phrases.length > 0 && <Phrases phrases={results.phrases} words={words} />}

      {results.destinations.length > 0 && <Destinations destinations={results.destinations} />}
    </div>
  );
}

/**
 * One dictionary entry.
 *
 * The headword is set in the display voice and set large, because it is the
 * language and the rest of this is furniture — rule 4, and the reason the gloss
 * below it is an `Annotation` rather than another heading.
 */
function WordEntry({ word, words }: { readonly word: WordResult; readonly words: WordSelection }) {
  const { services } = useServices();
  const { course } = useCourse();
  const lang = useTargetLanguage();
  const locale = usePronunciationLocale();
  const voice = useVoiceName();
  const [expanded, setExpanded] = useState(false);
  const info = word.info;
  const headword = info.lemma ?? info.token.text;

  const speak = () =>
    void services.audio.speak({
      text: headword,
      locale,
      ...(voice ? { voice } : {}),
    });

  const shown = expanded ? info.examples : info.examples.slice(0, SHOWN);
  const hidden = info.examples.length - shown.length;

  return (
    <article className={`${surfaces['card'] ?? ''} ${styles.entry}`}>
      <header className={styles.entryHead}>
        <div className={styles.headword}>
          <h3 className={styles.lemma} lang={lang}>
            {headword}
          </h3>
          <GrammarTags
            pos={info.pos}
            posLabel={info.posLabel}
            gender={info.gender}
            className={styles.tags}
          />
        </div>
        <Button variant="ghost" icon onClick={speak} aria-label={`Pronounce ${headword}`}>
          <Icon name="speak" />
        </Button>
      </header>

      {/* Why this entry is the answer to what they typed. Without it, a learner
          who wrote `tengo` and is shown `tener` has a correct answer that looks
          like a wrong one. */}
      {word.match.via !== undefined && word.match.field !== 'word' && (
        <p className={styles.via}>
          {word.match.field === 'form' ? (
            <>
              you typed <strong lang={lang}>{word.match.via}</strong>
            </>
          ) : (
            <>matched on “{word.match.via}”</>
          )}
        </p>
      )}

      {info.gloss && (
        <Annotation facet="meaning" lead>
          {info.gloss}
        </Annotation>
      )}
      <UsageBadges register={info.register} regions={info.regions} compact />

      {/* Marked, not withheld: "no results" cannot tell a learner whether a word
          is missing from the packs or merely above their level. */}
      {word.beyondScope && (
        <p className={styles.beyond}>
          <Icon name="level" size="sm" /> Not in this course yet — it belongs to a wider level.
        </p>
      )}

      {info.forms.length > 0 && (
        <div className={styles.block}>
          <BlockTitle icon="word">Other forms</BlockTitle>
          <ul className={styles.forms}>
            {info.forms.map((form) => (
              <li key={`${form.form}-${form.label}`} className={form.current ? styles.current : ''}>
                <span lang={lang}>{form.form}</span>
                <span className={styles.formLabel}>{form.label}</span>
                {/* The tint alone would carry this, and colour is never the only
                    signal the app uses to say something. */}
                {form.current && <span className="visually-hidden">the form you typed</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {shown.length > 0 && (
        <div className={styles.block}>
          <BlockTitle icon="passage">Used in</BlockTitle>
          <ul className={styles.examples}>
            {shown.map((example) => {
              const item = services.repository.getItem(example.id);
              return (
                <li key={example.id}>
                  {item ? (
                    <TokenizedText
                      item={item}
                      contextLabel={item.text}
                      onSelect={(tokenId) => words.open(item.id, tokenId)}
                      selected={words.tokensFor(item.id)}
                    />
                  ) : (
                    <p lang={lang}>{example.text}</p>
                  )}
                  {example.translation && (
                    <p className={styles.exampleGloss}>{example.translation}</p>
                  )}
                </li>
              );
            })}
          </ul>
          {hidden > 0 && (
            <Button variant="ghost" onClick={() => setExpanded(true)}>
              <Icon name="expand" size="sm" /> Show {hidden} more
            </Button>
          )}
          {/* No silent caps: the domain stops at its limit, so if there is more
              behind it the screen says so rather than reading as the whole. */}
          {expanded && word.exampleTotal > info.examples.length && (
            <p className={styles.footnote}>
              Showing {info.examples.length} of {word.exampleTotal}. Browse the rest under{' '}
              <Link to={browsePath(course, { filter: { search: headword } })}>{headword}</Link>.
            </p>
          )}
        </div>
      )}

      {word.card && (
        <Link
          className={styles.practise}
          to={browsePath(course, { filter: { types: ['word'], search: headword } })}
        >
          Practise this word <Icon name="next" size="sm" />
        </Link>
      )}
    </article>
  );
}

/** Phrases the query *is*, rather than words it is made of. */
function Phrases({
  phrases,
  words,
}: {
  readonly phrases: readonly PhraseResult[];
  readonly words: WordSelection;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? phrases : phrases.slice(0, SHOWN);
  const hidden = phrases.length - shown.length;

  return (
    <section aria-labelledby="search-phrases">
      <h2 id="search-phrases" className={styles.sectionTitle}>
        Phrases
      </h2>
      <ul className={styles.phrases}>
        {shown.map((phrase) => (
          <li key={phrase.item.id} className={`${surfaces['card'] ?? ''} ${styles.phrase}`}>
            <TokenizedText
              item={phrase.item}
              contextLabel={phrase.item.text}
              onSelect={(tokenId) => words.open(phrase.item.id, tokenId)}
              selected={words.tokensFor(phrase.item.id)}
            />
            {phrase.translation && <p className={styles.exampleGloss}>{phrase.translation}</p>}
          </li>
        ))}
      </ul>
      {hidden > 0 && (
        <Button variant="ghost" onClick={() => setExpanded(true)}>
          <Icon name="expand" size="sm" /> Show {hidden} more
        </Button>
      )}
    </section>
  );
}

/**
 * Where to go next, grouped by what kind of place it is.
 *
 * Missions are derived here rather than returned by `searchContent`, because a
 * mission points at a *passage* and content does not know what a mission is —
 * `missionsUsingPassage` is the one place that chain is spelled out.
 */
function Destinations({ destinations }: { readonly destinations: readonly SearchDestination[] }) {
  const { course, path, ladder } = useCourse();
  const passages = destinations.filter((entry) => entry.kind === 'passage');

  /**
   * A grammar pattern opens a study session, not a Browse sheet.
   *
   * `writeItemFilter` has no `skill` — a skill travels in a *session* link
   * (`?skill=preterite`), which AGENTS.md calls the only way a session can ask
   * for a tense. Spelling it as a Browse filter produced a link that silently
   * dropped the narrowing and showed the whole course. `flashcards` is
   * `mode: 'study'`, so opening one records nothing, exactly as Study's own
   * grammar tiles do.
   */
  const patternLink = (skill: string) =>
    sessionPath(course, {
      preset: 'flashcards',
      size: { kind: 'all' },
      skills: [parseEntityId(skill)?.local ?? skill],
      ordering: 'random',
    });

  // Deduplicated across passages: a mission whose ladder uses two of the texts a
  // word appears in is still one mission.
  const missions = [
    ...new Map(
      passages
        .flatMap((entry) =>
          missionsUsingPassage(
            MISSIONS,
            course,
            parseEntityId(entry.ref)?.local ?? entry.ref,
            ladder,
          ),
        )
        .map((mission) => [mission.id, mission]),
    ).values(),
  ];

  const named = (kind: SearchDestination['kind'], to: (entry: SearchDestination) => string) =>
    destinations
      .filter((entry) => entry.kind === kind)
      .map((entry) => ({
        key: entry.ref,
        label: entry.label,
        count: entry.count,
        to: to(entry),
      }));

  const groups: readonly {
    readonly title: string;
    readonly icon: IconName;
    readonly links: readonly DestinationLink[];
  }[] = [
    {
      title: 'Missions',
      icon: 'mission',
      links: missions.map((mission) => ({
        key: mission.id,
        label: mission.title,
        to: missionPath(course, mission.id),
      })),
    },
    {
      title: 'Texts',
      icon: 'passage',
      links: named('passage', (entry) =>
        path(`read/${parseEntityId(entry.ref)?.local ?? entry.ref}`),
      ),
    },
    { title: 'Grammar', icon: 'grammar', links: named('skill', (entry) => patternLink(entry.ref)) },
    {
      title: 'Categories',
      icon: 'topic',
      links: named('topic', (entry) => browsePath(course, { filter: { topics: [entry.ref] } })),
    },
    {
      title: 'Word kinds',
      icon: 'word',
      links: named('kind', (entry) =>
        browsePath(course, { filter: { types: ['word'], pos: [entry.ref as PartOfSpeech] } }),
      ),
    },
  ];

  const present = groups.filter((group) => group.links.length > 0);
  if (present.length === 0) return null;

  return (
    <section aria-labelledby="search-destinations">
      <h2 id="search-destinations" className={styles.sectionTitle}>
        Where this is taught
      </h2>
      {present.map((group) => (
        <div key={group.title} className={styles.group}>
          <BlockTitle icon={group.icon}>{group.title}</BlockTitle>
          <ul className={styles.destinations}>
            {group.links.map((link) => (
              <li key={link.key}>
                {/* A link rather than a `Chip`, which is a `<button>` and means
                    "narrow this". The count is inside the link's own text for the
                    reason Study's tiles put it there: eight links named after
                    categories with the numbers rendered separately give an agent
                    and a screen reader nothing to choose between. */}
                <Link className={styles.destination} to={link.to}>
                  <span
                    className={styles.destinationDot}
                    data-kind={kindHue(link.key)}
                    aria-hidden="true"
                  />
                  <span>{link.label}</span>
                  {link.count !== undefined && (
                    <span className={styles.destinationCount}>{link.count}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

interface DestinationLink {
  readonly key: string;
  readonly label: string;
  readonly to: string;
  /** Absent for a mission, which is one thing rather than a count of phrases. */
  readonly count?: number;
}

/**
 * The empty state, and it has to distinguish two things.
 *
 * "We have nothing for this" and "this is not spelled the way the pack spells it"
 * lead to different next moves, and a single "no results" line makes them look
 * like the same dead end.
 */
function NothingFound({ results }: { readonly results: Results }) {
  const { course } = useCourse();

  return (
    <div className={`${surfaces['card'] ?? ''} ${styles.empty}`} role="status">
      <p className={styles.emptyLead}>Nothing found for “{results.query}”.</p>
      <p className={styles.footnote}>
        Words can be typed in either language, and in any form — <em>tengo</em> finds <em>tener</em>
        . If it is a phrase, try one word of it.
      </p>
      <Link
        className={styles.practise}
        to={browsePath(course, { filter: { search: results.query } })}
      >
        Look for it in the full list <Icon name="next" size="sm" />
      </Link>
    </div>
  );
}

function BlockTitle({ icon, children }: { readonly icon: IconName; readonly children: ReactNode }) {
  return (
    <p className={styles.blockTitle}>
      <Icon name={icon} size="sm" /> {children}
    </p>
  );
}

/** What the live region says: the shape of the answer, not the answer itself. */
function summarise(results: Results): string {
  const parts: string[] = [];
  if (results.words.length) {
    parts.push(`${results.words.length} ${results.words.length === 1 ? 'word' : 'words'}`);
  }
  if (results.phrases.length) {
    parts.push(`${results.phrases.length} ${results.phrases.length === 1 ? 'phrase' : 'phrases'}`);
  }
  return `${parts.join(' and ')} for “${results.query}”`;
}

/** `a, b and c` — an English list, so a sentence naming three words reads as one. */
function list(values: readonly string[]): string {
  if (values.length <= 1) return values[0] ?? '';
  return `${values.slice(0, -1).join(', ')} and ${values[values.length - 1]}`;
}
