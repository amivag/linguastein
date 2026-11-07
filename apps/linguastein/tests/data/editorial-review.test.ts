/**
 * Editorial sign-off (`content/es/reviewed.tsv`).
 *
 * The pack is machine-generated and ships `review: unreviewed`. Review has to be
 * incremental — nobody reads a thousand items in one sitting — so sign-off is per
 * item, and it has to be hard to claim by accident: an id deliberately survives
 * a typo fix, so approval must be pinned to the wording that was actually read.
 *
 * These build a scratch copy of `content/es`, so they exercise the real script
 * without touching the checked-in pack.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createScratchPack, type ScratchPack } from '../fixtures/dataset';

const REVIEWED = 'reviewed.tsv';
const SIGNED_OFF = ['000001', 'Hola, ¿cómo estás?', 'A. Editor', '2026-08-18'].join('\t');

let pack: ScratchPack;

function signOff(...rows: string[]): void {
  pack.write(REVIEWED, `# scratch\n${rows.join('\n')}\n`);
}

/**
 * How many items the build says it counted. Read back from the output rather
 * than hard-coded: these tests are about the sign-off machinery, and pinning the
 * pack's size here only made them fail every time content grew.
 */
function signedOff(output: string): string {
  return /(\d+\/\d+) items signed off/.exec(output)?.[1] ?? 'no count in output';
}

/** The sentence item with this local id, as the built pack holds it. */
function item(id: string): { provenance?: { review: string } } | undefined {
  return pack
    .records<{ id: string; provenance?: { review: string } }>('sentences')
    .find((record) => record.id === `core-es:item:${id}`);
}

beforeAll(() => {
  pack = createScratchPack('linguastein-review');
}, 120_000);

afterAll(() => {
  pack.dispose();
});

describe('an unreviewed pack', () => {
  it('marks no item reviewed and says so', () => {
    signOff();
    const { ok, output } = pack.tryBuild();

    expect(ok).toBe(true);
    expect(item('000001')?.provenance).toBeUndefined();
    expect(signedOff(output)).toMatch(/^0\/\d+$/);
    expect(output).toContain('unreviewed');
  });
});

describe('signing an item off', () => {
  it('marks that item reviewed in the pack, and only that item', () => {
    signOff(SIGNED_OFF);
    const { ok, output } = pack.tryBuild();

    expect(ok).toBe(true);
    expect(item('000001')?.provenance).toEqual({ source: 'generated', review: 'reviewed' });
    expect(item('000002')?.provenance).toBeUndefined();
    expect(signedOff(output)).toMatch(/^1\/\d+$/);
  });
});

describe('sign-off that can no longer be trusted', () => {
  /** The whole reason the approved wording is recorded next to the id. */
  it('fails the build when the row changed after it was signed off', () => {
    signOff(['000001', 'Hola, ¿qué tal?', 'A. Editor', '2026-08-18'].join('\t'));
    const { ok, output } = pack.tryBuild();

    expect(ok).toBe(false);
    expect(output).toContain('changed after sign-off');
    expect(output).toContain('000001');
  });

  it('fails the build when the item it refers to is gone', () => {
    signOff(['999999', 'Whatever this was', 'A. Editor', '2026-08-18'].join('\t'));
    const { ok, output } = pack.tryBuild();

    expect(ok).toBe(false);
    expect(output).toContain('no item claims that id');
  });

  it('fails the build when nobody put their name to it', () => {
    signOff(['000001', 'Hola, ¿cómo estás?', '', '2026-08-18'].join('\t'));
    const { ok, output } = pack.tryBuild();

    expect(ok).toBe(false);
    expect(output).toContain('no reviewer');
  });
});
