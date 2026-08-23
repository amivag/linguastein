/**
 * Study's sections, and their addresses.
 *
 * The screen was one column of everything: seven missions, three word kinds,
 * three sheets, twenty-six grammar patterns and thirty-five categories — about
 * seventy rows, which is a page you scroll past rather than read. They are
 * sections you switch between now, and the open one lives in the query string
 * for the reason Browse's filters do: a sheet of grammar patterns is a thing you
 * link someone to.
 *
 * Both directions live here so a section cannot be written that the screen does
 * not read — the split `session-url.ts` exists to enforce.
 */

import { coursePath, type Course } from '../../domain/content';

export const STUDY_TABS = [
  'missions',
  'batches',
  'words',
  'phrases',
  'grammar',
  'abilities',
  'categories',
] as const;
export type StudyTab = (typeof STUDY_TABS)[number];

export function isStudyTab(value: string | null | undefined): value is StudyTab {
  return value !== null && value !== undefined && (STUDY_TABS as readonly string[]).includes(value);
}

/**
 * The section a URL asks for, or `undefined` for "wherever this course starts".
 *
 * Unresolved on purpose. Which sections exist is a property of the packs — a
 * course with no authored missions has no Missions section, and one whose pack
 * grows adverbs gains a word kind — so the *default* is data and cannot be
 * decided here. The screen picks the first section it actually has, which is
 * also what an unrecognised name degrades to.
 */
export function parseStudyTab(params: URLSearchParams): StudyTab | undefined {
  const tab = params.get('tab');
  return isStudyTab(tab) ? tab : undefined;
}

/**
 * `/es/a1/study?tab=grammar`.
 *
 * Every tab is written out, including the one the screen happens to open first —
 * unlike Browse's sort or Settings' default section, which are omitted. The
 * difference is that those defaults are constants and this one is not: leaving it
 * unsaid would make the same link mean Missions in one course and Words in
 * another, which is exactly what a shared link must not do.
 */
export function studyPath(course: Course, tab?: StudyTab): string {
  const base = coursePath(course, 'study');
  return tab ? `${base}?tab=${tab}` : base;
}
