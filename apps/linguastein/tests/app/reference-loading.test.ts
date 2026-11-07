/**
 * The meanings a course has not fetched yet.
 *
 * The sibling of `shard-loading.test.tsx`, on the other axis. A course narrows
 * content two independent ways — how far up the ladder it reaches, and which
 * language explains it — and until translations became their own addressed unit
 * (`docs/tasks/language-matrix.md` §3) only the first of those was a decision the
 * app could make. Every reference language a pack had ever been published in
 * arrived with it, whether or not anyone would read one.
 *
 * So what is worth pinning here is the arithmetic that change was for: boot
 * fetches one language, switching fetches the second and not the third, and
 * switching back fetches nothing at all.
 */

import { describe, expect, it } from 'vitest';
import { createContentLoading } from '../../src/app/content';
import { memoryDatasetSource, type LoadedPack, type PackCatalog } from '../../src/data/loaders';
import { ContentRepository, type PackId } from '../../src/domain/content';
import { id } from '../fixtures/pack';

const PACK = id<PackId>('core-es');

const loaded = (): LoadedPack => ({
  path: 'core-es/1.0.0/pack.json',
  pack: {
    manifest: {
      id: PACK,
      name: 'Core Spanish',
      targetLanguage: 'es',
      version: '1.0.0',
      levels: ['a1'],
      files: [{ kind: 'items', path: 'sentences-a1.jsonl', level: 'a1' }],
    },
    items: [],
    lexemes: [],
    senses: [],
    forms: [],
    skills: [],
    translations: [],
    passages: [],
    audio: [],
  },
  issues: [],
  partial: false,
  levels: ['a1'],
});

const catalog: PackCatalog = {
  packs: [{ id: 'core-es', manifest: 'core-es/1.0.0/pack.json' }],
  translations: [
    {
      pack: 'core-es',
      language: 'en',
      manifest: 'translations/core-es/en/1.0.0/translations.json',
    },
    {
      pack: 'core-es',
      language: 'de',
      manifest: 'translations/core-es/de/1.0.0/translations.json',
    },
    {
      pack: 'core-es',
      language: 'fr',
      manifest: 'translations/core-es/fr/1.0.0/translations.json',
    },
  ],
};

/** One unit's two files, keyed the way the source will be asked for them. */
function unit(language: string, text: string) {
  const root = `translations/core-es/${language}/1.0.0/`;
  return {
    [`${root}translations.json`]: JSON.stringify({
      pack: 'core-es',
      referenceLanguage: language,
      version: '1.0.0',
      files: [{ kind: 'translations', path: `meanings-${language}.jsonl` }],
    }),
    [`${root}meanings-${language}.jsonl`]: JSON.stringify({
      ref: 'core-es:item:000001',
      lang: language,
      text,
    }),
  };
}

function harness(held: readonly string[] = []) {
  const source = memoryDatasetSource({
    ...unit('en', 'the house'),
    ...unit('de', 'das Haus'),
    ...unit('fr', 'la maison'),
  });
  const asked: string[] = [];
  const counting = {
    ...source,
    read: (path: string) => {
      asked.push(path);
      return source.read(path);
    },
  };

  const repository = ContentRepository.from([loaded().pack]);
  const content = createContentLoading({
    source: counting,
    repository,
    loaded: [loaded()],
    catalog,
    translations: held.map((language) => ({
      path: `translations/core-es/${language}/1.0.0/translations.json`,
      manifest: {
        pack: PACK,
        referenceLanguage: language,
        version: '1.0.0',
        files: [{ kind: 'translations' as const, path: `meanings-${language}.jsonl` }],
      },
      translations: [],
      issues: [],
    })),
  });

  return { content, repository, asked };
}

describe('fetching the language a learner reads in', () => {
  it('fetches one language, and only the one asked for', async () => {
    const { content, repository, asked } = harness(['en']);

    await content.ensureReference('de');

    expect(asked).toEqual([
      'translations/core-es/de/1.0.0/translations.json',
      'translations/core-es/de/1.0.0/meanings-de.jsonl',
    ]);
    // Indexed, which is the point of fetching it: the picker being right is not
    // the same as the screen being able to read the gloss.
    expect(repository.translationOf('core-es:item:000001', 'de')?.text).toBe('das Haus');
    // And French was published all along and never requested.
    expect(repository.translationOf('core-es:item:000001', 'fr')).toBeUndefined();
  });

  it('asks for nothing when the language is already held', async () => {
    const { content, asked } = harness(['en']);

    expect(content.hasReference('en')).toBe(true);
    await content.ensureReference('en');

    expect(asked).toEqual([]);
  });

  it('fetches a language once, however often it is asked for', async () => {
    const { content, asked } = harness(['en']);

    await Promise.all([
      content.ensureReference('de'),
      content.ensureReference('de'),
      content.ensureReference('de'),
    ]);

    expect(asked.filter((path) => path.endsWith('translations.json'))).toHaveLength(1);
  });

  /**
   * A language the catalog cannot supply is *asked* once and then let alone.
   *
   * The alternative is a request per render for a preference that will never
   * resolve. The screen degrades the way it does for any missing gloss — down the
   * reference chain to English — which is a better answer than a spinner over a
   * language nobody has translated the pack into.
   */
  it('holds a language nothing was published in, rather than asking again', async () => {
    const { content, asked } = harness(['en']);

    await content.ensureReference('zh');

    expect(asked).toEqual([]);
    expect(content.hasReference('zh')).toBe(true);
  });

  /**
   * A failed fetch is not a held language.
   *
   * The opposite of the case above and the reason it is written as two: marking
   * a language held on the way *in* would be simpler and would strand a learner
   * who changed the setting on a dead connection — the preference set, the
   * meanings absent, and nothing that would ever try again.
   */
  it('lets a language that failed to arrive be asked for again', async () => {
    const { content } = harness(['en']);
    const broken = createContentLoading({
      source: {
        name: 'broken',
        read: () => Promise.reject(new Error('offline')),
      },
      repository: ContentRepository.from([loaded().pack]),
      loaded: [loaded()],
      catalog,
    });

    await expect(broken.ensureReference('de')).rejects.toThrow('offline');
    expect(broken.hasReference('de')).toBe(false);

    // And the queue is not left rejected: the next language still works.
    await expect(content.ensureReference('fr')).resolves.toBeUndefined();
  });

  it('offers every language the catalog can supply, not only the one in memory', () => {
    const { content } = harness(['en']);

    expect([...content.availableReferences()].sort()).toEqual(['de', 'en', 'fr']);
  });
});
