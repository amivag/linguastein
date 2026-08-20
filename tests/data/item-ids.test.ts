/**
 * Item ids must survive editing the sources, because learner progress, attempt
 * history and mastery all reference them (spec §20). Ids used to be row
 * positions, so inserting one sentence repointed every later id at a different
 * sentence — and every learner's history with it.
 *
 * These tests build a scratch copy of `content/es`, so they exercise the real
 * script without touching the checked-in pack.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createScratchPack, type ScratchPack } from '../fixtures/dataset';

const SENTENCES = 'sentences-core.tsv';

let pack: ScratchPack;

/** Item text → id, for every practisable item in the built pack. */
function itemsByText(): Map<string, string> {
  const items = new Map<string, string>();
  for (const file of ['es-a1-a2-core-sentences.jsonl', 'es-a1-a2-core-vocabulary.jsonl']) {
    for (const record of pack.records<{ id: string; text: string }>(file)) {
      items.set(record.text, record.id);
    }
  }
  return items;
}

beforeAll(() => {
  pack = createScratchPack('linguastein-ids');
  pack.build();
}, 120_000);

afterAll(() => {
  pack.dispose();
});

describe('item ids', () => {
  it('are unchanged by a second build', () => {
    const before = itemsByText();
    pack.build();
    expect(itemsByText()).toEqual(before);
  });

  it('survive a row inserted at the top of a source file', () => {
    const before = itemsByText();
    const lines = pack.read(SENTENCES).split('\n');
    // After the header comment, i.e. ahead of every existing sentence.
    lines.splice(1, 0, 'Hasta luego.\tSee you later.\ta1\tgreetings');
    pack.write(SENTENCES, lines.join('\n'));

    pack.build();
    const after = itemsByText();

    for (const [text, id] of before) {
      expect(after.get(text), `id moved for "${text}"`).toBe(id);
    }
    expect(after.get('Hasta luego.')).toBeDefined();
    expect(after.size).toBe(before.size + 1);
  });

  it('are written back into the source row that owns them', () => {
    const inserted = pack
      .read(SENTENCES)
      .split('\n')
      .find((line) => line.includes('Hasta luego.'));

    // The build assigns the id and records it in the row, which is what makes a
    // later typo fix or reordering keep it.
    expect(inserted).toMatch(/^\d{6}\tHasta luego\./);
  });

  it('retire rather than reuse the id of a deleted row', () => {
    const removed = itemsByText().get('Hasta luego.');
    expect(removed).toBeDefined();

    const kept = pack
      .read(SENTENCES)
      .split('\n')
      .filter((line) => !line.includes('Hasta luego.'));
    // Add a different sentence in the same breath, so something needs a new id.
    kept.splice(1, 0, 'Nos vemos luego.\tSee you later.\ta1\tgreetings');
    pack.write(SENTENCES, kept.join('\n'));

    pack.build();

    const replacement = itemsByText().get('Nos vemos luego.');
    expect(replacement).toBeDefined();
    expect(replacement).not.toBe(removed);

    expect(pack.read('id-ledger.tsv')).toMatch(
      new RegExp(`^${removed!.replace(/^.*:/, '')}\\tsentence\\tretired`, 'm'),
    );
  });
});
