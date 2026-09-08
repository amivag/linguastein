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

import type { Crumb } from '../../components/Breadcrumb';
import { coursePath, type Course } from '../../domain/content';

export const STUDY_TABS = [
  'missions',
  'batches',
  'alphabet',
  'numbers',
  'words',
  'phrases',
  'grammar',
  'abilities',
  'categories',
] as const;
export type StudyTab = (typeof STUDY_TABS)[number];

/** What Study calls the screen itself, in a trail and on its own heading. */
export const STUDY_LABEL = 'Study';

/**
 * What each section is called.
 *
 * Here rather than only in the section list `StudyScreen` builds, because a
 * sheet opened *from* a section has to be able to name the section it came from
 * without rebuilding that list — a mission's header says `Study › Missions`, and
 * Missions is the same word the tab uses or the trail is lying about where Back
 * goes. `settings-url.ts` keeps its labels beside its addresses for the same
 * reason; the section list adds the icon and the count, which are the parts only
 * that screen needs.
 */
export const STUDY_TAB_LABELS: Readonly<Record<StudyTab, string>> = {
  missions: 'Missions',
  batches: 'Sets',
  alphabet: 'Alphabet',
  numbers: 'Numbers',
  words: 'Words',
  phrases: 'Phrases',
  grammar: 'Grammar',
  abilities: 'Abilities',
  categories: 'Categories',
};

/**
 * Where a screen that lives inside Study sits, as a breadcrumb.
 *
 * Missions, sheets and texts are all reached *through* Study rather than being
 * destinations of their own, and two of them — a mission and a session — hide
 * the tab bar entirely, so nothing on those screens said so. This is that fact
 * in the one shape a header can show and a learner can tap.
 *
 * The section is optional for the same reason `parseStudyOrigin` returns
 * `undefined`: a sheet reached by a stale or hand-written link does not know
 * which section sent it, and `Study` alone is still true. It is never guessed —
 * a trail that points at a section the learner was not in is worse than a short
 * one.
 */
export function studyTrail(course: Course, tab?: StudyTab): readonly Crumb[] {
  const study: Crumb = { label: STUDY_LABEL, to: studyPath(course) };
  return tab ? [study, { label: STUDY_TAB_LABELS[tab], to: studyPath(course, tab) }] : [study];
}

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

/**
 * The section a sheet was opened from — `?from=categories` on Browse or Read.
 *
 * Browse and Read are sheets *inside* Study rather than destinations of their
 * own, so both send Back to Study rather than into history: a learner who
 * followed three category tiles should not have to tap Back three times to
 * leave. The cost of that choice was the whole bug this exists to fix — bare
 * `/study` resolves to the *first* section the course has, so leaving a category
 * dropped you on Missions. Back undid the navigation and the section switch
 * above it, which is the one thing Back must never do.
 *
 * Carried in the sheet's own address rather than in a router state object, for
 * the reason Browse's filters are: it survives a reload, a shared link and an
 * agent driving the screen, none of which have a history stack to consult.
 */
export function writeStudyOrigin(params: URLSearchParams, from: StudyTab | undefined): void {
  if (from) params.set('from', from);
}

/**
 * Where Back should land, or `undefined` for "Study, wherever it opens".
 *
 * An unrecognised name degrades to that rather than erroring, as every other
 * parser here does: a stale link should still get you out of the sheet.
 */
export function parseStudyOrigin(params: URLSearchParams): StudyTab | undefined {
  const from = params.get('from');
  return isStudyTab(from) ? from : undefined;
}
