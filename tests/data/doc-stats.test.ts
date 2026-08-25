/**
 * The content counts quoted in the docs must match the pack that ships.
 *
 * CI already fails when `public/packs` disagrees with `content/es`, but nothing
 * checked the figures written *about* the pack in prose — so the README went on
 * advertising 845 items and a 100-verb pack long after it held 1,027 and 117.
 * Those numbers are the first thing a reader sees, and a stale one makes the
 * whole document suspect.
 *
 * Counts are derived from the shipped pack, so growing the content fails this
 * test until the sentence describing it is updated too.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MISSIONS } from '../../src/app/missions';
import { MISSION_VARIATIONS } from '../../src/app/mission-variations';
import { APPEARANCE_AXES } from '../../src/styles/axes';
import { PALETTES } from '../../src/styles/themes';
import { repoRoot, shippedRecords } from '../fixtures/dataset';

/** Docs that quote the pack's size, and are expected to agree with it. */
const DOCS = ['README.md', 'docs/roadmap.md'];

/**
 * Docs that quote any figure about the app, for the second block below.
 *
 * Wider than `DOCS` because the figures there are not all about the pack:
 * `AGENTS.md` and the screens document both count missions and palettes.
 */
const SCANNED = [...DOCS, 'AGENTS.md', 'docs/screens-and-urls.md', 'docs/theming.md'];

const count = (file: string) => shippedRecords(file).length;

const actual = {
  verbs: count('verbs'),
  nouns: count('nouns'),
  modifiers: count('modifiers'),
  sentences: count('sentences'),
  words: count('vocabulary'),
};

const totalItems = actual.sentences + actual.words;

/** Thousands separators, the way the docs write them. */
const groups = (value: number) => value.toLocaleString('en-US');

const read = (doc: string) => readFileSync(join(repoRoot, doc), 'utf8');

/**
 * A claim in the docs: the label as written, and the number it should carry.
 *
 * A pattern must start with a digit. A bare `[\d,]+` also matches a lone comma,
 * so ordinary prose — "items already carry `skills`" after a clause ending in a
 * comma — was read as a claim that there are "," items and failed the check.
 * `sentences` is quoted both bare and as "example sentences", so the pattern
 * allows an optional qualifier.
 */
const CLAIMS: readonly { label: string; pattern: RegExp; expected: number }[] = [
  { label: 'verbs', pattern: /\*{0,2}(\d[\d,]*) verbs/g, expected: actual.verbs },
  { label: 'nouns', pattern: /\*{0,2}(\d[\d,]*) nouns/g, expected: actual.nouns },
  { label: 'modifiers', pattern: /\*{0,2}(\d[\d,]*) modifiers/g, expected: actual.modifiers },
  {
    label: 'sentences',
    pattern: /\*{0,2}(\d[\d,]*) (?:example )?sentences/g,
    expected: actual.sentences,
  },
  // Wrapped across a line break in the README, so the gap may contain a newline.
  { label: 'items', pattern: /(\d[\d,]*)\s+(?:practisable\s+)?items/g, expected: totalItems },
];

describe('the claim patterns themselves', () => {
  // The bug this replaces: `[\d,]+` matched the comma in "uses it, items
  // already carry skills", so a sentence with no number in it was read as
  // claiming there are "," items. Prose must never register as a claim.
  it.each(CLAIMS)('$label ignores a comma with no digits', ({ pattern }) => {
    const prose = 'it depends, items already carry meaning, verbs and nouns, modifiers, sentences';
    expect([...prose.matchAll(new RegExp(pattern.source, 'g'))]).toEqual([]);
  });
});

describe('content counts quoted in the docs', () => {
  for (const doc of DOCS) {
    describe(doc, () => {
      for (const { label, pattern, expected } of CLAIMS) {
        it(`quotes ${label} as ${groups(expected)} wherever it mentions them`, () => {
          const text = read(doc);
          const quoted = [...text.matchAll(pattern)].map((match) => match[1]!);

          // A doc need not mention every figure; it must not misstate one.
          for (const value of quoted) {
            expect(value, `${doc} quotes "${value} ${label}"`).toBe(groups(expected));
          }
        });
      }
    });
  }

  it('derives its expectations from a pack that actually has content', () => {
    // Guards the guard: every count reading zero would make the loops vacuous.
    expect(Object.values(actual).every((value) => value > 0)).toBe(true);
    expect(totalItems).toBeGreaterThan(1000);
  });
});

/**
 * The same guard, for the figures that are not item counts.
 *
 * Added after a documentation pass found that every number this file already
 * watched was correct and almost every number it did not was wrong: the README
 * advertised thirteen missions against seventeen, four palettes against seven,
 * four appearance axes against five and 314 variation combinations against 658,
 * while the roadmap said 57 passages against 123. The split was exact, and it is
 * the argument for extending the file rather than for re-reading the prose: a
 * figure with a test stayed true for four expansions, and a figure with only a
 * reviewer did not survive one.
 *
 * These read the same sources the app does, so growing the content or the
 * palette list fails here until the sentence describing it is updated too.
 */
