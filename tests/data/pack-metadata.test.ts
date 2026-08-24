/**
 * The metadata that makes a pack an identifiable add-on rather than an anonymous
 * blob of content: who made it, which cut it is, and how old that cut is.
 *
 * `version` already existed and is held to the item count by
 * `pack-version.test.ts`. These are the other two, and the interesting one is the
 * date: it is **authored, not stamped**. A date read from the clock at build time
 * would change on every build, and CI fails when a rebuild changes
 * `public/packs` — so stamping it would turn the drift check into noise. Authoring
 * costs nothing extra, because the item-count guard already forces an edit to
 * `pack.tsv` whenever content moves, which is exactly when the date should change.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { PackManifest } from '../../src/domain/content';
import { createScratchPack, repoRoot, type ScratchPack } from '../fixtures/dataset';

const shipped = JSON.parse(
  readFileSync(join(repoRoot, 'public/packs/core-es/pack.json'), 'utf8'),
) as PackManifest;

/** The first data row of `content/es/pack.tsv`, which owns the version and date. */
function versionRow(pack: ScratchPack): string[] {
  const row = pack
    .read('pack.tsv')
    .split(/\r?\n/)
    .find((line) => line.trim().length > 0 && !line.startsWith('#'));
  return (row ?? '').split('\t');
}

function setVersionRow(pack: ScratchPack, index: number, value: string) {
  const lines = pack.read('pack.tsv').split(/\r?\n/);
  const at = lines.findIndex((line) => line.trim().length > 0 && !line.startsWith('#'));
  const cells = lines[at]!.split('\t');
  cells[index] = value;
  lines[at] = cells.join('\t');
  pack.write('pack.tsv', lines.join('\n'));
}

describe('the shipped pack states who made it and when', () => {
  it('carries the date its version was cut', () => {
    expect(shipped.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('carries the date the source authored, rather than the day of the build', () => {
    // The point of the whole design. If these ever disagree, something started
    // reading the clock and the drift check has stopped meaning anything.
    const authored = readFileSync(join(repoRoot, 'content/es/pack.tsv'), 'utf8')
      .split(/\r?\n/)
      .find((line) => line.trim().length > 0 && !line.startsWith('#'))
      ?.split('\t')[2];

    expect(shipped.updated).toBe(authored);
  });

  it('credits its contributors, with what each of them did', () => {
    expect(shipped.authors?.length).toBeGreaterThan(0);
    for (const author of shipped.authors ?? []) {
      expect(author.name.length).toBeGreaterThan(0);
    }
  });

  /**
   * The rule `voices.tsv` and the `review` field already follow: generated
   * material stays distinguishable from written material. A pack marked
   * `generated` that credited only humans would be claiming authorship for a
   * model's output.
   */
  it('names the generation when the pack is generated', () => {
    expect(shipped.provenance?.source).toBe('generated');
    const roles = (shipped.authors ?? []).map((author) => author.role);
    expect(roles).toContain('generation');
  });
});

describe('the guards on that metadata', () => {
  let scratch: ScratchPack | undefined;

  afterEach(() => {
    scratch?.dispose();
    scratch = undefined;
  });

  it('refuses a date that is not a date', () => {
    scratch = createScratchPack('meta-shape');
    setVersionRow(scratch, 2, 'last Tuesday');

    const { ok, output } = scratch.tryBuild();
    expect(ok).toBe(false);
    expect(output).toContain('is not a real YYYY-MM-DD date');
  });

  it('refuses a day that does not exist', () => {
    scratch = createScratchPack('meta-impossible');
    // Matches the pattern and is not a date. A shape check alone would pass it,
    // which is why the guard round-trips through `Date` instead.
    setVersionRow(scratch, 2, '2026-02-31');

    const { ok, output } = scratch.tryBuild();
    expect(ok).toBe(false);
    expect(output).toContain('is not a real YYYY-MM-DD date');
  });

  it('refuses a date in the future', () => {
    scratch = createScratchPack('meta-future');
    setVersionRow(scratch, 2, '2099-01-01');

    // Almost always a typo for next month, and a pack claiming to be newer than
    // it is cannot be reasoned about at all.
    const { ok, output } = scratch.tryBuild();
    expect(ok).toBe(false);
    expect(output).toContain('is in the future');
  });

  it('refuses a version row with no date at all', () => {
    scratch = createScratchPack('meta-missing');
    setVersionRow(scratch, 2, '');

    const { ok, output } = scratch.tryBuild();
    expect(ok).toBe(false);
    expect(output).toContain('no updated date');
  });

  it('still ships a pack whose authors file is absent', () => {
    scratch = createScratchPack('meta-no-authors');
    scratch.write('authors.tsv', '# nobody declared\n');

    // Optional on purpose: a pack that has not decided who to credit should ship
    // without the field rather than with an invented one.
    const { ok } = scratch.tryBuild();
    expect(ok).toBe(true);
    const manifest = JSON.parse(
      readFileSync(join(scratch.packs, 'core-es/pack.json'), 'utf8'),
    ) as PackManifest;
    expect(manifest.authors).toBeUndefined();
  });

  it('refuses an author row with no name', () => {
    scratch = createScratchPack('meta-nameless');
    scratch.append('authors.tsv', '\tcontent\thttps://example.com');

    const { ok, output } = scratch.tryBuild();
    expect(ok).toBe(false);
    expect(output).toContain('a row with no name');
  });

  it('keeps the date on the same row as the version it describes', () => {
    scratch = createScratchPack('meta-row');
    const cells = versionRow(scratch);

    // Deliberate: the item-count guard forces an edit to this row whenever
    // content moves, so the date is under the author's eye at the one moment it
    // needs changing. On a separate row it would drift.
    expect(cells.length).toBeGreaterThanOrEqual(3);
    expect(cells[2]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
