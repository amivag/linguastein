/**
 * Browse's URL, both directions in one module — the shape `session-url.ts` uses,
 * and for the same reason: a screen that reads a parameter nothing writes, or
 * writes one nothing reads, is the bug that costs an afternoon to find.
 *
 * The facet spelling itself is not ours. It comes from `writeItemFilter` and
 * `parseItemFilter`, so `?pos=verb` means one thing whether it appears in a
 * sheet's address or a session's. What belongs here is only what Browse adds on
 * top: the sort, which is the list's own business and never travels into a
 * session link.
 */

import {
  coursePath,
  ITEM_SORTS,
  type Course,
  type ItemFilter,
  type ItemSort,
} from '../../domain/content';
import { parseItemFilter, writeItemFilter } from '../practice/session-url';

export interface BrowseUrl {
  readonly filter: ItemFilter;
  readonly sort: ItemSort;
}

/**
 * Builds `/<language>/<level>/browse?…` — the address of one study sheet.
 *
 * The course comes first and positionally for the reason `sessionPath` takes it
 * that way: it is the path the sheet hangs off rather than part of the query, and
 * a caller that cannot forget it cannot show another language's content.
 */
export function browsePath(course: Course, url: Partial<BrowseUrl> = {}): string {
  const params = new URLSearchParams();
  writeItemFilter(params, url.filter ?? {});
  // Pack order is the default, so it is left unsaid — a link a human might read
  // should not spell out the thing that was not chosen.
  if (url.sort && url.sort !== 'pack') params.set('sort', url.sort);

  const query = params.toString();
  return query ? `${coursePath(course, 'browse')}?${query}` : coursePath(course, 'browse');
}

export function parseBrowseUrl(params: URLSearchParams): BrowseUrl {
  const sort = params.get('sort');
  return {
    filter: parseItemFilter(params),
    // Unrecognised widens to the default rather than erroring, as everywhere
    // else: a stale link should show the sheet, not a broken screen.
    sort: isItemSort(sort) ? sort : 'pack',
  };
}

export function isItemSort(value: string | null | undefined): value is ItemSort {
  return value !== null && value !== undefined && (ITEM_SORTS as readonly string[]).includes(value);
}
