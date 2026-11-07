import { describe, expect, it } from 'vitest';
import { loadCatalog, loadPack, memoryDatasetSource, parseJsonl } from '../../src/data/loaders';
import { hasErrors } from '../../src/data/validation';

const manifest = JSON.stringify({
  id: 'test-es',
  name: 'Test',
  targetLanguage: 'es',
  version: '1.0.0',
  files: [
    { kind: 'lexemes', path: 'lexemes.jsonl' },
    { kind: 'items', path: 'items.jsonl' },
    { kind: 'translations', path: 'translations.jsonl' },
  ],
});

const files = {
  'catalog.json': JSON.stringify({ packs: [{ id: 'test-es', manifest: 'pack.json' }] }),
  'pack.json': manifest,
  'lexemes.jsonl': '{"id":"test-es:lexeme:tener","lemma":"tener","pos":"VERB"}\n',
  'items.jsonl': [
    '# a comment line is ignored',
    '{"id":"test-es:item:001","pack":"test-es","type":"sentence","text":"Tengo que trabajar.","lexemes":["test-es:lexeme:tener"]}',
    '',
    '{"id":"test-es:item:002","pack":"test-es","type":"word","text":"cerveza"}',
  ].join('\n'),
  'translations.jsonl': '{"ref":"test-es:item:001","lang":"en","text":"I have to work."}\n',
};

describe('parseJsonl', () => {
  it('skips blanks and comments, and reports bad lines with line numbers', () => {
    const result = parseJsonl('{"a":1}\n\n# note\n{oops}\n', 'items.jsonl');
    expect(result.records).toHaveLength(1);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]?.line).toBe(4);
  });
});

describe('loadPack', () => {
  it('loads a valid pack without issues', async () => {
    const source = memoryDatasetSource(files);
    const catalog = await loadCatalog(source);
    expect(catalog.packs).toHaveLength(1);

    const { pack, issues } = await loadPack(source, catalog.packs[0]!.manifest);
    expect(issues).toEqual([]);
    expect(pack.items).toHaveLength(2);
    expect(pack.lexemes).toHaveLength(1);
    expect(pack.translations).toHaveLength(1);
  });

  it('skips invalid records but keeps the rest usable', async () => {
    const source = memoryDatasetSource({
      ...files,
      'items.jsonl':
        `{"id":"not-an-id","pack":"test-es","type":"sentence","text":"x"}\n` + files['items.jsonl'],
    });

    const { pack, issues } = await loadPack(source, 'pack.json');
    expect(pack.items).toHaveLength(2);
    expect(hasErrors(issues)).toBe(true);
  });

  it('flags dangling references as warnings', async () => {
    const source = memoryDatasetSource({
      ...files,
      'items.jsonl':
        '{"id":"test-es:item:003","pack":"test-es","type":"sentence","text":"y","lexemes":["test-es:lexeme:ghost"]}\n',
    });

    const { issues } = await loadPack(source, 'pack.json');
    expect(issues.some((issue) => issue.message.includes('unknown lexeme'))).toBe(true);
    expect(hasErrors(issues)).toBe(false);
  });

  it('rejects annotations that point at missing tokens', async () => {
    const source = memoryDatasetSource({
      ...files,
      'items.jsonl':
        '{"id":"test-es:item:004","pack":"test-es","type":"sentence","text":"z","tokens":[{"id":"t1","text":"z"}],"annotations":[{"tokens":["t9"],"type":"construction"}]}\n',
    });

    const { issues } = await loadPack(source, 'pack.json');
    expect(hasErrors(issues)).toBe(true);
    expect(issues.some((issue) => issue.message.includes('unknown token'))).toBe(true);
  });
});
