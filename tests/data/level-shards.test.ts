/**
 * A course is a ceiling, so a pack is fetched up to one.
 *
 * `sentences` is 3.6 MB, `forms` 1.8 MB and `vocabulary` 174 KB — 87% of the pack
 * in three files, and an A1 learner has no use for the B1 corpus at boot.
 * `docs/tasks/language-matrix.md` §5 asks for one shard per level so a loader can
 * decline to fetch what the course cannot show; the manifest names each shard's
 * level so it can decide without opening the file.
 *
 * The half worth testing is not that fewer bytes arrive — that is arithmetic —
 * but that a **partly loaded pack is a valid one**. Every cross-record check in
 * `validatePackIntegrity` reads as a defect when a shard is missing: a B1 passage
 * naming B1 sentences looks exactly like a broken passage. Reporting those would
 * teach a reader to ignore the issue list, which is worse than not having one.
 */

import { describe, expect, it } from 'vitest';
import { loadPack } from '../../src/data/loaders';
import type { DatasetSource } from '../../src/data/loaders';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { packManifestPath, repoRoot } from '../fixtures/dataset';

const PACKS = join(repoRoot, 'public/packs');
const MANIFEST = packManifestPath(PACKS)
  .slice(PACKS.length + 1)
  .replaceAll('\\', '/');

/** Reads the shipped pack off disk, and remembers what was asked for. */
function diskSource(): DatasetSource & { readonly fetched: string[] } {
  const fetched: string[] = [];
  return {
    name: PACKS,
    fetched,
    async read(path: string) {
      fetched.push(path);
      return readFileSync(join(PACKS, path), 'utf8');
    },
  };
}

describe('loading a pack up to a level', () => {
  it('fetches the shards at or below the ceiling, and every unsharded file', async () => {
    const source = diskSource();
    await loadPack(source, MANIFEST, { upTo: 'a1' });

    const shards = source.fetched.filter((path) => /-(a1|a2|b1)\.jsonl$/.test(path));
    expect(shards.every((path) => path.endsWith('-a1.jsonl'))).toBe(true);
    // Three kinds are sharded, so three shards at a ceiling of a1.
    expect(shards).toHaveLength(3);
    // And the small files come whatever the course is: they carry no level, and
    // translations could not carry one — a translation references an item, a
    // lexeme or a skill, so its level is a join rather than a field.
    expect(source.fetched.some((path) => path.endsWith('-translations-en.jsonl'))).toBe(true);
    expect(source.fetched.some((path) => path.endsWith('-passages.jsonl'))).toBe(true);
  });

  it('reports a partial pack as valid, rather than as a broken one', async () => {
    // The load-bearing assertion. A B1 passage names B1 sentences that were not
    // fetched, which every cross-record check reads as a dangling reference.
    const { issues, partial } = await loadPack(diskSource(), MANIFEST, { upTo: 'a1' });

    expect(partial).toBe(true);
    expect(issues.filter((issue) => issue.severity === 'error')).toEqual([]);
  });

  it('still checks what one record can be wrong about on its own', async () => {
    // Skipping *cross-record* checks is not skipping validation: a duplicate id,
    // a mislabelled pack or an annotation pointing at a token that is not in its
    // own sentence are all still findings, because none of them needs the rest of
    // the pack to be true.
    const { issues } = await loadPack(diskSource(), MANIFEST, { upTo: 'a1' });
    expect(issues).toEqual([]);
  });

  it('loads the whole pack when no ceiling is named, and calls it whole', async () => {
    const source = diskSource();
    const { pack, partial } = await loadPack(source, MANIFEST);

    expect(partial).toBe(false);
    expect(source.fetched.filter((path) => /-(a1|a2|b1)\.jsonl$/.test(path))).toHaveLength(9);
    expect(pack.items.length).toBeGreaterThan(3000);
  });

  it('narrows the content, not only the requests', async () => {
    const a1 = await loadPack(diskSource(), MANIFEST, { upTo: 'a1' });
    const all = await loadPack(diskSource(), MANIFEST, { upTo: 'all' });

    expect(a1.pack.items.every((item) => item.level === 'a1')).toBe(true);
    expect(a1.pack.items.length).toBeLessThan(all.pack.items.length);
    // `all` is the unnarrowed scope and has to mean the whole pack, not an empty
    // one — the same value `resolveCourse` degrades a stale level to.
    expect(all.pack.items.length).toBe((await loadPack(diskSource(), MANIFEST)).pack.items.length);
  });
});
