/** Every pack the build ships must load cleanly and be practisable. */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadCatalog, loadPack, type DatasetSource } from '../../src/data/loaders';
import { ContentRepository } from '../../src/domain/content';

const root = resolve(process.cwd(), 'public/packs');
const source: DatasetSource = {
  name: root,
  read: (path) => readFile(resolve(root, path), 'utf8'),
};

async function loadAll() {
  const catalog = await loadCatalog(source);
  const loaded = await Promise.all(catalog.packs.map((entry) => loadPack(source, entry.manifest)));
  return {
    catalog,
    issues: loaded.flatMap((result) => result.issues),
    repository: ContentRepository.from(loaded.map((result) => result.pack)),
  };
}

describe('shipped packs', () => {
  it('load with no errors or warnings', async () => {
    const { catalog, issues } = await loadAll();
    expect(catalog.packs.length).toBeGreaterThan(0);
    expect(issues.map((issue) => `${issue.source}: ${issue.message}`)).toEqual([]);
  });

  it('carry enough content for real sessions', async () => {
    const { repository } = await loadAll();

    expect(repository.itemCount).toBeGreaterThan(700);
    expect(repository.query({ types: ['word'] }).length).toBeGreaterThan(300);
    expect(repository.query({ types: ['sentence', 'phrase'] }).length).toBeGreaterThan(400);
  });

  it('translate every item into the first reference language', async () => {
    const { repository } = await loadAll();
    const untranslated = repository
      .allItems()
      .filter((item) => repository.translationOf(item.id, 'en') === undefined);

    expect(untranslated.map((item) => item.id)).toEqual([]);
  });

  it('give every verb a full set of generated forms', async () => {
    const { repository } = await loadAll();
    const verbs = repository.query().flatMap((item) => item.lexemes ?? []);
    const tener = [...new Set(verbs)].find((id) => id.endsWith(':lexeme:tener'));
    expect(tener).toBeDefined();

    const forms = repository.verbFormsOf(tener!).map((form) => form.form);
    expect(forms).toContain('tengo');
    expect(forms).toContain('tuvimos');
    expect(forms).toContain('tenía');
    expect(forms).toContain('teniendo');
  });

  it('link sentence tokens to lexemes so words can be inspected', async () => {
    const { repository } = await loadAll();
    const sentences = repository.query({ types: ['sentence'] });
    const tokens = sentences.flatMap((item) => item.tokens ?? []);
    const words = tokens.filter((token) => token.pos !== 'PUNCT');
    const linked = words.filter((token) => token.lexeme !== undefined);

    // A dataset where words are not linked cannot support word inspection.
    expect(linked.length / words.length).toBeGreaterThan(0.9);
  });

  it('give every lexeme a word-level gloss', async () => {
    const { repository } = await loadAll();
    const lexemes = new Set(repository.query().flatMap((item) => item.lexemes ?? []));
    const missing = [...lexemes].filter((id) => repository.translationOf(id, 'en') === undefined);

    expect(missing).toEqual([]);
  });
});
