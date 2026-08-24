/**
 * Topics are a controlled vocabulary, and the build is what enforces it.
 *
 * Before `topics.tsv` existed, a topic was whatever a row happened to type, so
 * `colours` and `colors` could both exist with half the content each and
 * neither look wrong in a diff. These tests hold the gate that stops that, and
 * the authoring order the category picker is built from.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PackManifest } from '../../src/domain/content';
import { createScratchPack, packFile, readJsonl, repoRoot } from '../fixtures/dataset';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

interface Item {
  readonly id: string;
  readonly topics?: readonly string[];
}

const shipped = JSON.parse(
  readFileSync(join(repoRoot, 'public/packs/core-es/pack.json'), 'utf8'),
) as PackManifest;

describe('the shipped topic registry', () => {
  it('declares every topic the content uses', () => {
    const declared = new Set((shipped.topics ?? []).map((topic) => topic.id));
    const used = new Set<string>();
    for (const kind of ['sentences', 'vocabulary']) {
      for (const item of readJsonl<Item>(packFile(join(repoRoot, 'public/packs'), kind))) {
        for (const topic of item.topics ?? []) used.add(topic);
      }
    }

    expect([...used].filter((topic) => !declared.has(topic))).toEqual([]);
  });

  it('gives every category a label and a group to be shown under', () => {
    const incomplete = (shipped.topics ?? []).filter((topic) => !topic.label || !topic.group);
    expect(incomplete).toEqual([]);
  });

  it('never declares the same slug twice', () => {
    const ids = (shipped.topics ?? []).map((topic) => topic.id);
    expect(ids).toHaveLength(new Set(ids).size);
  });

  it('leads with the categories a beginner asks for by name', () => {
    // The order is authored, not derived, so it is worth asserting: the whole
    // point of the picker is that `numbers` is not the 19th tile alphabetically.
    //
    // `alphabet` took the first tile when the letters arrived, ahead of
    // `numbers`, and that is the claim being pinned here rather than an
    // accident of where the rows were appended: the letters are what a written
    // language starts with, and a learner who cannot say `jota` cannot take a
    // surname down the phone however well they count.
    expect((shipped.topics ?? []).slice(0, 5).map((topic) => topic.id)).toEqual([
      'alphabet',
      'numbers',
      'clock',
      'days-of-week',
      'months',
    ]);
  });
});

describe('the build gate', () => {
  const pack = createScratchPack('topics');

  beforeAll(() => {
    pack.build();
  });

  afterAll(() => {
    pack.dispose();
  });

  it('rejects a topic that is not registered', () => {
    // Id column left off, per the authoring convention: the build assigns one.
    pack.append('nouns.tsv', ['sandía', 'watermelon', 'm', '', 'a1', 'fruit'].join('\t'));

    const { ok, output } = pack.tryBuild();
    expect(ok).toBe(false);
    expect(output).toContain('unknown topic "fruit"');
    // The message has to say where, or a typo in one of 1,000 rows is a hunt.
    expect(output).toContain('nouns.tsv');
  });

  it('accepts the same topic once it is registered', () => {
    pack.append('topics.tsv', ['fruit', 'Fruit', 'Everyday life'].join('\t'));

    expect(pack.tryBuild().ok).toBe(true);
    const manifest = JSON.parse(
      readFileSync(join(pack.packs, 'core-es', 'pack.json'), 'utf8'),
    ) as PackManifest;
    expect(manifest.topics?.at(-1)).toMatchObject({ id: 'fruit', label: 'Fruit' });
  });

  it('names the categories too thin to be worth opening', () => {
    // Reported rather than fatal: declaring a category before its content
    // exists is allowed, and the build output is where that debt stays visible.
    expect(pack.build()).toMatch(/under \d+ items:.*fruit \(1\)/);
  });
});
