/**
 * The session URL is a session's only source of truth: a link must survive a
 * reload, a share and an agent driving it, and replan to the same set.
 *
 * Both directions live here on purpose. Previously the screen parsed three
 * parameters while callers appended others, so a link could carry a filter that
 * nothing read — "Practise these" practised the whole pack. A caller that
 * cannot spell a parameter by hand cannot reintroduce that.
 *
 * Unrecognised values are dropped rather than rejected: a stale or hand-typed
 * link degrades to a broader session, which is recoverable, instead of an empty
 * one, which looks like a broken app.
 */

import {
  CEFR_LEVELS,
  coursePath,
  initialLetter,
  ITEM_TYPES,
  posFromSlug,
  posSlug,
  REGISTERS,
  SENTENCE_MOODS,
  type CefrLevel,
  type Course,
  type ItemFilter,
  type ItemType,
  type LanguageTag,
  type PartOfSpeech,
  type Register,
  type SentenceMood,
} from '../../domain/content';
import {
  ORDERINGS,
  SESSION_FOCUSES,
  type Ordering,
  type SessionFocus,
  type SessionSize,
} from '../../domain/sessions';
import { formatSize, isPresetId, parseSize, type PresetId } from './presets';

/**
 * A session as the URL can express it. `filter` is the faceted narrowing a
 * learner picked; `passage` is resolved to item ids by the screen, which is the
 * only part that needs the repository.
 */
export interface SessionUrl {
  readonly preset: PresetId;
  readonly size: SessionSize;
  readonly filter: ItemFilter;
  /** Passage *local* id, e.g. `mercado`; scopes the session to its sentences. */
  readonly passage?: string;
  /**
   * A batch the learner assembled, by id; scopes the session to its items.
   *
   * The id rather than the items, for the reason {@link writeItemFilter} gives
   * about `ids`: thirty item ids in a query string is not a link, and three
   * hundred is not even a URL. Resolved by the screen against the stored
   * batches, exactly as `passage` is resolved against the repository — and, like
   * a passage, an id nothing knows about widens the session rather than emptying
   * it.
   */
  readonly batch?: string;
  /** Mission to continue after this practice set completes. */
  readonly mission?: string;
  /**
   * Skill *local* ids, e.g. `preterite` — "practise the past tense".
   *
   * Local rather than full ids for the reason {@link ContentRepository.skillByLocalId}
   * records, and outside `filter` for the reason `passage` is: resolving one
   * needs the repository, and this module deliberately parses without it.
   */
  readonly skills?: readonly string[];
  readonly dueOnly?: boolean;
  /** Which items to lead with. Absent means the planner's balanced default. */
  readonly focus?: SessionFocus;
  readonly ordering?: Ordering;
  /** Set for a reproducible session — the same link plans the same set. */
  readonly seed?: number;
}

export type SessionUrlInput = Partial<SessionUrl> & { readonly preset: PresetId };

/**
 * Builds `/<language>/<level>/session?…`. The inverse of {@link parseSessionUrl}
 * plus the course the session belongs to.
 *
 * The course is a separate argument rather than another field of the input
 * because it is not part of the query at all: it is the path a session hangs
 * off, every caller already knows it from `useCourse`, and taking it positionally
 * means a caller cannot forget it and silently practise another language's
 * content.
 */
export function sessionPath(course: Course, input: SessionUrlInput): string {
  const params = new URLSearchParams();
  params.set('preset', input.preset);
  params.set('size', formatSize(input.size ?? { kind: 'items', count: 10 }));

  writeItemFilter(params, input.filter ?? {});

  if (input.passage) params.set('passage', input.passage);
  if (input.batch) params.set('batch', input.batch);
  if (input.mission) params.set('mission', input.mission);
  if (input.skills?.length) params.set('skill', input.skills.join(','));
  if (input.dueOnly) params.set('due', '1');
  if (input.focus && input.focus !== 'balanced') params.set('focus', input.focus);
  if (input.ordering) params.set('order', input.ordering);
  if (input.seed !== undefined) params.set('seed', String(input.seed));

  return `${coursePath(course, 'session')}?${params.toString()}`;
}

