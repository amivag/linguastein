/**
 * The current course, read from the path.
 *
 * `/es/a1/browse` says what is being studied as plainly as `?preset=verbs` says
 * what is being practised, and for the same reasons: it survives a reload, it
 * can be shared, and an agent can drive it. So the path is the source of truth
 * here, and the stored preference exists only to decide where `/` should go.
 *
 * A path naming a language or level that is not loaded resolves to the widest
 * real course rather than an error, so a stale link degrades instead of
 * breaking. Rendered outside the course routes — which is how most tests mount
 * a screen — it resolves the same way, to the first pack's language, unnarrowed.
 */

import { use, useMemo } from 'react';
import { useParams } from 'react-router';
import {
  courseFilter,
  courseOptions,
  coursePath,
  resolveCourse,
  resolvePronunciationFor,
  type Course,
  type CourseOption,
  type ItemFilter,
  type LanguageTag,
  type Level,
} from '../domain/content';
import { ServicesContext, useServices } from './services-context';

export interface CourseScope {
  readonly course: Course;
  /** Every language the loaded packs offer, with their levels. */
  readonly options: readonly CourseOption[];
  /** The course as a repository filter: its packs, and its levels where narrowed. */
  readonly filter: ItemFilter;
  /** The option the current course belongs to, for labels and level lists. */
  readonly option: CourseOption | undefined;
  /**
   * The language's level ladder, in the order it climbs.
   *
   * Here rather than fetched per screen because it is what "level is a ceiling"
   * is read from, and three screens need it to order missions. It was
   * `CEFR_LEVELS` — a constant, so no screen had to be handed anything, which is
   * exactly why the assumption went unnoticed until a second curriculum was
   * briefed (`docs/tasks/language-matrix.md` §7).
   */
  readonly ladder: readonly Level[];
  /** `path('browse')` → `/es/a1/browse`. */
  readonly path: (screen?: string) => string;
}

export function useCourse(): CourseScope {
  const { services } = useServices();
  const params = useParams();
  const language = params['language'];
  const level = params['level'];

  const options = useMemo(() => courseOptions(services.repository), [services.repository]);

  return useMemo(() => {
    const course = resolveCourse(options, language, level);
    return {
      course,
      options,
      filter: courseFilter(course, options),
      option: options.find((candidate) => candidate.language === course.language),
      ladder: options.find((candidate) => candidate.language === course.language)?.ladder ?? [],
      path: (screen?: string) => coursePath(course, screen),
    };
  }, [options, language, level]);
}

/**
 * The language to tag rendered target-language text with, or `undefined` when
 * there is no way to know.
 *
 * Every `lang` on a phrase, a lemma, a conjugation or a heard transcript comes
 * from here rather than being typed, for the reason the app's own name is not
 * typed into a component: `lang="es"` was written into twenty elements, and a
 * German pack would have had a screen reader read all twenty with Spanish
 * pronunciation — silently, since nothing on screen looks wrong.
 *
 * Deliberately the one hook here that does not require the providers. A shared
 * component reaches for this wherever it renders target-language text, and
 * several are rendered on their own in tests precisely because they need
 * neither services nor a router — `tests/components/transcript.test.tsx` says
 * so. Absent is also the honest answer: no `lang` attribute leaves the document
 * language in charge, while a guessed one asserts something false.
 */
export function useTargetLanguage(): LanguageTag | undefined {
  const value = use(ServicesContext);
  const params = useParams();
  const language = params['language'];
  const level = params['level'];
  const repository = value?.services.repository;

  return useMemo(() => {
    if (!repository) return undefined;
    return resolveCourse(courseOptions(repository), language, level).language;
  }, [repository, language, level]);
}

/**
 * The accent the current course is spoken in.
 *
 * The stored preference where this language offers it, and the language's own
 * first accent where it does not — `resolvePronunciationFor` decides, and this
 * hook is where every consumer asks.
 *
 * Derived at read time rather than only written on a switch, and that is the
 * whole point. `CourseBar` corrects the stored value when a learner changes
 * language, which is worth keeping so the preference converges on something
 * sensible — but the switcher is not the only way into a course. A shared link,
 * a bookmark, or a reload after the language changed lands on
 * `/fr/a1/read/700001` without passing through it, and a stored `es-ES` then
 * asked the device for a Spanish voice to read French: silence at best, and a
 * Spanish reading of French at worst. That is the same failure the switcher's
 * own comment describes, reached by the one path the switcher cannot see.
 *
 * So nothing outside Settings reads `preferences.pronunciationLocale` directly.
 * It is the rule `reachableTopics` follows for categories, in a second place: a
 * stored global is not an effective value until the course has narrowed it, and
 * the narrowing belongs at every read rather than at one write.
 */
export function usePronunciationLocale(): LanguageTag {
  const { services, preferences } = useServices();
  const { course } = useCourse();

  return useMemo(
    () =>
      resolvePronunciationFor(
        services.repository,
        course.language,
        preferences.pronunciationLocale,
      ),
    [services.repository, course.language, preferences.pronunciationLocale],
  );
}
