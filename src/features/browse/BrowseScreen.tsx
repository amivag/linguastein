import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useServices } from '../../app/services-context';
import { AppShell } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { UsageBadges } from '../../components/UsageBadges';
import { VoiceInput } from '../../components/VoiceInput';
import {
  CEFR_LEVELS,
  PRONUNCIATION_LOCALES,
  REGISTERS,
  type CefrLevel,
  type ItemType,
  type Register,
} from '../../domain/content';
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
  const [register, setRegister] = useState<Register | 'all'>('all');
  const [region, setRegion] = useState('all');
  const [limit, setLimit] = useState(PAGE_SIZE);

  const facets = useMemo(() => services.repository.facets(), [services.repository]);

  const results = useMemo(
    () =>
      services.repository.query({
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(type === 'all' ? {} : { types: [type] }),
        ...(level === 'all' ? {} : { levels: [level] }),
        ...(topic === 'all' ? {} : { topics: [topic] }),
        ...(register === 'all' ? {} : { registers: [register] }),
        ...(region === 'all' ? {} : { usableIn: region }),
      }),
    [services.repository, search, type, level, topic, register, region],
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
            <option value="es-419">Latin America</option>
            {PRONUNCIATION_LOCALES.map((option) => (
              <option key={option.locale} value={option.locale}>
                {option.label}
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
