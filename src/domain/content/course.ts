/**
 * A course: one target language, narrowed to one level.
 *
 * The repository indexes every loaded pack together, which is right — a lexeme
 * lookup should not care which pack it came from. But a learner is not studying
 * "everything loaded": they are studying Spanish, at roughly A1. That scope has
 * to exist somewhere, and putting it here rather than in the screens means the
 * URL, the session planner and the browse filters all narrow the same way from
 * one definition.
 *
 * Level is a *ceiling*, not a partition. A learner at A2 should still meet A1
 * content — that is review, not regression — so `a2` means "a2 and below" and
 * every scope is expressible as an `ItemFilter` the repository already
 * understands. Progress is untouched by any of this: it references item ids,
 * which carry their pack, so switching course cannot invalidate what has been
 * practised.
 */

import type { PackId } from './ids';
import { languageOption, type LanguageTag } from './language';
import { CEFR_LEVELS, type CefrLevel } from './model';
import type { ContentRepository, ItemFilter } from './repository';

/** Every level, plus the unnarrowed case. `all` is the default, not a fallback. */
export const LEVEL_SCOPE_ALL = 'all';
export type LevelScope = CefrLevel | typeof LEVEL_SCOPE_ALL;

/** What the learner is studying. Serialised into the path as `/<language>/<level>`. */
export interface Course {
  readonly language: LanguageTag;
  readonly level: LevelScope;
}

/** One selectable level within a course, with the content it would put in scope. */
export interface CourseLevel {
  readonly level: LevelScope;
  /** `A1`, or `All levels` for the unnarrowed scope. */
  readonly label: string;
  /** Items in scope at this level, i.e. cumulative rather than exact. */
  readonly count: number;
}

/** One selectable language, derived from the packs that are actually loaded. */
export interface CourseOption {
  readonly language: LanguageTag;
  /** Name in the language itself, e.g. `Español`. */
  readonly label: string;
  readonly englishLabel: string;
  readonly packs: readonly PackId[];
  /** Levels with content, lowest first, followed by `all`. */
  readonly levels: readonly CourseLevel[];
  readonly itemCount: number;
}

export function isLevelScope(value: string | null | undefined): value is LevelScope {
  if (value === null || value === undefined) return false;
  return value === LEVEL_SCOPE_ALL || (CEFR_LEVELS as readonly string[]).includes(value);
}

export function levelLabel(level: LevelScope): string {
  return level === LEVEL_SCOPE_ALL ? 'All levels' : level.toUpperCase();
}

/** `/es/a1`. The path prefix every course-scoped screen hangs off. */
export function coursePrefix(course: Course): string {
  return `/${course.language}/${course.level}`;
}

/**
 * A course-scoped path: `coursePath(course, 'browse')` → `/es/a1/browse`.
 * Screens build links through this rather than by concatenation, for the same
 * reason `sessionPath` exists — a hand-spelled prefix is a prefix that can go
 * stale when the shape changes.
 */
export function coursePath(course: Course, screen = ''): string {
  const suffix = screen.replace(/^\/+/, '');
  return suffix ? `${coursePrefix(course)}/${suffix}` : coursePrefix(course);
}

/** Levels at or below `level`; the whole set for `all`. */
function levelsUpTo(level: LevelScope, available: readonly CefrLevel[]): readonly CefrLevel[] {
  if (level === LEVEL_SCOPE_ALL) return available;
  const ceiling = CEFR_LEVELS.indexOf(level);
  return available.filter((candidate) => CEFR_LEVELS.indexOf(candidate) <= ceiling);
}

/**
 * The course as a repository filter: its packs, and its levels where narrowed.
 *
 * `levels` is deliberately omitted for the `all` scope rather than listed
 * exhaustively. An item with no declared level fails a `levels` filter, so
 * spelling out every level would quietly drop unclassified content — which is
 * the opposite of what "all levels" says.
 */
export function courseFilter(course: Course, options: readonly CourseOption[]): ItemFilter {
  const option = options.find((candidate) => candidate.language === course.language);
  const packs = option?.packs ?? [];
  const declared = option?.levels.flatMap((entry) =>
    entry.level === LEVEL_SCOPE_ALL ? [] : [entry.level],
  );
  const levels = levelsUpTo(course.level, declared ?? []);

  return {
    ...(packs.length ? { packs } : {}),
    ...(course.level === LEVEL_SCOPE_ALL || levels.length === 0 ? {} : { levels }),
  };
}

/**
 * The courses the loaded packs actually offer.
 *
 * Derived from content rather than declared: a pack manifest lists the levels it
 * *intends* to cover, and a level whose rows have not been written yet would
 * otherwise appear as an empty course. Languages come out in pack order, so the
 * first-loaded pack's language is the default.
 */
export function courseOptions(repository: ContentRepository): readonly CourseOption[] {
  const byLanguage = new Map<LanguageTag, PackId[]>();
  for (const manifest of repository.packs) {
    const existing = byLanguage.get(manifest.targetLanguage);
    if (existing) existing.push(manifest.id);
    else byLanguage.set(manifest.targetLanguage, [manifest.id]);
  }

  return [...byLanguage].map(([language, packs]) => {
    const items = repository.query({ packs });
    const present = CEFR_LEVELS.filter((level) => items.some((item) => item.level === level));

    const levels: CourseLevel[] = present.map((level) => ({
      level,
      label: levelLabel(level),
      count: items.filter(
        (item) =>
          item.level !== undefined && CEFR_LEVELS.indexOf(item.level) <= CEFR_LEVELS.indexOf(level),
      ).length,
    }));

    // Offered even for a single-level pack: it is the scope that includes
    // content carrying no level at all, so it is never redundant.
    levels.push({
      level: LEVEL_SCOPE_ALL,
      label: levelLabel(LEVEL_SCOPE_ALL),
      count: items.length,
    });

    const named = languageOption(language);
    return {
      language,
      label: named.nativeName,
      englishLabel: named.englishName,
      packs,
      levels,
      itemCount: items.length,
    };
  });
}

/**
 * The course a `/:language/:level` pair names, corrected to something that
 * exists.
 *
 * A stale bookmark or a hand-typed level degrades to the widest scope of a real
 * language rather than an empty screen — the same choice `parseSessionUrl`
 * makes, and for the same reason: a broader session is recoverable, a blank one
 * looks like a broken app.
 */
export function resolveCourse(
  options: readonly CourseOption[],
  language: string | null | undefined,
  level: string | null | undefined,
): Course {
  const option =
    options.find((candidate) => candidate.language === language) ?? options[0] ?? undefined;
  if (!option) return { language: language ?? '', level: LEVEL_SCOPE_ALL };

  const offered = option.levels.some((entry) => entry.level === level);
  return {
    language: option.language,
    level: offered && isLevelScope(level) ? level : LEVEL_SCOPE_ALL,
  };
}

export function sameCourse(a: Course, b: Course): boolean {
  return a.language === b.language && a.level === b.level;
}
