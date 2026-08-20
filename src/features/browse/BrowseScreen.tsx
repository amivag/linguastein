import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCourse } from '../../app/course';
import { useServices } from '../../app/services-context';
import { AppShell } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { CourseBar } from '../../components/CourseBar';
import { TokenizedText } from '../../components/TokenizedText';
import { UsageBadges } from '../../components/UsageBadges';
import { useWordSelection } from '../../components/useWordSelection';
import { VoiceInput } from '../../components/VoiceInput';
import { WordInfoSheet } from '../../components/WordInfoSheet';
import {
  FILTERABLE_REGIONS,
  REGISTERS,
  type ItemFilter,
  type ItemType,
  type Register,
} from '../../domain/content';
import type { SessionSize } from '../../domain/sessions';
import { sessionPath } from '../practice/session-url';
import styles from './BrowseScreen.module.css';
import { CategoryPicker } from './CategoryPicker';

const TYPES: readonly { id: ItemType | 'all'; label: string }[] = [
  { id: 'all', label: 'Everything' },
  { id: 'word', label: 'Words' },
  { id: 'phrase', label: 'Phrases' },
  { id: 'sentence', label: 'Sentences' },
];

const PAGE_SIZE = 40;
/** Longest session offered from a filter, however much the filter matched. */
const SESSION_CAP = 20;

/**
 * Free browsing of the whole pack — the "study mode" half of spec §4.2, and
 * the place to look something up rather than practise it.
 */