export function parseSessionUrl(params: URLSearchParams): SessionUrl {
  const preset = params.get('preset');
  const passage = params.get('passage');
  const batch = params.get('batch');
  const mission = params.get('mission');
  const focus = params.get('focus');
  const ordering = params.get('order');
  const seed = Number(params.get('seed'));

  // Not validated against the loaded packs — that needs the repository, and an
  // unknown slug resolving to nothing is the same "degrade to broader, never
  // empty" outcome the rest of this module is built on.
  const skills = slugs(params.get('skill'));

  return {
    preset: isPresetId(preset) ? preset : 'quick',
    size: parseSize(params.get('size')),
    filter: parseItemFilter(params),
    ...(passage ? { passage } : {}),
    ...(batch ? { batch } : {}),
    ...(mission ? { mission } : {}),
    ...(skills.length ? { skills } : {}),
    ...(isTruthy(params.get('due')) ? { dueOnly: true } : {}),
    ...(isFocus(focus) ? { focus } : {}),
    ...(isOrdering(ordering) ? { ordering } : {}),
    ...(params.has('seed') && Number.isFinite(seed) ? { seed } : {}),
  };
}

/**
 * Writes the faceted narrowing into a query string, and {@link parseItemFilter}
 * reads it back.
 *
 * Exported as a pair because a session link is not the only thing that carries a
 * filter: Browse is a view of the same facets, and if it spelled them itself
 * then `?pos=verb` would mean one thing in a session and another in a sheet, or
 * one of the two would grow a facet the other could not read. The same argument
 * that keeps `sessionPath` and `parseSessionUrl` in one file, one level down.
 *
 * `ids` is deliberately absent: it is an allow-list resolved from a passage, not
 * something a learner picks, and spelling five hundred item ids into a URL is
 * not a link anyone can share.
 */
export function writeItemFilter(params: URLSearchParams, filter: ItemFilter): void {
  if (filter.search) params.set('q', filter.search);
  if (filter.types?.length) params.set('type', filter.types.join(','));
  if (filter.pos?.length) params.set('pos', filter.pos.map(posSlug).join(','));
  if (filter.levels?.length) params.set('level', filter.levels.join(','));
  if (filter.topics?.length) params.set('topic', filter.topics.join(','));
  if (filter.registers?.length) params.set('register', filter.registers.join(','));
  if (filter.moods?.length) params.set('mood', filter.moods.join(','));
  if (filter.usableIn) params.set('region', filter.usableIn);
  if (filter.initial) params.set('initial', filter.initial);
}

export function parseItemFilter(params: URLSearchParams): ItemFilter {
  const search = params.get('q')?.trim();
  const types = list(params.get('type'), ITEM_TYPES as readonly ItemType[]);
  // Several on purpose — `?pos=verb,noun` is a batch of word kinds, and the
  // repository ORs them exactly as it does types.
  const pos = parts(params.get('pos'));
  const levels = list(params.get('level'), CEFR_LEVELS as readonly CefrLevel[]);
  const registers = list(params.get('register'), REGISTERS as readonly Register[]);
  // `?mood=question` — a form, and a narrowing like any other, so it travels
  // into a session link. Several are allowed for symmetry with the rest, even
  // though asking *and* telling is the same as neither.
  const moods = list(params.get('mood'), SENTENCE_MOODS as readonly SentenceMood[]);
  const topics = slugs(params.get('topic'));
  const usableIn = region(params.get('region'));
  // Normalised rather than validated: `initial=c` is a letter, and so is
  // `initial=café` in the only sense this filter has, so both plan the C's
  // instead of one of them planning nothing.
  const initial = params.get('initial')?.trim();

  return {
    ...(search ? { search } : {}),
    ...(initial ? { initial: initialLetter(initial) } : {}),
    ...(types.length ? { types } : {}),
    ...(pos.length ? { pos } : {}),
    ...(levels.length ? { levels } : {}),
    ...(registers.length ? { registers } : {}),
    ...(moods.length ? { moods } : {}),
    ...(topics.length ? { topics } : {}),
    ...(usableIn ? { usableIn } : {}),
  };
}

