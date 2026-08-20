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

import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  courseFilter,
  courseOptions,
  coursePath,
  resolveCourse,
  type Course,
  type CourseOption,
  type ItemFilter,
} from '../domain/content';
import { useServices } from './services-context';

export interface CourseScope {
  readonly course: Course;
  /** Every language the loaded packs offer, with their levels. */
  readonly options: readonly CourseOption[];
  /** The course as a repository filter: its packs, and its levels where narrowed. */
  readonly filter: ItemFilter;
  /** The option the current course belongs to, for labels and level lists. */
  readonly option: CourseOption | undefined;
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
      path: (screen?: string) => coursePath(course, screen),
    };
  }, [options, language, level]);
}