export function BrowseScreen() {
  const { services, preferences } = useServices();
  const { course, filter: courseScope } = useCourse();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [type, setType] = useState<ItemType | 'all'>('all');
  const [topic, setTopic] = useState('all');
  const [register, setRegister] = useState<Register | 'all'>('all');
  const [region, setRegion] = useState('all');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const words = useWordSelection();

  // Counted over the course, not the current filter: a category's size is a
  // property of what is in scope, and recounting per search would make every
  // tile read 0 as soon as a search narrowed the results. Level is part of the
  // scope rather than one more select here — it is the course, and the bar above
  // owns it.
  const topics = useMemo(
    () => services.repository.topics(courseScope),
    [services.repository, courseScope],
  );
  const topicLabels = useMemo(
    () => new Map(topics.map((entry) => [entry.id, entry.label])),
    [topics],
  );
  const labelFor = (id: string) => topicLabels.get(id) ?? id.replace(/-/g, ' ');

  // One filter object drives both the list and the session link, so what a
  // learner sees here is exactly what "Practise these" practises.
  //
  // The course scope is deliberately *not* folded in here: it is carried by the
  // session's path rather than its query, and duplicating it would write
  // `?level=a1` into every link the screen produces.
  const filter = useMemo<ItemFilter>(
    () => ({
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(type === 'all' ? {} : { types: [type] }),
      ...(topic === 'all' ? {} : { topics: [topic] }),
      ...(register === 'all' ? {} : { registers: [register] }),
      ...(region === 'all' ? {} : { usableIn: region }),
    }),
    [search, type, topic, register, region],
  );

  const results = useMemo(
    () => services.repository.query({ ...courseScope, ...filter }),
    [services.repository, courseScope, filter],
  );

  const shown = results.slice(0, limit);
  const openItem = words.item ? services.repository.getItem(words.item) : undefined;
  // Never offer a longer session than the filter actually found.
  const size: SessionSize = { kind: 'items', count: Math.min(results.length, SESSION_CAP) };

  return (
    <AppShell title="Browse">
      {/* Search, categories and the narrowing selects are one block: three
          stacked sections spaced like separate parts of the page is how the
          filters came to occupy more of it than the results did. */}
      <div className={styles.toolbar}>
        <CourseBar compact />
        <div className={styles.search}>
          <label className="visually-hidden" htmlFor="browse-search">
            Search Spanish or English
          </label>
          <input
            id="browse-search"
            type="search"
            className={styles.input}
            value={search}
            placeholder="Search a word or phrase…"
            onChange={(event) => {
              setSearch(event.target.value);
              setLimit(PAGE_SIZE);
            }}
          />
          <VoiceInput
            label="Search by voice"
            locale={preferences.pronunciationLocale}
            onResult={(text) => {
              setSearch(text);
              setLimit(PAGE_SIZE);
            }}
          />
        </div>

        <CategoryPicker
          topics={topics}
          selected={topic === 'all' ? [] : [topic]}
          // Browse filters by one category at a time, so pressing a tile
          // replaces the selection — and pressing the selected one clears it,
          // which is how the picker undoes itself without reaching for the
          // neighbouring select.
          onToggle={(next) => {
            setTopic(next === topic ? 'all' : next);
            setLimit(PAGE_SIZE);
          }}
          action={
            <label className={`${styles.filter} ${styles.topic}`}>
              <span className="visually-hidden">Topic</span>
              <select
                value={topic}
                onChange={(event) => {
                  setTopic(event.target.value);
                  setLimit(PAGE_SIZE);
                }}
              >
                <option value="all">Any topic</option>
                {/* Registry order, matching the picker. Sorting by slug put
                  "Telling the time" between "In town" and "Clothes" — an order
                  that only made sense before the labels existed. */}
                {topics
                  .filter((option) => option.count > 0)
                  .map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
              </select>
            </label>
          }
        />

        <div className={styles.filters}>
          <label className={styles.filter}>
            <span className="visually-hidden">Type</span>
            <select value={type} onChange={(event) => setType(event.target.value as ItemType)}>
              {TYPES.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.filter}>
            <span className="visually-hidden">Register</span>
            <select
              value={register}
              onChange={(event) => setRegister(event.target.value as Register | 'all')}
            >
              <option value="all">Any register</option>
              {REGISTERS.map((option) => (
                <option key={option} value={option}>
                  {option === 'colloquial' ? 'casual' : option}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.filter}>
            <span className="visually-hidden">Region</span>
            <select value={region} onChange={(event) => setRegion(event.target.value)}>
              {/* Region-neutral content always passes, so this narrows rather
                than excludes: it drops what is not said where you are aiming. */}
              <option value="all">Anywhere</option>
              {FILTERABLE_REGIONS.map((option) => (
                <option key={option.locale} value={option.locale}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <p className={styles.count} role="status">
        {results.length} {results.length === 1 ? 'item' : 'items'}
      </p>

      <ul className={styles.results}>
        {shown.map((item) => {
          const translation = services.repository.translationOf(
            item.id,
            preferences.referenceLanguage,
          );
          return (
            <li key={item.id} className={styles.result}>
              {/* Tappable here too. Browse is where you come to look something
                  up, so it was the worst place in the app not to be able to
                  ask what a word in the result means. */}
              <TokenizedText
                item={item}
                className={styles.target}
                onSelect={(token) => words.open(item.id, token)}
                selected={words.tokensFor(item.id)}
                contextLabel={item.text}
              />
              {translation && <span className={styles.meaning}>{translation.text}</span>}
              <span className={styles.meta}>
                {item.level?.toUpperCase()}
                {item.topics?.length ? ` · ${item.topics.map(labelFor).join(', ')}` : ''}
              </span>
              <UsageBadges
                compact
                register={item.register}
                address={item.address}
                regions={item.regions}
              />
            </li>
          );
        })}
      </ul>

      {results.length === 0 && (
        <p className={styles.empty}>Nothing matches that yet. Try a shorter search.</p>
      )}

      {shown.length < results.length && (
        <Button block onClick={() => setLimit((current) => current + PAGE_SIZE)}>
          Show more
        </Button>
      )}

      {openItem && (
        <WordInfoSheet
          item={openItem}
          tokenIds={words.tokens}
          onChange={words.set}
          onClose={words.close}
        />
      )}

      {results.length > 0 && (
        <div className={styles.actions}>
          <Button
            variant="primary"
            block
            large
            onClick={() => void navigate(sessionPath(course, { preset: 'quick', size, filter }))}
          >
            Practise these
          </Button>
          <Button
            block
            onClick={() =>
              void navigate(sessionPath(course, { preset: 'flashcards', size, filter }))
            }
          >
            Study these
          </Button>
        </div>
      )}
    </AppShell>
  );
}