/**
 * Comma-separated content slugs — topics and skills — which are pack vocabulary
 * rather than domain enums, so there is no `allowed` list to check them against.
 * `all` is dropped as the same "no constraint" spelling the level scope uses.
 */
function slugs(value: string | null): readonly string[] {
  const seen = new Set<string>();
  for (const part of (value ?? '').split(',')) {
    const slug = part.trim();
    if (slug.length > 0 && slug !== 'all') seen.add(slug);
  }
  return [...seen];
}

/** Comma-separated values, keeping only those the domain recognises. */
function list<T extends string>(value: string | null, allowed: readonly T[]): readonly T[] {
  if (!value) return [];
  const seen = new Set<T>();
  for (const part of value.split(',')) {
    const candidate = part.trim().toLowerCase();
    const match = allowed.find((option) => option === candidate);
    if (match) seen.add(match);
  }
  return [...seen];
}

/**
 * Comma-separated word kinds. Separate from {@link list} because the spelling in
 * a link is not the spelling in the model — `verb` for `VERB` — and `posFromSlug`
 * owns that translation rather than a lowercase comparison here.
 */
function parts(value: string | null): readonly PartOfSpeech[] {
  if (!value) return [];
  const seen = new Set<PartOfSpeech>();
  for (const part of value.split(',')) {
    const match = posFromSlug(part);
    if (match) seen.add(match);
  }
  return [...seen];
}

function isFocus(value: string | null): value is SessionFocus {
  // `balanced` is never written, so reading it back is a no-op either way.
  return value !== null && (SESSION_FOCUSES as readonly string[]).includes(value);
}

function isOrdering(value: string | null): value is Ordering {
  return value !== null && (ORDERINGS as readonly string[]).includes(value);
}

/**
 * A region a learner is aiming at, canonicalised rather than checked off a list.
 *
 * It was checked against `FILTERABLE_REGIONS` until 2026-08-25 — five Spanish
 * locales — which left a *pack* vocabulary policed by a *Spanish* constant, so
 * `?region=en-GB` was dropped from an English course's link without a word. That
 * is what `slugs` above exists to avoid for topics and skills, and the opposite
 * of what `initial` documents doing three fields up. `region` belongs with them:
 * which accents exist is the pack's business, not this file's.
 *
 * A value no pack declares cannot empty a session. Content with no regions is
 * usable everywhere and always passes `isUsableIn`, so a stale or invented tag
 * narrows to the region-neutral material rather than to nothing.
 *
 * The fuller answer, if that ever stops being good enough, is the one skills
 * already use: parse the tag here and let the screen drop what no loaded pack
 * declares, since it is the screen that holds the repository. That is a bigger
 * change than the bug warranted.
 *
 * The casing is BCP 47's rather than the learner's, because `regionCovers`
 * compares tags exactly: a hand-typed `es-es` has to reach the `es-ES` the
 * content declares, and `zh-hant` the `zh-Hant` a future pack will.
 */
const REGION_TAG = /^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i;

function region(value: string | null): LanguageTag | undefined {
  const tag = value?.trim();
  if (!tag || !REGION_TAG.test(tag)) return undefined;
  const [language, ...subtags] = tag.split('-');
  return [language!.toLowerCase(), ...subtags.map(subtag)].join('-');
}

/** Region subtags are upper case, scripts are title case, everything else lower. */
function subtag(value: string): string {
  const lower = value.toLowerCase();
  if (/^[a-z]{2}$/.test(lower)) return lower.toUpperCase();
  if (/^[a-z]{4}$/.test(lower)) return lower[0]!.toUpperCase() + lower.slice(1);
  return lower;
}

/** `due=1`, `due=true` and a bare `due` all mean the same thing to a human. */
function isTruthy(value: string | null): boolean {
  return value !== null && value !== '0' && value !== 'false';
}
