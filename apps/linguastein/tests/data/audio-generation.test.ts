/**
 * The audio generator's load-bearing rules, from docs/tasks/canonical-audio.md.
 *
 * Each of these fails silently in production if it regresses: a stale clip goes
 * on speaking the old text, a duplicate is synthesised twice with two slightly
 * different readings, or an interrupted batch restarts from nothing. None of
 * them are visible without a test, so they get one.
 *
 * The `stub` provider makes this runnable with no TTS installed: it writes a
 * padded tone rather than speech, which is enough to exercise naming, hashing,
 * the ledger and resumption.
 */

import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { packFile, repoRoot, runScript } from '../fixtures/dataset';

let out: string;

/** Runs the generator against a scratch output directory. */
function generate(...args: string[]): string {
  return generateFrom(undefined, ...args);
}

/** As `generate`, but reading a scratch copy of the packs directory. */
function generateFrom(packs: string | undefined, ...args: string[]): string {
  return runScript('scripts/generate-audio.ts', {
    args: ['--out', out, '--raw', ...args],
    env: { LINGUASTEIN_NOW: '2026-01-01', ...(packs ? { LINGUASTEIN_PACKS_DIR: packs } : {}) },
  });
}

const ledgerPath = () => join(out, 'audio-ledger.tsv');

/** The ledger's data rows, split into fields. */
function ledgerRows(): string[][] {
  return readFileSync(ledgerPath(), 'utf8')
    .split('\n')
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .map((line) => line.split('\t'));
}

const clips = (voice = 'v1'): string[] => readdirSync(join(out, 'es-ES', voice));

beforeEach(() => {
  out = mkdtempSync(join(tmpdir(), 'linguastein-audio-'));
});

afterEach(() => {
  rmSync(out, { recursive: true, force: true });
});

// Every test spawns the real script through tsx, so each one pays a node and a
// TypeScript startup before it does any work — far past the 5 s default once the
// rest of the suite is running alongside it.
describe('audio generation', { timeout: 120_000 }, () => {
  it('names a clip for the hash of what it says, not the item alone', () => {
    generate('--sample', '--provider', 'stub', '--voice', 'v1');

    // Every filename is `<item>-<8 hex>.wav`. The hash is what makes a corrected
    // sentence produce a different file rather than reusing the stale one.
    for (const file of clips()) {
      expect(file).toMatch(/^\d{6}-[0-9a-f]{8}\.wav$/);
    }
    expect(clips()).toHaveLength(20);
  });

  it('is idempotent: a second run with nothing changed does no work', () => {
    generate('--sample', '--provider', 'stub', '--voice', 'v1');
    const before = ledgerRows().length;

    const output = generate('--sample', '--provider', 'stub', '--voice', 'v1');

    expect(output).toContain('0 clip(s) to synthesise');
    expect(ledgerRows()).toHaveLength(before);
    expect(clips()).toHaveLength(20);
  });

  it('resumes: --limit leaves the rest for the next run', () => {
    const first = generate('--sample', '--provider', 'stub', '--voice', 'v1', '--limit', '5');

    expect(first).toContain('15 clip(s) beyond --limit');
    expect(clips()).toHaveLength(5);

    generate('--sample', '--provider', 'stub', '--voice', 'v1');

    expect(clips()).toHaveLength(20);
    expect(ledgerRows()).toHaveLength(20);
  });

  it('regenerates when the ledger no longer matches the text', () => {
    generate('--items', '000001', '--provider', 'stub', '--voice', 'v1');
    const [row] = ledgerRows();
    const trueHash = row?.[3];
    expect(trueHash).toMatch(/^[0-9a-f]{8}$/);

    // Stand in for a typo fix: the item keeps its id, so the hash is the only
    // thing that moves. Nothing else in the system would notice the difference,
    // which is exactly why the hash is what a clip is keyed on.
    writeFileSync(
      ledgerPath(),
      readFileSync(ledgerPath(), 'utf8').replace(trueHash ?? '', 'deadbeef'),
      'utf8',
    );

    const output = generate('--items', '000001', '--provider', 'stub', '--voice', 'v1');

    expect(output).toContain('1 clip(s) to synthesise');
    // The rewritten row is left alone and a fresh one is appended against the
    // hash the text actually has, so the build can tell current from stale.
    expect(ledgerRows().map((each) => each[3])).toEqual(['deadbeef', trueHash]);
  });

  /**
   * `core-es` used to ship `frío` as both a noun card and an adjective card, and
   * that pair was this test's subject. The build now rejects two items with the
   * same text, so the case can only arrive in an imported pack — which is still
   * worth handling, because synthesising it twice buys two slightly different
   * readings of one word. Hence a scratch pack with the collision planted in it.
   */
  it('synthesises identical text once, and records it for both items', () => {
    const packs = mkdtempSync(join(tmpdir(), 'linguastein-audio-pack-'));
    try {
      cpSync(join(repoRoot, 'public/packs'), packs, { recursive: true });
      const vocabulary = packFile(packs, 'vocabulary');
      const lines = readFileSync(vocabulary, 'utf8').trimEnd().split('\n');
      const original = JSON.parse(lines.at(-1)!) as { id: string; text: string };
      const twin = { ...original, id: 'core-es:item:900001' };
      writeFileSync(vocabulary, `${lines.join('\n')}\n${JSON.stringify(twin)}\n`, 'utf8');

      const ids = `${original.id.replace('core-es:item:', '')},900001`;
      const output = generateFrom(packs, '--items', ids, '--provider', 'stub', '--voice', 'v1');

      expect(output).toContain("1 item(s) reuse another item's clip");
      expect(clips()).toHaveLength(1);

      const rows = ledgerRows();
      expect(rows).toHaveLength(2);
      expect(rows[0]?.[3]).toBe(rows[1]?.[3]); // same text hash
      expect(rows[0]?.[4]).toBe(rows[1]?.[4]); // and the same file
    } finally {
      rmSync(packs, { recursive: true, force: true });
    }
  });

  it('regenerates what a reviewer rejected, and nothing else', () => {
    generate('--sample', '--provider', 'stub', '--voice', 'v1');
    const rows = ledgerRows();

    const rejected = rows[0]?.[0];
    writeFileSync(
      ledgerPath(),
      `${rows.map((row, at) => (at === 0 ? [...row.slice(0, 7), 'redo'] : row).join('\t')).join('\n')}\n`,
      'utf8',
    );

    const output = generate('--sample', '--provider', 'stub', '--voice', 'v1');

    expect(output).toContain('1 clip(s) to synthesise');
    expect(
      ledgerRows().filter((row) => row[0] === rejected && row[7] === 'unreviewed'),
    ).toHaveLength(1);
  });

  it('refuses to speak a language the provider has no voice for', () => {
    // Silence with an explanation is the deliberate behaviour throughout the
    // app; the generator must not be the one place that guesses instead.
    expect(() =>
      generate(
        '--items',
        '000001',
        '--provider',
        'sapi',
        '--voice',
        'default',
        '--locale',
        'es-ES',
      ),
    ).toThrow(/no installed SAPI voice speaks es-ES|SAPI is Windows-only/);
  });
});
