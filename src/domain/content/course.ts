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
import type { Level } from './model';
import type { ContentRepository, ItemFilter, TopicFacet } from './repository';

/** Every level, plus the unnarrowed case. `all` is the default, not a fallback. */
export const LEVEL_SCOPE_ALL = 'all';
export type LevelScope = Level | typeof LEVEL_SCOPE_ALL;

/**
 * The shape a level id has to have to appear in a path.
 *
 * All this can check is the shape, and that is the point rather than a weakness:
 * which ids exist is the loaded packs' business, and `resolveCourse` already
 * holds the value against the levels a course actually offers before using it.
 * This used to be membership of `CEFR_LEVELS`, which meant a Chinese pack's
 * `/zh/hsk1/browse` could not be parsed at all.
 */
const LEVEL_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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
  /**
   * Items in scope at this level: cumulative rather than exact, and the pack's
   * own figure rather than a count of what is loaded — see {@link itemsPerLevel}.
   */
  readonly count: number;
}

/** One selectable language, derived from the packs that are actually loaded. */
export interface CourseOption {
  readonly language: LanguageTag;
  /**
   * The language's ladder, in the order it climbs — every rung its packs declare.
   * `levels` below is the same set as selectable courses, with `all` after them;
   * this is what orders them, and what "below" is read from.
   */
  readonly ladder: readonly Level[];
  /** What each rung is called, where its pack names it. */
  readonly levelLabels: Readonly<Record<string, string>>;
  /** Name in the language itself, e.g. `Español`. */
  readonly label: string;
  readonly englishLabel: string;
  readonly packs: readonly PackId[];
  /** The rungs the packs declare, lowest first, followed by `all`. */
  readonly levels: readonly CourseLevel[];
  readonly itemCount: number;
}

export function isLevelScope(value: string | null | undefined): value is LevelScope {
  if (value === null || value === undefined) return false;
  return value === LEVEL_SCOPE_ALL || LEVEL_ID.test(value);
}

/**
 * What to call a rung, preferring what its pack calls it.
 *
 * The fallback is upper-casing the id, which is right for CEFR and is why
 * `core-es` declares no labels: `a1` reads correctly as `A1`, and a label
 * repeating it would be a second place for it to go stale. `hsk1` does not name
 * itself, so an HSK pack declares a label and every screen that has the course
 * option passes them through.
 */
export function levelLabel(
  level: LevelScope,
  labels: Readonly<Record<string, string>> = {},
): string {
  if (level === LEVEL_SCOPE_ALL) return 'All levels';
  return labels[level] ?? level.toUpperCase();
}

/**
 * A language's level ladder, in the order it climbs, read off the packs loaded.
 *
 * The one place the order comes from now. Several packs of one language are
 * merged in load order with duplicates dropped, which keeps a supplementary pack
 * from reordering the core one's ladder — the first pack to name a rung fixes
 * where it sits.
 */
export function levelLadder(
  repository: ContentRepository,
  language: LanguageTag,
): readonly Level[] {
  const ladder: Level[] = [];
  for (const manifest of repository.packs) {
    if (manifest.targetLanguage !== language) continue;
    for (const level of manifest.levels ?? []) {
      if (!ladder.includes(level)) ladder.push(level);
    }
  }
  return ladder;
}

/**
 * The packs of one language, which is the scope a curriculum reference resolves
 * in (`docs/tasks/pack-addressing.md` §3).
 *
 * The *language's* packs and not the course's level-narrowed filter, because the
 * collision being solved is across languages: two packs from one generator both
 * number their passages from `700001`, and a mission's passage may sit at any
 * rung at or below the course's ceiling. Narrowing by level here would hide a
 * mission's own text from it.
 */
export function packsOfLanguage(
  repository: ContentRepository,
  language: LanguageTag,
): readonly PackId[] {
  return repository.packs
    .filter((manifest) => manifest.targetLanguage === language)
    .map((manifest) => manifest.id);
}