describe('other figures quoted in the docs', () => {
  const missionLevels = MISSIONS.reduce<Record<string, number>>((counts, mission) => {
    counts[mission.level] = (counts[mission.level] ?? 0) + 1;
    return counts;
  }, {});

  /** A mission's model passage decides whether it teaches a dialogue or a narration. */
  const passageKind = new Map(
    shippedRecords<{ id: string; kind: string }>('passages').map((passage) => [
      String(passage.id).split(':').pop()!,
      passage.kind,
    ]),
  );

  const variationCombinations = Object.values(MISSION_VARIATIONS).reduce(
    (catalogTotal, patterns) =>
      catalogTotal +
      patterns.reduce(
        (missionTotal, pattern) =>
          missionTotal +
          pattern.slots.reduce((patternTotal, slot) => patternTotal * slot.choices.length, 1),
        0,
      ),
    0,
  );

  const dialogueMissions = MISSIONS.filter(
    (mission) => passageKind.get(String(mission.passage)) === 'dialogue',
  ).length;

  const FIGURES: readonly { label: string; pattern: RegExp; expected: number }[] = [
    // Spelled as words in the prose, so the words are what the pattern reads.
    //
    // Only the phrasings that assert a *total* — `all N missions`, `N of the N
    // missions`, and the hyphenated `N-mission journey`. A bare `N missions` is
    // usually a subset ("Fourteen missions use a dialogue model") and reading
    // those as totals is what this pattern got wrong first.
    {
      label: 'missions',
      pattern: /(?:all|of\s+the)\s+(\w+)\s+missions?\b|\b(\w+)-mission\b/g,
      expected: MISSIONS.length,
    },
    {
      label: 'dialogue-model missions',
      pattern: /(\w+)\s+missions\s+use\s+a\s+dialogue\b/g,
      expected: dialogueMissions,
    },
    // Anchored on "of N palettes" or "N palettes in light and dark", the two
    // ways the docs state the registry's size. A bare "N palettes" is not
    // enough: theming.md says "Calm and Vivid are … not two palettes", which is
    // rhetoric about intensity and not a claim about how many exist.
    {
      label: 'palettes',
      pattern: /of\s+(\w+)\s+palettes\b|(\w+)\s+palettes\s+in\s+light\s+and\s+dark\b/g,
      expected: PALETTES.length,
    },
    {
      label: 'appearance axes',
      pattern: /(\w+)\s+independent\s+axes\b/g,
      expected: APPEARANCE_AXES.length,
    },
    { label: 'passages', pattern: /(\d[\d,]*)\s+passages\b/g, expected: count('passages') },
    {
      label: 'variation combinations',
      // "combinations" alone would also read theming.md's count of palette ×
      // contrast × intensity, which is a different number about a different
      // thing. The Variation Labs claim always says what the combinations are.
      pattern: /(\d[\d,]*)\s+(?:valid\s+study\s+phrases|combinations\s+cover)\b/g,
      expected: variationCombinations,
    },
  ];

  /** `seventeen` and `17` are the same claim; the docs write either. */
  const WORDS: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
    thirteen: 13,
    fourteen: 14,
    fifteen: 15,
    sixteen: 16,
    seventeen: 17,
  };

  /**
   * Returns the number a match claims, or `null` when it claims none.
   *
   * A quantity word must not be invented here: `every mission`, `each palette`
   * and `three-context` are prose, not claims, and reading them as zero would
   * fail on sentences that state nothing at all.
   */
  const claimed = (text: string): number | null => {
    const digits = Number(text.replaceAll(',', ''));
    if (Number.isFinite(digits) && text !== '') return digits;
    return WORDS[text.toLowerCase()] ?? null;
  };

  for (const doc of SCANNED) {
    describe(doc, () => {
      for (const { label, pattern, expected } of FIGURES) {
        it(`quotes ${label} as ${expected} wherever it states a number`, () => {
          const text = read(doc);

          for (const match of text.matchAll(pattern)) {
            // Alternation means the number can land in either group.
            const captured = match.slice(1).find((group) => group !== undefined);
            if (captured === undefined) continue;

            const value = claimed(captured);
            if (value === null) continue;
            expect(value, `${doc}: "${match[0]}"`).toBe(expected);
          }
        });
      }
    });
  }

  it('derives its expectations from registries that are actually populated', () => {
    expect(MISSIONS.length).toBeGreaterThan(0);
    expect(PALETTES.length).toBeGreaterThan(0);
    expect(APPEARANCE_AXES.length).toBe(5);
    expect(variationCombinations).toBeGreaterThan(0);
    expect(dialogueMissions).toBeGreaterThan(0);
    // The level split the README states, derived rather than typed.
    expect(missionLevels).toMatchObject({ a1: expect.any(Number) });
  });

  // Guards the guard, and this is the failure this whole block exists to avoid
  // repeating: a claim nobody checks. A pattern that matches no occurrence
  // passes every assertion above it, so it looks like coverage and is not.
  // The palettes pattern was exactly that for one revision — it wanted a
  // literal space and the README wraps "which of seven" onto the line above.
  it.each(FIGURES)('$label is actually stated somewhere in the docs', ({ pattern }) => {
    const stated = SCANNED.flatMap((doc) => [...read(doc).matchAll(pattern)]).filter(
      (match) => claimed(match.slice(1).find((group) => group !== undefined) ?? '') !== null,
    );

    expect(stated.length).toBeGreaterThan(0);
  });
});
