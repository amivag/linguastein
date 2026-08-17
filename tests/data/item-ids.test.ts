/**
 * Item ids must survive editing the sources, because learner progress, attempt
 * history and mastery all reference them (spec §20). Ids used to be row
 * positions, so inserting one sentence repointed every later id at a different
 * sentence — and every learner's history with it.
 *
 * These tests build a scratch copy of `content/es`, so they exercise the real
 * script without touching the checked-in pack.
 */

import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = resolve(process.cwd());
let workspace: string;
let content: string;
let packs: string;

/** Runs the dataset build against the scratch copy. */
function build(): void {
  execFileSync(process.execPath, ['--import', 'tsx', join(root, 'scripts/build-dataset.ts')], {
    cwd: root,
    env: { ...process.env, LINGO_CONTENT_DIR: content, LINGO_PACKS_DIR: packs },
    stdio: 'pipe',
  });
}

/** Item id → text, for every practisable item in the built pack. */
function itemsByText(): Map<string, string> {
  const items = new Map<string, string>();
  for (const file of ['es-a1-a2-core-sentences.jsonl', 'es-a1-a2-core-vocabulary.jsonl']) {
    for (const line of readFileSync(join(packs, 'core-es', file), 'utf8').split('\n')) {
      if (line.trim().length === 0 || line.startsWith('#')) continue;
      const record = JSON.parse(line) as { id: string; text: string };
      items.set(record.text, record.id);
    }
  }
  return items;
}

const sentenceFile = () => join(content, 'sentences-core.tsv');

beforeAll(() => {
  workspace = mkdtempSync(join(tmpdir(), 'lingo-ids-'));
  content = join(workspace, 'content');
  packs = join(workspace, 'packs');
  cpSync(join(root, 'content/es'), content, { recursive: true });
  build();
}, 120_000);

afterAll(() => {
  rmSync(workspace, { recursive: true, force: true });
});

describe('item ids', () => {
  it('are unchanged by a second build', () => {
    const before = itemsByText();
    build();
    expect(itemsByText()).toEqual(before);
  });

  it('survive a row inserted at the top of a source file', () => {
    const before = itemsByText();
    const lines = readFileSync(sentenceFile(), 'utf8').split('\n');
    // After the header comment, i.e. ahead of every existing sentence.
    lines.splice(1, 0, 'Hasta luego.\tSee you later.\ta1\tgreetings');
    writeFileSync(sentenceFile(), lines.join('\n'), 'utf8');

    build();
    const after = itemsByText();

    for (const [text, id] of before) {
      expect(after.get(text), `id moved for "${text}"`).toBe(id);
    }
    expect(after.get('Hasta luego.')).toBeDefined();
    expect(after.size).toBe(before.size + 1);
  });

  it('are written back into the source row that owns them', () => {
    const inserted = readFileSync(sentenceFile(), 'utf8')
      .split('\n')
      .find((line) => line.includes('Hasta luego.'));

    // The build assigns the id and records it in the row, which is what makes a
    // later typo fix or reordering keep it.
    expect(inserted).toMatch(/^\d{6}\tHasta luego\./);
  });

  it('retire rather than reuse the id of a deleted row', () => {
    const removed = itemsByText().get('Hasta luego.');
    expect(removed).toBeDefined();

    const kept = readFileSync(sentenceFile(), 'utf8')
      .split('\n')
      .filter((line) => !line.includes('Hasta luego.'));
    // Add a different sentence in the same breath, so something needs a new id.
    kept.splice(1, 0, 'Nos vemos luego.\tSee you later.\ta1\tgreetings');
    writeFileSync(sentenceFile(), kept.join('\n'), 'utf8');

    build();

    const replacement = itemsByText().get('Nos vemos luego.');
    expect(replacement).toBeDefined();
    expect(replacement).not.toBe(removed);

    const ledger = readFileSync(join(content, 'id-ledger.tsv'), 'utf8');
    expect(ledger).toMatch(
      new RegExp(`^${removed!.replace(/^.*:/, '')}\\tsentence\\tretired`, 'm'),
    );
  });
});
