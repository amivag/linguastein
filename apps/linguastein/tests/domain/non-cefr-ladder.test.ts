/**
 * A pack whose levels are not CEFR, ordered by its own ladder.
 *
 * This is the requirement `docs/tasks/language-matrix.md` §9 states as a test of
 * doneness: *a pack declares a level ladder that is not CEFR, and the URL carries
 * it*. Until the ladder moved into the manifest, none of it was possible —
 * `CEFR_LEVELS` was a closed enum of six codes in the model every pack shares,
 * `CEFR_LEVELS.indexOf(...)` was how six call sites decided what "below" meant,
 * and `isLevelScope` refused `hsk1` outright, so `/zh/hsk1/browse` could not even
 * be parsed.
 *
 * HSK bands here because they are the case the brief names, and because they get
 * two things wrong that CEFR happens to get right: they do not sort
 * lexicographically the way `a1 < a2 < b1` does once you reach `hsk10`, and they
 * do not name themselves — `HSK 1` needs a declared label where `A1` does not.
 */

import { describe, expect, it } from 'vitest';
import {
  ContentRepository,
  courseFilter,
  courseOptions,
  levelLabel,
  levelLadder,
  levelsUpTo,
  resolveCourse,
} from '../../src/domain/content';
import type { ContentPack, ItemId, LearningItem, PackId } from '../../src/domain/content';
import { id } from '../fixtures/pack';

const PACK = id<PackId>('core-zh');

/** Deliberately not in alphabetical order once it passes nine. */
const LADDER = ['hsk1', 'hsk2', 'hsk3', 'hsk9', 'hsk10'];

function item(local: string, level: string): LearningItem {
  return {
    id: id<ItemId>(`core-zh:item:${local}`),
    pack: PACK,
    type: 'sentence',
    text: `句子 ${local}`,
    level,
  };
}

const pack: ContentPack = {
  manifest: {
    id: PACK,
    name: 'Chinese Core',
    targetLanguage: 'zh',
    version: '1.0.0',
    levels: LADDER,
    // `hsk1` does not read as its own name, so the pack says what to call it.
    // Only some rungs are named, on purpose: an undeclared one must fall back
    // rather than render blank.
    levelLabels: { hsk1: 'HSK 1', hsk2: 'HSK 2', hsk3: 'HSK 3' },
    files: [{ kind: 'items', path: 'items.jsonl' }],
  },
  items: [
    item('001', 'hsk1'),
    item('002', 'hsk2'),
    item('003', 'hsk3'),
    item('004', 'hsk9'),
    item('005', 'hsk10'),
  ],
  lexemes: [],
  senses: [],
  forms: [],
  skills: [],
  translations: [],
  passages: [],
  audio: [],
};

const repository = ContentRepository.from([pack]);
const options = courseOptions(repository);

describe('a pack with an HSK ladder', () => {
  it('reads its ladder back in the order it declared, not sorted', () => {
    expect(levelLadder(repository, 'zh')).toEqual(LADDER);
  });

  it('offers every rung as a course level, lowest first', () => {
    const [zh] = options;
    expect(zh?.levels.map((entry) => entry.level)).toEqual([...LADDER, 'all']);
  });

  it('names the rungs its pack names, and falls back on the rest', () => {
    const [zh] = options;
    const labels = new Map(zh?.levels.map((entry) => [entry.level, entry.label]));

    expect(labels.get('hsk1')).toBe('HSK 1');
    // Undeclared, so upper-cased — which is wrong-looking for HSK and is exactly
    // why a label is declarable. What matters is that it is never empty.
    expect(labels.get('hsk9')).toBe('HSK9');
    expect(labels.get('all')).toBe('All levels');
  });

  it('treats a level as a ceiling on its own ladder, not alphabetically', () => {
    // The case a lexicographic sort gets wrong: `hsk10` sorts before `hsk2`, so
    // any ordering that is not the declared one puts the hardest band second.
    expect(levelsUpTo('hsk2', LADDER)).toEqual(['hsk1', 'hsk2']);
    expect(levelsUpTo('hsk9', LADDER)).toEqual(['hsk1', 'hsk2', 'hsk3', 'hsk9']);
    expect(levelsUpTo('hsk10', LADDER)).toEqual(LADDER);
    expect(levelsUpTo('all', LADDER)).toEqual(LADDER);
  });

  it('counts a rung cumulatively, because a rung is a ceiling', () => {
    const [zh] = options;
    const counts = new Map(zh?.levels.map((entry) => [entry.level, entry.count]));

    expect(counts.get('hsk1')).toBe(1);
    expect(counts.get('hsk3')).toBe(3);
    // Not 5-then-4: `hsk9` is the fourth rung of the declared ladder.
    expect(counts.get('hsk9')).toBe(4);
    expect(counts.get('hsk10')).toBe(5);
  });

  it('carries the rung in the path, and narrows the course by it', () => {
    const course = resolveCourse(options, 'zh', 'hsk3');
    expect(course).toEqual({ language: 'zh', level: 'hsk3' });

    expect(courseFilter(course, options).levels).toEqual(['hsk1', 'hsk2', 'hsk3']);
  });

  it('widens a rung this pack does not declare, rather than showing nothing', () => {
    // A stale link from a pack that has been removed, or a hand-typed band.
    expect(resolveCourse(options, 'zh', 'hsk4').level).toBe('all');
  });

  it('labels a bare level with no course to ask, so a caller cannot get blank', () => {
    expect(levelLabel('hsk1')).toBe('HSK1');
    expect(levelLabel('hsk1', { hsk1: 'HSK 1' })).toBe('HSK 1');
    expect(levelLabel('all')).toBe('All levels');
  });
});
