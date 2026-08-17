import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useServices } from '../../app/services-context';
import { AppShell } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { VoiceInput } from '../../components/VoiceInput';
import { CEFR_LEVELS, type CefrLevel, type ItemType } from '../../domain/content';
import styles from './BrowseScreen.module.css';

const TYPES: readonly { id: ItemType | 'all'; label: string }[] = [
  { id: 'all', label: 'Everything' },
  { id: 'word', label: 'Words' },
  { id: 'phrase', label: 'Phrases' },
  { id: 'sentence', label: 'Sentences' },
];

const PAGE_SIZE = 40;

/**
 * Free browsing of the whole pack — the "study mode" half of spec §4.2, and
 * the place to look something up rather than practise it.
 */
export function BrowseScreen() {
  const { services, preferences } = useServices();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [type, setType] = useState<ItemType | 'all'>('all');
  const [level, setLevel] = useState<CefrLevel | 'all'>('all');
  const [topic, setTopic] = useState('all');
  const [limit, setLimit] = useState(PAGE_SIZE);

  const facets = useMemo(() => services.repository.facets(), [services.repository]);

  const results = useMemo(
    () =>
      services.repository.query({
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(type === 'all' ? {} : { types: [type] }),
        ...(level === 'all' ? {} : { levels: [level] }),
        ...(topic === 'all' ? {} : { topics: [topic] }),
      }),
    [services.repository, search, type, level, topic],
  );

  const shown = results.slice(0, limit);

  return (
    <AppShell title="Browse">
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
          <span className="visually-hidden">Level</span>
          <select value={level} onChange={(event) => setLevel(event.target.value as CefrLevel)}>
            <option value="all">Any level</option>
            {CEFR_LEVELS.filter((option) => facets.levels.includes(option)).map((option) => (
              <option key={option} value={option}>
                {option.toUpperCase()}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.filter}>
          <span className="visually-hidden">Topic</span>
          <select value={topic} onChange={(event) => setTopic(event.target.value)}>
            <option value="all">Any topic</option>
            {facets.topics.map((option) => (
              <option key={option} value={option}>
                {option.replace(/-/g, ' ')}
              </option>
            ))}
          </select>
        </label>
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
              <span className={styles.target} lang="es">
                {item.text}
              </span>
              {translation && <span className={styles.meaning}>{translation.text}</span>}
              <span className={styles.meta}>
                {item.level?.toUpperCase()}
                {item.topics?.length ? ` · ${item.topics.join(', ').replace(/-/g, ' ')}` : ''}
              </span>
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

      {results.length > 0 && (
        <Button
          variant="primary"
          block
          large
          onClick={() =>
            void navigate(
              `/session?preset=flashcards&size=items:20${topic === 'all' ? '' : `&topic=${topic}`}`,
            )
          }
        >
          Practise these
        </Button>
      )}
    </AppShell>
  );
}
