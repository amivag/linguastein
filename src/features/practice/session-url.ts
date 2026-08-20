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
  FILTERABLE_REGIONS,
  ITEM_TYPES,
  posFromSlug,
  posSlug,
  REGISTERS,
  type CefrLevel,
  type Course,
  type ItemFilter,
  type ItemType,
  type LanguageTag,
  type PartOfSpeech,
  type Register,
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

  const filter = input.filter ?? {};
  if (filter.search) params.set('q', filter.search);
  if (filter.types?.length) params.set('type', filter.types.join(','));
  if (filter.pos?.length) params.set('pos', filter.pos.map(posSlug).join(','));
  if (filter.levels?.length) params.set('level', filter.levels.join(','));
  if (filter.topics?.length) params.set('topic', filter.topics.join(','));
  if (filter.registers?.length) params.set('register', filter.registers.join(','));
  if (filter.usableIn) params.set('region', filter.usableIn);

  if (input.passage) params.set('passage', input.passage);
  if (input.dueOnly) params.set('due', '1');
  if (input.focus && input.focus !== 'balanced') params.set('focus', input.focus);
  if (input.ordering) params.set('order', input.ordering);
  if (input.seed !== undefined) params.set('seed', String(input.seed));

  return `${coursePath(course, 'session')}?${params.toString()}`;
}

export function parseSessionUrl(params: URLSearchParams): SessionUrl {
  const preset = params.get('preset');
  const passage = params.get('passage');
  const focus = params.get('focus');
  const ordering = params.get('order');
  const seed = Number(params.get('seed'));

  return {
    preset: isPresetId(preset) ? preset : 'quick',
    size: parseSize(params.get('size')),
    filter: parseFilter(params),
    ...(passage ? { passage } : {}),
    ...(isTruthy(params.get('due')) ? { dueOnly: true } : {}),
    ...(isFocus(focus) ? { focus } : {}),
    ...(isOrdering(ordering) ? { ordering } : {}),
    ...(params.has('seed') && Number.isFinite(seed) ? { seed } : {}),
  };
}

function parseFilter(params: URLSearchParams): ItemFilter {
  const search = params.get('q')?.trim();
  const types = list(params.get('type'), ITEM_TYPES as readonly ItemType[]);
  // Several on purpose — `?pos=verb,noun` is a batch of word kinds, and the
  // repository ORs them exactly as it does types.
  const pos = parts(params.get('pos'));
  const levels = list(params.get('level'), CEFR_LEVELS as readonly CefrLevel[]);
  const registers = list(params.get('register'), REGISTERS as readonly Register[]);
  const topics = (params.get('topic') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0 && value !== 'all');
  const region = params.get('region');

  return {
    ...(search ? { search } : {}),
    ...(types.length ? { types } : {}),
    ...(pos.length ? { pos } : {}),
    ...(levels.length ? { levels } : {}),
    ...(registers.length ? { registers } : {}),
    ...(topics.length ? { topics } : {}),
    ...(isRegion(region) ? { usableIn: region } : {}),
  };
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

function isRegion(value: string | null): value is LanguageTag {
  return value !== null && FILTERABLE_REGIONS.some((option) => option.locale === value);
}

/** `due=1`, `due=true` and a bare `due` all mean the same thing to a human. */
function isTruthy(value: string | null): boolean {
  return value !== null && value !== '0' && value !== 'false';
}