/** The labels those packs declare, merged the same way. */
function levelLabelsOf(
  repository: ContentRepository,
  language: LanguageTag,
): Readonly<Record<string, string>> {
  const labels: Record<string, string> = {};
  for (const manifest of repository.packs) {
    if (manifest.targetLanguage !== language) continue;
    for (const [id, label] of Object.entries(manifest.levelLabels ?? {})) {
      labels[id] ??= label;
    }
  }
  return labels;
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

/**
 * The other direction: what a path *claims* to be studying.
 *
 * Deliberately no resolution. `resolveCourse` is what corrects a stale language
 * or level, and it needs the loaded courses to do it — so this reads the two
 * segments and says nothing about whether they exist. It is here rather than in
 * the app because the spelling of `/es/a1/browse` belongs to one module in both
 * directions, and it exists at all because the boot path has to know the level
 * ceiling *before* it fetches the shards a course reads: no repository, no
 * router, and nothing yet to resolve against (`docs/tasks/shard-loading.md`
 * §3.2).
 *
 * A level is absent unless it is shaped like one, so `/browse` — a path from
 * before courses were in the URL — names no level rather than a level called
 * `browse`... which it cannot distinguish, and does not have to: an
 * unrecognisable level and no level both mean "no ceiling to narrow by".
 */
export function parseCoursePath(pathname: string): {
  readonly language: string | undefined;
  readonly level: LevelScope | undefined;
} {
  const [language, level] = pathname.replace(/^\/+/, '').split('/');
  return {
    language: language === '' ? undefined : language,
    level: isLevelScope(level) ? level : undefined,
  };
}

/**
 * Levels at or below `level` on `ladder`; the whole set for `all`.
 *
 * A ceiling the ladder does not name yields nothing rather than everything, which
 * is the safe direction: `resolveCourse` has already widened an unknown level to
 * `all` before this is reached, so getting here with one means the ladder and the
 * content disagree, and silently returning every level would hide that.
 */
export function levelsUpTo(
  level: LevelScope,
  ladder: readonly Level[],
  available: readonly Level[] = ladder,
): readonly Level[] {
  if (level === LEVEL_SCOPE_ALL) return available;
  const ceiling = ladder.indexOf(level);
  if (ceiling === -1) return [];
  return available.filter((candidate) => {
    const rung = ladder.indexOf(candidate);
    return rung !== -1 && rung <= ceiling;
  });
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
  const present = option?.levels.flatMap((entry) =>
    entry.level === LEVEL_SCOPE_ALL ? [] : [entry.level],
  );
  const levels = levelsUpTo(course.level, option?.ladder ?? [], present ?? []);

  return {
    ...(packs.length ? { packs } : {}),
    ...(course.level === LEVEL_SCOPE_ALL || levels.length === 0 ? {} : { levels }),
  };
}

/**
 * How many items each level holds: what the packs declare, and a count of what
 * is loaded for a pack that declares nothing.
 *
 * A course has to be describable before its content is fetched. The big files
 * are sharded by level and boot fetches only the shards the course reads
 * (`docs/tasks/shard-loading.md`), so counting items in memory would report a
 * *smaller course* rather than an unfetched one — and the chip a learner taps to
 * get B1 would be the one thing missing. `levelItems` is the pack's own figure
 * and stays true whatever is loaded.
 *
 * Counting is the fallback rather than the rule, because a pack built by hand or
 * by an older build may not declare it. That pack is loaded whole — nothing
 * shards a file it has not split — so counting is exactly right there.
 */
function itemsPerLevel(
  repository: ContentRepository,
  language: LanguageTag,
): { readonly byLevel: ReadonlyMap<string, number>; readonly unlevelled: number } {
  const byLevel = new Map<string, number>();
  let unlevelled = 0;

  for (const manifest of repository.packs) {
    if (manifest.targetLanguage !== language) continue;
    if (manifest.levelItems) {
      for (const [level, count] of Object.entries(manifest.levelItems)) {
        byLevel.set(level, (byLevel.get(level) ?? 0) + count);
      }
      continue;
    }
    for (const item of repository.query({ packs: [manifest.id] })) {
      if (item.level === undefined) unlevelled += 1;
      else byLevel.set(item.level, (byLevel.get(item.level) ?? 0) + 1);
    }
  }

  return { byLevel, unlevelled };
}

/**
 * The courses the loaded packs offer.
 *
 * Declared rather than derived from the items in memory, and that is a change
 * rather than a detail: this used to filter the ladder down to the levels whose
 * rows were actually loaded, which was right while boot loaded every pack whole
 * and became wrong the moment it stopped. `manifest.levels` already lists only
 * the rungs a pack has content for — the build derives it from the items it
 * emitted — so the filter was not merely replaceable, it was a second, worse
 * copy of the same fact.
 *
 * Languages come out in pack order, so the first-loaded pack's language is the
 * default.
 */
export function courseOptions(repository: ContentRepository): readonly CourseOption[] {
  const byLanguage = new Map<LanguageTag, PackId[]>();
  for (const manifest of repository.packs) {
    const existing = byLanguage.get(manifest.targetLanguage);
    if (existing) existing.push(manifest.id);
    else byLanguage.set(manifest.targetLanguage, [manifest.id]);
  }

  return [...byLanguage].map(([language, packs]) => {
    const ladder = levelLadder(repository, language);
    const labels = levelLabelsOf(repository, language);
    const { byLevel, unlevelled } = itemsPerLevel(repository, language);

    const levels: CourseLevel[] = ladder.map((level) => ({
      level,
      label: levelLabel(level, labels),
      // Cumulative, because a level is a ceiling: the declared figures are exact
      // per rung, and adding them up is the app's arithmetic.
      count: levelsUpTo(level, ladder).reduce((total, rung) => total + (byLevel.get(rung) ?? 0), 0),
    }));

    const itemCount = [...byLevel.values()].reduce((total, count) => total + count, unlevelled);

    // Offered even for a single-level pack: it is the scope that includes
    // content carrying no level at all, so it is never redundant.
    levels.push({
      level: LEVEL_SCOPE_ALL,
      label: levelLabel(LEVEL_SCOPE_ALL),
      count: itemCount,
    });

    const named = languageOption(language);
    return {
      language,
      ladder,
      levelLabels: labels,
      label: named.nativeName,
      englishLabel: named.englishName,
      packs,
      levels,
      itemCount,
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

/**
 * The learner's chosen categories, minus the ones this course cannot reach.
 *
 * `focusTopics` is a standing preference stored once, while a topic slug is pack
 * vocabulary and a count is course-relative — so the stored list outlives the
 * scope it was chosen in, in two ways. A category that exists only at B1
 * survives a switch down to A1, and `food-drink` means nothing to a French pack.
 *
 * Narrowing it is therefore not a display concern. A focus is a bias that must
 * never be able to hand back an empty session, and a session link carrying a
 * category the course has no items for does exactly that — the planner has
 * nothing to widen back to, because a topic *is* a filter.
 *
 * So the picker's summary and every writer of a session link narrow through
 * here. Do not re-derive it at a call site: what this replaces was those two
 * halves disagreeing, with the summary reading "Everything" while the link it
 * produced said `?topic=hotel`.
 *
 * Takes the facets rather than the repository because both callers already have
 * them — counting the items of every category twice per render is not the price
 * of a shared rule.
 */
export function reachableTopics(
  topics: readonly TopicFacet[],
  chosen: readonly string[],
): readonly string[] {
  if (chosen.length === 0) return chosen;
  const reachable = new Set(topics.filter((topic) => topic.count > 0).map((topic) => topic.id));
  return chosen.filter((topic) => reachable.has(topic));
}
