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
  FILTERABLE_REGIONS,
  ITEM_TYPES,
  REGISTERS,
  type CefrLevel,
  type ItemFilter,
  type ItemType,
  type LanguageTag,
  type Register,
} from '../../domain/content';
import { ORDERINGS, type Ordering, type SessionSize } from '../../domain/sessions';
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
  readonly ordering?: Ordering;
  /** Set for a reproducible session — the same link plans the same set. */
  readonly seed?: number;
}

export type SessionUrlInput = Partial<SessionUrl> & { readonly preset: PresetId };

/** Builds `/session?…`. The inverse of {@link parseSessionUrl}. */
export function sessionPath(input: SessionUrlInput): string {
  const params = new URLSearchParams();
  params.set('preset', input.preset);
  params.set('size', formatSize(input.size ?? { kind: 'items', count: 10 }));

  const filter = input.filter ?? {};
  if (filter.search) params.set('q', filter.search);
  if (filter.types?.length) params.set('type', filter.types.join(','));
  if (filter.levels?.length) params.set('level', filter.levels.join(','));
  if (filter.topics?.length) params.set('topic', filter.topics.join(','));
  if (filter.registers?.length) params.set('register', filter.registers.join(','));
  if (filter.usableIn) params.set('region', filter.usableIn);

  if (input.passage) params.set('passage', input.passage);
  if (input.dueOnly) params.set('due', '1');
  if (input.ordering) params.set('order', input.ordering);
  if (input.seed !== undefined) params.set('seed', String(input.seed));

  return `/session?${params.toString()}`;
}

export function parseSessionUrl(params: URLSearchParams): SessionUrl {
  const preset = params.get('preset');
  const passage = params.get('passage');
  const ordering = params.get('order');
  const seed = Number(params.get('seed'));

  return {
    preset: isPresetId(preset) ? preset : 'quick',
    size: parseSize(params.get('size')),
    filter: parseFilter(params),
    ...(passage ? { passage } : {}),
    ...(isTruthy(params.get('due')) ? { dueOnly: true } : {}),
    ...(isOrdering(ordering) ? { ordering } : {}),
    ...(params.has('seed') && Number.isFinite(seed) ? { seed } : {}),
  };
}

function parseFilter(params: URLSearchParams): ItemFilter {
  const search = params.get('q')?.trim();
  const types = list(params.get('type'), ITEM_TYPES as readonly ItemType[]);
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
