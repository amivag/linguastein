/**
 * Read's URL, both directions in one module — the shape `browse-url.ts` and
 * `session-url.ts` use, and for the same reason: a screen that reads a parameter
 * nothing writes, or writes one nothing reads, is the bug that costs an
 * afternoon to find.
 *
 * There is one thing in it and it is not a filter. Which kind of passage the
 * list is showing stays component state — "texts only" is a thing you did to
 * this list rather than a thing the link means — but the reading list is a sheet
 * *inside* Study exactly as Browse is, so it has to remember which section sent
 * it here in order to send Back there. `study-url.ts` owns that spelling.
 */

import type { Crumb } from '../../components/Breadcrumb';
import { coursePath, type Course } from '../../domain/content';
import { parseStudyOrigin, studyTrail, writeStudyOrigin, type StudyTab } from '../study/study-url';

export interface ReadUrl {
  /** The Study section this list was opened from; where Back returns to. */
  readonly from: StudyTab | undefined;
}

/** `/es/a1/read?from=phrases` — the reading list, and the way out of it. */
export function readPath(course: Course, url: Partial<ReadUrl> = {}): string {
  const params = new URLSearchParams();
  writeStudyOrigin(params, url.from);

  const query = params.toString();
  return query ? `${coursePath(course, 'read')}?${query}` : coursePath(course, 'read');
}

export function parseReadUrl(params: URLSearchParams): ReadUrl {
  return { from: parseStudyOrigin(params) };
}

/**
 * Where a text sits: `Study › Read`.
 *
 * A passage is opened from the reading list, and the list is itself a sheet
 * inside Study, so the chain is two long — which is exactly why it is built here
 * rather than typed at the screen. `PassageScreen` knows a passage; it does not
 * know that the list above it is reached through a Study section, and a second
 * copy of that fact is one that goes stale when the list moves.
 *
 * The list carries no `?from=` when it links to a text, so the section above it
 * is genuinely unknown here and the trail stops at Study rather than guessing
 * one — the rule `studyTrail` states.
 */
export function readTrail(course: Course, from?: StudyTab): readonly Crumb[] {
  return [...studyTrail(course, from), { label: 'Read', to: readPath(course, { from }) }];
}
