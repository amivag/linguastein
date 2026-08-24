/**
 * Courses: the language-and-level scope every screen narrows by.
 *
 * The two things worth pinning are that a level is a *ceiling* rather than a
 * bucket — practising A1 material at A2 is review, not regression — and that a
 * course that does not exist degrades to one that does, because a stale
 * bookmark must not render an empty app.
 */

import { describe, expect, it } from 'vitest';
import {
  courseFilter,
  courseOptions,
  coursePath,
  isLevelScope,
  reachableTopics,
  resolveCourse,
  type Course,
} from '../../src/domain/content';
import { multilingualRepository, testRepository } from '../fixtures/pack';

describe('courseOptions', () => {
  it('derives one course per target language of the loaded packs', () => {
    const options = courseOptions(multilingualRepository());

    expect(options.map((option) => option.language)).toEqual(['es', 'fr']);
    // Named in the language itself, so a second pack needs no UI change.
    expect(options.map((option) => option.label)).toEqual(['Español', 'Français']);
  });

  it('offers only the levels its own content actually has', () => {
    const [spanish, french] = courseOptions(multilingualRepository());

    // The Spanish fixture is all A1; the French one skips A2 entirely.
    expect(spanish?.levels.map((level) => level.level)).toEqual(['a1', 'all']);
    expect(french?.levels.map((level) => level.level)).toEqual(['a1', 'b1', 'all']);
  });

  it('counts a level cumulatively, because a level is a ceiling', () => {
    const french = courseOptions(multilingualRepository()).find(
      (option) => option.language === 'fr',
    );

    // One A1 item and one B1 item: B1 includes both.
    expect(french?.levels.find((level) => level.level === 'a1')?.count).toBe(1);
    expect(french?.levels.find((level) => level.level === 'b1')?.count).toBe(2);
    expect(french?.levels.find((level) => level.level === 'all')?.count).toBe(2);
  });
});

describe('courseFilter', () => {
  const options = courseOptions(multilingualRepository());
  const repository = multilingualRepository();

  it('keeps one language out of another language’s course', () => {
    const spanish = repository.query(courseFilter({ language: 'es', level: 'all' }, options));
    const french = repository.query(courseFilter({ language: 'fr', level: 'all' }, options));

    expect(spanish.every((item) => item.pack === 'test-es')).toBe(true);
    expect(french.map((item) => item.text)).toEqual(['Je dois travailler.', 'bonjour']);
  });

  it('includes everything below the chosen level', () => {
    const filter = courseFilter({ language: 'fr', level: 'b1' }, options);
    expect(filter.levels).toEqual(['a1', 'b1']);
    expect(repository.query(filter)).toHaveLength(2);
  });

  it('narrows to the level and below, not to the level alone', () => {
    const filter = courseFilter({ language: 'fr', level: 'a1' }, options);
    expect(repository.query(filter).map((item) => item.text)).toEqual(['Je dois travailler.']);
  });

  /**
   * An item with no declared level fails a `levels` filter, so listing every
   * level for `all` would quietly drop unclassified content — the opposite of
   * what the label promises.
   */
  it('sets no level filter at all for the widest scope', () => {
    expect(courseFilter({ language: 'es', level: 'all' }, options).levels).toBeUndefined();
  });
});

describe('resolveCourse', () => {
  const options = courseOptions(multilingualRepository());

  it('reads a course off the path', () => {
    expect(resolveCourse(options, 'fr', 'b1')).toEqual({ language: 'fr', level: 'b1' });
  });

  it('falls back to the first pack’s language rather than nothing', () => {
    expect(resolveCourse(options, 'ja', 'a1').language).toBe('es');
    expect(resolveCourse(options, undefined, undefined).language).toBe('es');
  });

  it('widens a level the course does not offer instead of emptying the screen', () => {
    // The French fixture has no A2 content, so `/fr/a2` is not a real course.
    expect(resolveCourse(options, 'fr', 'a2').level).toBe('all');
    expect(resolveCourse(options, 'es', 'nonsense').level).toBe('all');
  });

  it('survives a repository with no packs at all', () => {
    expect(resolveCourse([], 'es', 'a1')).toEqual({ language: 'es', level: 'all' });
  });
});

describe('coursePath', () => {
  const course: Course = { language: 'es', level: 'a1' };

  it('builds the prefix every screen hangs off', () => {
    expect(coursePath(course)).toBe('/es/a1');
    expect(coursePath(course, 'browse')).toBe('/es/a1/browse');
    expect(coursePath(course, 'read/700001')).toBe('/es/a1/read/700001');
  });

  it('tolerates a leading slash on the screen, so callers cannot double it', () => {
    expect(coursePath(course, '/progress')).toBe('/es/a1/progress');
  });
});

describe('isLevelScope', () => {
  it('accepts the CEFR levels and the widest scope, and nothing else', () => {
    expect(isLevelScope('a1')).toBe(true);
    expect(isLevelScope('c2')).toBe(true);
    expect(isLevelScope('all')).toBe(true);
    expect(isLevelScope('a3')).toBe(false);
    expect(isLevelScope(null)).toBe(false);
  });
});

describe('a single-language pack', () => {
  it('still offers the widest scope, which is where unlevelled content lives', () => {
    const [only] = courseOptions(testRepository());
    expect(only?.language).toBe('es');
    expect(only?.levels.map((level) => level.level)).toContain('all');
  });
});

/**
 * A standing category choice, narrowed to the course in front of the learner.
 *
 * The rule exists because the preference is global and a topic is not: a slug is
 * pack vocabulary, and a count is relative to the level ceiling. Both writers of
 * a session link and the picker's own summary go through here, so an unreachable
 * category cannot reach a `?topic=` that would plan an empty session.
 */
describe('reachableTopics', () => {
  const facets = (repository = testRepository()) => repository.topics();

  it('keeps a category the loaded content actually carries', () => {
    expect(reachableTopics(facets(), ['work'])).toEqual(['work']);
  });

  it('drops one that is declared but empty', () => {
    // `colours` is in the fixture's topic registry and on no item.
    expect(reachableTopics(facets(), ['colours'])).toEqual([]);
  });

  it('drops one no loaded pack declares at all', () => {
    // What a Spanish choice looks like with only the French pack open.
    expect(reachableTopics(facets(), ['greetings'])).toEqual([]);
  });

  it('keeps the reachable half of a mixed choice, in the order given', () => {
    expect(reachableTopics(facets(), ['colours', 'work', 'food-drink'])).toEqual([
      'work',
      'food-drink',
    ]);
  });

  it('returns an empty choice untouched, which means everything', () => {
    expect(reachableTopics(facets(), [])).toEqual([]);
  });

  /**
   * The narrowing follows the scope, not just the pack: a level is a ceiling, so
   * a category whose only items sit above it is as unreachable as one nothing
   * declares — and this is the path a single-pack install can reach today.
   */
  it('narrows by the course filter it is given', () => {
    const repository = multilingualRepository();
    const french = { language: 'fr', level: 'a1' } as const;
    const options = courseOptions(repository);

    const atA1 = repository.topics(courseFilter(french, options));
    expect(reachableTopics(atA1, ['greetings'])).toEqual(['greetings']);
    expect(reachableTopics(atA1, ['work'])).toEqual([]);
  });
});
