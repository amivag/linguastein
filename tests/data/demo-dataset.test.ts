/** The shipped demo dataset must always load cleanly (spec §31 step 7). */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadCatalog, loadPack, type DatasetSource } from '../../src/data/loaders';
import { ContentRepository } from '../../src/domain/content';

const root = resolve(process.cwd(), 'public/demo-data');
const source: DatasetSource = {
  name: root,
  read: (path) => readFile(resolve(root, path), 'utf8'),
};

describe('demo dataset', () => {
  it('loads every pack in the catalog with no errors or warnings', async () => {
    const catalog = await loadCatalog(source);
    expect(catalog.packs.length).toBeGreaterThan(0);

    for (const entry of catalog.packs) {
      const { pack, issues } = await loadPack(source, entry.manifest);
      expect(issues, `${entry.id}: ${issues.map((issue) => issue.message).join(', ')}`).toEqual([]);
      expect(pack.items.length).toBeGreaterThan(0);
    }
  });

  it('exposes practisable content once indexed', async () => {
    const catalog = await loadCatalog(source);
    const loaded = await Promise.all(
      catalog.packs.map((entry) => loadPack(source, entry.manifest)),
    );
    const repository = ContentRepository.from(loaded.map((result) => result.pack));

    expect(repository.itemCount).toBeGreaterThanOrEqual(10);
    // Every item is translatable into the first reference language.
    for (const item of repository.allItems()) {
      expect(repository.translationOf(item.id, 'en'), item.id).toBeDefined();
    }
  });
});
