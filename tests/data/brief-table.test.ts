/**
 * The measurement table in `docs/tasks/dataset-expansion.md`, held against the
 * pack it claims to measure.
 *
 * That table is the first thing §1 of the brief tells a fresh session to read,
 * and it went stale **four times** during a single day of content work — every
 * time because content landed and the paragraph describing it did not. Once it
 * said 1,028 items where the pack held 2,022, which would have sent someone to
 * write the 449 sentences §3.1 asks for on top of 800 that already existed.
 *
 * `doc-stats.test.ts` cannot cover this file: it matches `<number> sentences`
 * anywhere in a document, and this brief legitimately discusses `6 sentences`
 * (the recycling target), `800 sentences` (a historical figure) and `442 items`
 * (an address count). Every one of those would fail as a false claim.
 *
 * So this reads the *table* instead, which has a fixed shape, and only the rows
 * whose value is a number the build can recompute. Prose is left alone — a
 * sentence that has aged is a judgment call, a table cell that disagrees with
 * the pack is a defect.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { packFile, readJsonl, repoRoot } from '../fixtures/dataset';

const PACKS = join(repoRoot, 'public/packs');
const BRIEF = 'docs/tasks/dataset-expansion.md';

interface Item {
  readonly type?: string;
  readonly text: string;
  readonly register?: string;
  readonly address?: string;
  readonly regions?: readonly string[];
  readonly tokens?: readonly { readonly pos?: string; readonly lexeme?: string }[];
}

const sentences = readJsonl<Item>(packFile(PACKS, 'sentences'));
const cards = readJsonl<Item>(packFile(PACKS, 'vocabulary'));
const passages = readJsonl<{ kind: string }>(packFile(PACKS, 'passages'));

const words = sentences.reduce((total, item) => total + item.text.split(/\s+/).length, 0);
const tokens = sentences.flatMap((item) => (item.tokens ?? []).filter((t) => t.pos !== 'PUNCT'));

/**
 * Lexemes, and how many sentences each is met in.
 *
 * Three of the rows below are about *encounters* rather than volume, and they are
 * the reason this block exists: they were the rows that drifted while the volume
 * ones stayed right, because nothing recomputed them.
 */
const lexemeIds = new Set(
  (['nouns', 'verbs', 'modifiers'] as const).flatMap((kind) =>
    readJsonl<{ id: string }>(packFile(PACKS, kind)).map((lexeme) => lexeme.id),
  ),
);
const encounters = new Map<string, number>();
for (const token of tokens) {
  if (token.lexeme === undefined) continue;
  encounters.set(token.lexeme, (encounters.get(token.lexeme) ?? 0) + 1);
}
const met = (test: (count: number) => boolean) =>
  [...lexemeIds].filter((id) => test(encounters.get(id) ?? 0)).length;

/**
 * Label in the first column → the figure the pack actually has.
 *
 * Deliberately a subset. A row is here when the build can recompute it from the
 * shipped files without reimplementing half of `build-dataset.ts` — which would
 * make the test a second source of truth rather than a check on the first.
 */
const CHECKED: Record<string, number> = {
  'Practisable items': sentences.length + cards.length,
  '— sentences and phrases': sentences.length,
  '— word cards': cards.length,
  Lexemes: lexemeIds.size,
  'Running words of Spanish': words,
  'Multi-sentence texts': passages.length,
  'Tokens linked to a lexeme': tokens.filter((t) => t.lexeme !== undefined).length,
  'Lexemes appearing in ≥1 sentence': met((count) => count >= 1),
  'Lexemes appearing in exactly one': met((count) => count === 1),
  'Lexemes with ≥6 encounters': met((count) => count >= 6),
  'Questions / statements': sentences.filter((item) => item.text.includes('¿')).length,
  // Sentences only, not word cards: three cards carry a register and the row has
  // always meant the sentences. Pinned here so the convention stops being a guess
  // — this row said 1,084 against an actual 1,085 for exactly as long as nothing
  // recomputed it.
  'Items marked with register': sentences.filter((item) => item.register).length,
  'Items marked with address (tú/usted)': sentences.filter((item) => item.address).length,
  // …and this one *is* every item, which is the other half of the same lesson:
  // two adjacent rows counted different populations and neither said so.
  'Items marked with a region': [...sentences, ...cards].filter((item) => item.regions?.length)
    .length,
  'Items containing `¡`': sentences.filter((item) => item.text.includes('¡')).length,
};

/** The first number in a cell — `**8,900 (~74 minutes of reading)**` → 8900. */
function firstNumber(cell: string): number | undefined {
  const match = /(\d[\d,]*)/.exec(cell);
  return match ? Number(match[1]!.replace(/,/g, '')) : undefined;
}

function tableRows(): Map<string, string> {
  const text = readFileSync(join(repoRoot, BRIEF), 'utf8');
  const rows = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith('|')) continue;
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.length !== 2) continue;
    rows.set(cells[0]!.replace(/\*/g, ''), cells[1]!);
  }
  return rows;
}

describe(`the measurement table in ${BRIEF}`, () => {
  const rows = tableRows();

  it('has the rows this test knows how to check', () => {
    // Guards the guard: a renamed label would otherwise make every case below
    // vacuously pass, which is how a stale table survives a test that watches it.
    for (const label of Object.keys(CHECKED)) {
      expect(rows.has(label), `no table row labelled "${label}"`).toBe(true);
    }
  });

  it.each(Object.entries(CHECKED))('quotes %s as the pack has it', (label, actual) => {
    expect(firstNumber(rows.get(label) ?? ''), label).toBe(actual);
  });

  it('states the pack version it was measured against', () => {
    const text = readFileSync(join(repoRoot, BRIEF), 'utf8');
    const declared = readFileSync(join(repoRoot, 'content/es/pack.tsv'), 'utf8')
      .split(/\r?\n/)
      .find((line) => line.trim().length > 0 && !line.startsWith('#'))
      ?.split('\t')[0];

    // The stamp drifting from the numbers is exactly what happened: the version
    // was updated in one pass and the figures in another.
    expect(text).toContain(`against pack \`${declared}\``);
  });
});
