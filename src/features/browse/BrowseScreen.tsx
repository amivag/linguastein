import { useEffect, useId, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCourse } from '../../app/course';
import { useServices } from '../../app/services-context';
import { AppShell } from '../../components/AppShell';
import { Icon } from '../../components/Icon';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { CourseBar } from '../../components/CourseBar';
import { Sheet } from '../../components/Sheet';
import { TokenizedText } from '../../components/TokenizedText';
import { UsageBadges } from '../../components/UsageBadges';
import { useWordSelection } from '../../components/useWordSelection';
import { VoiceInput } from '../../components/VoiceInput';
import { WordInfoSheet } from '../../components/WordInfoSheet';
import {
  FILTERABLE_REGIONS,
  ITEM_SORTS,
  POS_LABELS,
  REGISTER_LABELS,
  REGISTERS,
  regionLabel,
  sortItems,
  type ItemFilter,
  type ItemSort,
  type ItemType,
  type LearningItem,
  type PartOfSpeech,
  type Register,
} from '../../domain/content';
import type { SessionSize } from '../../domain/sessions';
import { sessionPath } from '../practice/session-url';
import { browsePath, parseBrowseUrl } from './browse-url';
import styles from './BrowseScreen.module.css';
import { CategoryPicker } from './CategoryPicker';
import { LetterIndex } from './LetterIndex';

const TYPES: readonly { id: ItemType | 'all'; label: string }[] = [
  { id: 'all', label: 'Everything' },
  { id: 'word', label: 'Words' },
  { id: 'phrase', label: 'Phrases' },
  { id: 'sentence', label: 'Sentences' },
];

/**
 * How the list can be ordered. The pack's own order is the default, because it
 * is a teaching order — the first words a beginner meets come first — and
 * alphabetical order is a way of *finding* something, not of being taught it.
 */
const SORT_LABELS: Record<ItemSort, string> = {
  pack: 'Pack order',
  az: 'A to Z',
  za: 'Z to A',
};

const PAGE_SIZE = 40;
/** Longest session offered from a filter, however much the filter matched. */
const SESSION_CAP = 20;

/**
 * "Verbs", "Nouns" — the plural of what the sheet calls one word.
 *
 * Derived from the singular labels rather than tabled separately: the two would
 * otherwise be able to disagree about what a `NUM` is called, and every part of
 * speech the app offers as a category pluralises with an `s`.
 */
function posLabel(pos: PartOfSpeech): string {
  const singular = POS_LABELS[pos];
  return `${singular.charAt(0).toUpperCase()}${singular.slice(1)}s`;
}

/**
 * The narrowing as the controls hold it: one value each, with `all` for "not
 * narrowed".
 *
 * A separate shape from `ItemFilter` because the two answer different questions.
 * A filter says what is in scope and is plural — a session link may ask for
 * `?pos=verb,noun`. A select says which single option is showing, and needs a
 * spelling for "none of them" that a filter expresses by absence.
 */
interface Facets {
  readonly search: string;
  readonly type: ItemType | 'all';
  readonly pos: PartOfSpeech | 'all';
  readonly topic: string;
  readonly registers: readonly Register[];
  readonly region: string;
  readonly initial: string;
  readonly sort: ItemSort;
}

/**
 * One filter object drives the list, the query string and the session link, so
 * what a learner sees is exactly what "Practise these" practises.
 *
 * The course scope is deliberately not folded in: it is carried by the path
 * rather than the query, and duplicating it would write `?level=a1` into every
 * link the screen produces. Nor is `sort` — which items there are is the
 * filter's answer, and what order they are dealt in is the list's own business.
 */
/** Adds or removes one value — what pressing a multi-select chip means. */
function toggle<T>(values: readonly T[], value: T): readonly T[] {
  return values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];
}

function filterOf(facets: Facets): ItemFilter {
  return {
    ...(facets.search.trim() ? { search: facets.search.trim() } : {}),
    ...(facets.type === 'all' ? {} : { types: [facets.type] }),
    ...(facets.pos === 'all' ? {} : { pos: [facets.pos] }),
    ...(facets.topic === 'all' ? {} : { topics: [facets.topic] }),
    ...(facets.registers.length ? { registers: facets.registers } : {}),
    ...(facets.region === 'all' ? {} : { usableIn: facets.region }),
    ...(facets.initial ? { initial: facets.initial } : {}),
  };
}

