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
import { repoRoot, shippedRecords } from '../fixtures/dataset';

/** Docs that quote the pack's size, and are expected to agree with it. */
const DOCS = ['README.md', 'docs/roadmap.md'];

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
