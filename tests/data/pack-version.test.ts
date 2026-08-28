/**
 * The pack's version has to move when the pack's contents do.
 *
 * `core-es` versions independently of the app — a dataset ships without an app
 * release, and does. But the version was a literal inside
 * `scripts/build-dataset.ts` and was written exactly once: the pack grew from 443
 * sentences to 1,395 across four expansions still calling itself `0.1.0`, and
 * `PackSettings` displayed that number to every learner the whole time. This is
 * the same failure `doc-stats.test.ts` was written for — a figure *about* the
 * pack that nothing held against the pack — in a place no test was watching.
 *
 * So the version is authored in `content/es/pack.tsv` next to the item count it
 * was cut at, and these tests fail when the two disagree. Adding or removing
 * content therefore forces an edit to that file, where the version sits on the
 * same line. Fixing a typo changes no count and needs no bump.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { PackManifest } from '../../src/domain/content';
import {
  createScratchPack,
  packFiles,
  packManifestPath,
  readJsonl,
  repoRoot,
} from '../fixtures/dataset';

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

interface Declared {
  readonly version: string;
  readonly items: number;
}

/** The first data row of `content/es/pack.tsv`. */
function declared(): Declared {
  const row = readFileSync(join(repoRoot, 'content/es/pack.tsv'), 'utf8')
    .split(/\r?\n/)
    .find((line) => line.trim().length > 0 && !line.startsWith('#'));
  const [version, items] = (row ?? '').split('\t');
  return { version: (version ?? '').trim(), items: Number(items) };
}

const shipped = JSON.parse(
  readFileSync(packManifestPath(join(repoRoot, 'public/packs')), 'utf8'),
) as PackManifest;

const shippedItems = ['sentences', 'vocabulary'].reduce(
  (total, kind) =>
    total +
    packFiles(join(repoRoot, 'public/packs'), kind).flatMap((path) => readJsonl(path)).length,
  0,
);

describe('the authored pack version', () => {
  it('is a semver string', () => {
    expect(declared().version).toMatch(SEMVER);
  });

  it('is what the shipped manifest carries', () => {
    // The manifest is generated, so this catches the version being read from
    // somewhere else — or not read at all, which is how it froze before.
    expect(shipped.version).toBe(declared().version);
  });

  it('was cut at the number of items the pack actually ships', () => {
    expect(
      shippedItems,
      `content/es/pack.tsv says version ${declared().version} was cut at ${declared().items} items,` +
        ` but the pack ships ${shippedItems}. Bump the version and record ${shippedItems}.`,
    ).toBe(declared().items);
  });

  it('is not the version the literal was frozen at', () => {
    // Belt and braces, and cheap: 0.1.0 is what four expansions shipped under.
    // If this pack is ever legitimately 0.1.0 again, something is very wrong.
    expect(declared().version).not.toBe('0.1.0');
  });
});

/**
 * The levels the manifest advertises, which used to be the literal
 * `levels: ['a1', 'a2']` beside the name `Spanish Core A1–A2`.
 *
 * `courseOptions` derives a course's levels from the items, so the picker would
 * have grown a B1 entry on its own the day B1 content arrived. The manifest
 * would have gone on claiming A1–A2 — and `PackSettings` reads the manifest, so
 * the pack would have advertised a scope it no longer had, on the one screen
 * whose job is describing the pack. Exactly the failure the version above was.
 */
describe('the levels the manifest advertises', () => {
  const levelsOfShippedItems = () => {
    const items = ['sentences', 'vocabulary'].flatMap((kind) =>
      packFiles(join(repoRoot, 'public/packs'), kind).flatMap((path) =>
        readJsonl<{ level?: string }>(path),
      ),
    );
    return [...new Set(items.map((item) => item.level).filter(Boolean))].sort();
  };

  it('are the levels the pack actually holds', () => {
    expect([...(shipped.levels ?? [])].sort()).toEqual(levelsOfShippedItems());
  });

  it('name the pack after the span they cover', () => {
    const levels = shipped.levels ?? [];
    const first = levels[0]?.toUpperCase();
    const last = levels[levels.length - 1]?.toUpperCase();
    expect(shipped.name).toContain(first === last ? String(first) : `${first}–${last}`);
  });

  it('grow when a higher level arrives, with no edit to the build', () => {
    const scratch = createScratchPack('pack-levels');
    try {
      scratch.append(
        'sentences-core.tsv',
        [
          'Habría venido si me lo hubieras dicho.',
          'I would have come if you had told me.',
          'b1',
          'core',
        ].join('	'),
      );
      scratch.build();

      const grown = JSON.parse(
        readFileSync(packManifestPath(scratch.packs), 'utf8'),
      ) as PackManifest;

      expect(grown.levels).toContain('b1');
      expect(grown.name).toContain('A1–B1');
    } finally {
      scratch.dispose();
    }
  });
});

describe('the guard against it freezing again', () => {
  const scratch = createScratchPack('pack-version');
  afterAll(() => scratch.dispose());

  it('names the disagreement when content is added without a bump', () => {
    scratch.append(
      'sentences-core.tsv',
      ['Esto es una frase de prueba.', 'This is a test sentence.', 'a1', 'core'].join('\t'),
    );

    const output = scratch.build();

    // Reported rather than fatal on purpose: the new count is not knowable until
    // the build has run, so failing here would withhold the number the author is
    // being asked for. `npm run check` is where it stops being advisory.
    expect(output).toContain('bump the version');
    expect(output).toMatch(/was cut at \d+ items, and this build has \d+/);
  });

  it('refuses a version that is not semver', () => {
    scratch.write('pack.tsv', 'version-two\t2022\tnot a version\n');
    const { ok, output } = scratch.tryBuild();

    expect(ok).toBe(false);
    expect(output).toContain('is not a semver version');
  });

  it('refuses an item count that is not a number', () => {
    scratch.write('pack.tsv', '0.2.0\tlots\tnot a count\n');
    const { ok, output } = scratch.tryBuild();

    expect(ok).toBe(false);
    expect(output).toContain('is not an item count');
  });
});