/**
 * Free browsing of the whole pack — the "study mode" half of spec §4.2, and
 * the place to look something up rather than practise it.
 */
export function BrowseScreen() {
  const { services, preferences } = useServices();
  const { course, filter: courseScope, path } = useCourse();
  const navigate = useNavigate();

  const [params, setParams] = useSearchParams();

  /**
   * The query string is what the sheet is showing, exactly as it is for a
   * session. These were `useState`, which made a filtered sheet the one thing in
   * the app you could not link to: no bookmarking "the nouns", no sharing it, no
   * agent driving it, and a reload dropped you back to the whole pack. It also
   * meant Home could not offer a category as a destination, because there was no
   * address to send anyone to.
   *
   * Read through the same pair a session link uses, so `?pos=verb` cannot come
   * to mean two things.
   */
  const { filter, sort } = useMemo(() => parseBrowseUrl(params), [params]);

  // The selects are single-choice; the filter is plural because a link may carry
  // `?pos=verb,noun`. Reading the first value keeps a hand-written batch working
  // — the sheet lists all of it, and the control shows the first of them —
  // rather than dropping what it cannot display.
  const search = filter.search ?? '';
  const type = filter.types?.[0] ?? 'all';
  const pos = filter.pos?.[0] ?? 'all';
  const topic = filter.topics?.[0] ?? 'all';
  const registers = filter.registers ?? [];
  const region = filter.usableIn ?? 'all';
  const initial = filter.initial ?? '';

  // Pagination is not part of the address: "show me 80 of them" is a thing you
  // did to this list, not a thing the link means, and it resets whenever the
  // filter changes anyway.
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterSheetId = useId();

  const facets: Facets = { search, type, pos, topic, registers, region, initial, sort };

  /**
   * Rewrites the query and starts the list from the top again.
   *
   * `replace` rather than `push`: typing four letters into the search box must
   * not put four entries in the history for Back to walk out of one at a time.
   */
  const update = (patch: Partial<Facets>) => {
    const next = { ...facets, ...patch };
    // Through `browsePath` rather than assembled here, so the sheet's own links
    // and the ones Study builds cannot come to disagree.
    setParams(browsePath(course, { filter: filterOf(next), sort: next.sort }).split('?')[1] ?? '', {
      replace: true,
    });
    setLimit(PAGE_SIZE);
  };
  const words = useWordSelection();
  const locale = preferences.pronunciationLocale;

  // Voice discovery is asynchronous, so what can be heard is re-read once the
  // provider is ready rather than assumed on the first render — the approach
  // `AudioControls` takes, for the same reason.
  const [voicesReady, setVoicesReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void services.audio.ready().then(() => {
      if (!cancelled) setVoicesReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [services.audio]);

  // Leaving the screen must not leave a word still talking.
  useEffect(() => () => services.audio.stop(), [services.audio]);

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
  // Which word kinds the loaded packs actually have something for, counted over
  // the course for the same reason the categories are: an option that would lead
  // nowhere should not be offered, and a pack that grows adverbs gets the
  // category with no code change.
  const wordKinds = useMemo(
    () => services.repository.partsOfSpeech(courseScope),
    [services.repository, courseScope],
  );
  // The letters the course has content under, collated in the language being
  // studied rather than in the browser's own.
  const letters = useMemo(
    () => services.repository.initials(courseScope, course.language),
    [services.repository, courseScope, course.language],
  );
  /**
   * How many items each style and each region actually has, counted over the
   * course like every other facet on this screen.
   *
   * A count is what makes a chip a decision rather than a label. It also tells
   * the truth about a filter that cannot bite: a region with no content marked
   * for it is dropped entirely, and a style with none reads `0` rather than
   * looking like a live option.
   */
  const registerFacets = useMemo(
    () =>
      REGISTERS.map((value) => ({
        value,
        label: REGISTER_LABELS[value],
        count: services.repository.query({ ...courseScope, registers: [value] }).length,
      })),
    [services.repository, courseScope],
  );
  const regions = useMemo(
    () =>
      services.repository
        .regions(
          courseScope,
          FILTERABLE_REGIONS.map((option) => option.locale),
        )
        .map((facet) => ({
          ...facet,
          label:
            FILTERABLE_REGIONS.find((option) => option.locale === facet.locale)?.label ??
            regionLabel(facet.locale),
        })),
    [services.repository, courseScope],
  );

  const labelFor = (id: string) => topicLabels.get(id) ?? id.replace(/-/g, ' ');

  const activeFilterCount =
    Number(type !== 'all') +
    Number(pos !== 'all') +
    Number(initial !== '') +
    Number(topic !== 'all') +
    registers.length +
    Number(region !== 'all');
  const filterSummary = [
    type === 'all' ? undefined : TYPES.find((option) => option.id === type)?.label,
    pos === 'all' ? undefined : posLabel(pos),
    initial === '' ? undefined : initial === '#' ? 'Other initials' : `Starts with ${initial}`,
    topic === 'all' ? undefined : labelFor(topic),
    ...registers.map((value) => REGISTER_LABELS[value]),
    region === 'all'
      ? undefined
      : (regions.find((option) => option.locale === region)?.label ?? regionLabel(region)),
  ]
    .filter((value): value is string => value !== undefined)
    .join(' · ');

  const clearFilters = () => {
    update({ type: 'all', pos: 'all', initial: '', topic: 'all', registers: [], region: 'all' });
  };

  // Sorting is the list's business and not the session's: which items "Practise
  // these" plans is the filter's answer, and what order it deals them in is
  // `ordering`, which a session has to be asked for. So the sort stays here
  // rather than being written into the link.
  const results = useMemo(
    () =>
      sortItems(services.repository.query({ ...courseScope, ...filter }), sort, course.language),
    [services.repository, courseScope, filter, sort, course.language],
  );

  const shown = results.slice(0, limit);
  const openItem = words.item ? services.repository.getItem(words.item) : undefined;

  // `play` rather than `speak`: the pack's own recording of an item beats the
  // device reading its text, and the audio service already knows to prefer one
  // over the other. It stops whatever was playing first, so tapping down a list
  // does not stack four voices.
  const play = (item: LearningItem) =>
    void services.audio.play(item, {
      locale,
      ...(preferences.voiceName ? { voice: preferences.voiceName } : {}),
    });
  // Never offer a longer session than the filter actually found.
  const size: SessionSize = { kind: 'items', count: Math.min(results.length, SESSION_CAP) };

  return (
    // Back to Study rather than to history: a sheet is reached from there, and
    // a learner who followed three category tiles should not have to tap Back
    // three times to leave.
    <AppShell title="Browse" onBack={() => void navigate(path('study'))}>
      {/* Search stays ready to use. Every deliberate narrowing choice lives in
          one overlay so results remain visible and the page never has nested
          scroll regions. */}
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
              update({ search: event.target.value });
            }}
          />
          <VoiceInput
            label="Search by voice"
            locale={preferences.pronunciationLocale}
            onResult={(text) => {
              update({ search: text });
            }}
          />
        </div>

        <Button
          block
          className={styles.filterToggle}
          aria-expanded={filtersOpen}
          aria-controls={filterSheetId}
          aria-haspopup="dialog"
          aria-label={`Filters: ${filterSummary || 'Everything'}${activeFilterCount > 0 ? `, ${activeFilterCount} active` : ''}`}
          onClick={() => setFiltersOpen(true)}
        >
          <span className={styles.filterToggleIcon}>
            <Icon name="filter" />
          </span>
          <span className={styles.filterToggleText}>
            <strong>Filters</strong>
            <small>{filterSummary || 'Everything'}</small>
          </span>
          {activeFilterCount > 0 && <span className={styles.filterCount}>{activeFilterCount}</span>}
          <Icon name="next" />
        </Button>
      </div>

      {filtersOpen && (
        <Sheet
          id={filterSheetId}
          title="Filter results"
          width="wide"
          onClose={() => setFiltersOpen(false)}
        >
          <div className={styles.filterSheet}>
            {activeFilterCount > 0 && (
              <div className={styles.filterSheetActions}>
                <Button variant="ghost" onClick={clearFilters}>
                  Clear all filters
                </Button>
              </div>
            )}

            <fieldset className={styles.filterGroup}>
              <legend>Content</legend>
              <div className={styles.filters}>
                <label className={styles.filter}>
                  <span>Type</span>
                  <select
                    value={type}
                    onChange={(event) => update({ type: event.target.value as ItemType })}
                  >
                    {TYPES.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                {wordKinds.length > 1 && (
                  <label className={styles.filter}>
                    <span>Word kind</span>
                    <select
                      value={pos}
                      onChange={(event) => {
                        update({ pos: event.target.value as PartOfSpeech | 'all' });
                      }}
                    >
                      <option value="all">Any word kind</option>
                      {wordKinds.map((option) => (
                        <option key={option.pos} value={option.pos}>
                          {posLabel(option.pos)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <label className={styles.filter}>
                  <span>Region</span>
                  <select
                    value={region}
                    onChange={(event) => update({ region: event.target.value })}
                  >
                    <option value="all">Anywhere</option>
                    {regions.map((option) => (
                      <option key={option.locale} value={option.locale}>
                        {option.label} ({option.count})
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <LetterIndex
                letters={letters}
                selected={initial}
                onToggle={(letter) => {
                  update({ initial: letter === initial ? '' : letter });
                }}
              />
            </fieldset>

            <CategoryPicker
              topics={topics}
              selected={topic === 'all' ? [] : [topic]}
              onToggle={(next) => {
                update({ topic: next === topic ? 'all' : next });
              }}
            />

            <fieldset className={styles.filterGroup}>
              <legend>Style</legend>
              <div className={styles.registers}>
                {registerFacets
                  .filter(({ value, count }) => count > 0 || registers.includes(value))
                  .map(({ value, label, count }) => (
                    <Chip
                      key={value}
                      pressed={registers.includes(value)}
                      count={count}
                      onClick={() => update({ registers: toggle(registers, value) })}
                    >
                      {label}
                    </Chip>
                  ))}
              </div>
            </fieldset>

            {activeFilterCount > 0 && (
              <Button block onClick={clearFilters}>
                Reset all filters
              </Button>
            )}
          </div>
        </Sheet>
      )}

      {/* The list's own header. Sorting sits here rather than among the filters
          because it narrows nothing — and because this line already exists, so
          the one control that only reorders costs the screen no height. The
          toolbar above it is the tallest thing on this page already; a fifth
          select would have pushed the results another row further down. */}
      <div className={styles.listBar}>
        <p className={styles.count} role="status">
          {results.length} {results.length === 1 ? 'item' : 'items'}
        </p>

        <label className={`${styles.filter} ${styles.sort}`}>
          <span className="visually-hidden">Sort</span>
          <select
            value={sort}
            onChange={(event) => update({ sort: event.target.value as ItemSort })}
          >
            {ITEM_SORTS.map((option) => (
              <option key={option} value={option}>
                {SORT_LABELS[option]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Named, like a passage's lines are: the filter sheet contains several
          lists, and "which one is the results" should not be a question a
          screen reader or an agent has to answer by elimination. */}
      <ul className={styles.results} aria-label="Results">
        {shown.map((item) => {
          const translation = services.repository.translationOf(
            item.id,
            preferences.referenceLanguage,
          );
          return (
            <li key={item.id} className={styles.result}>
              <div className={styles.body}>
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
              </div>
              {/* Hearing a word is half of knowing it, and reading a list of
                  Spanish silently is how a learner arrives at a session having
                  never heard any of it. Offered per row rather than as one
                  control for the page: nothing else says *which* word.

                  Absent rather than dead when there is nothing to play with —
                  no recording in the pack and no voice on the device — because
                  forty buttons that do nothing is worse than none. */}
              {voicesReady && services.audio.canPlay(item, locale) && (
                <button
                  type="button"
                  className={styles.play}
                  onClick={() => play(item)}
                  aria-label={`Listen to “${item.text}”`}
                >
                  <Icon name="speak" size="lg" />
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {/* Which of the two it is matters: told to shorten a search they never
          typed, a learner has no way to find out that it was Words × Verbs that
          came to nothing — the pack has verb *lexemes* in its sentences and no
          verb word cards. */}
      {results.length === 0 && (
        <p className={styles.empty}>
          <Icon name="browse" size="xl" className={styles.emptyIcon} />
          {search.trim()
            ? 'Nothing matches that yet. Try a shorter search.'
            : 'Nothing in this course matches those filters yet. Try widening one.'}
        </p>
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
