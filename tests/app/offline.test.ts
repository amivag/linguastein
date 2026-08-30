/**
 * Keeping a pack on the device.
 *
 * The packs left the precache, so "is this here?" became a question with a real
 * answer and "download the rest" became a real offer. Both are this module, and
 * what is worth pinning is not the Cache Storage calls — it is the three things
 * a wrong answer would cost a learner: a Settings screen saying a pack is kept
 * when it is not, a Keep button that re-downloads what is already here, and a
 * Remove that leaves it playing from a cache nobody looked in.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOfflinePacks, NO_OFFLINE_PACKS } from '../../src/app/offline';
import type { LoadedPack, LoadedTranslations } from '../../src/data/loaders';
import type { PackId } from '../../src/domain/content';
import { id } from '../fixtures/pack';

const PACK = id<PackId>('core-es');
/** Where the packs are served from, and where this pack's own files sit under it. */
const BASE = 'http://localhost/packs/';
const ROOT = `${BASE}core-es/1.0.0/`;
/**
 * And where its meanings sit, which is somewhere else and under a version of
 * their own.
 *
 * A translation set is its own addressed, independently versioned unit
 * (`docs/tasks/language-matrix.md` §3). It is still counted, downloaded and
 * removed *with* the pack, because "keep this course offline" means the whole
 * course to the person choosing it — a pack held without its meanings opens
 * offline and cannot explain a single word.
 */
const UNIT = `${BASE}translations/core-es/en/2.0.0/`;

const loaded = (): LoadedPack => ({
  path: 'core-es/1.0.0/pack.json',
  pack: {
    manifest: {
      id: PACK,
      name: 'Core Spanish',
      targetLanguage: 'es',
      version: '1.0.0',
      levels: ['a1', 'a2'],
      files: [
        { kind: 'items', path: 'sentences-a1.jsonl', level: 'a1', bytes: 2_000_000 },
        { kind: 'items', path: 'sentences-a2.jsonl', level: 'a2', bytes: 1_000_000 },
      ],
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
  levels: ['a1', 'a2'],
});

const meanings = (): LoadedTranslations => ({
  path: 'translations/core-es/en/2.0.0/translations.json',
  manifest: {
    pack: PACK,
    referenceLanguage: 'en',
    version: '2.0.0',
    files: [{ kind: 'translations', path: 'translations-en.jsonl', bytes: 500_000 }],
  },
  translations: [],
  issues: [],
});

/** The pack and the meanings it is read with, which is what a course is. */
const course = () => ({ packs: [loaded()], translations: () => [meanings()], baseUrl: BASE });

/**
 * Cache Storage, as much of it as this module uses, plus a `fetch` that serves
 * anything under the pack root.
 *
 * Named caches rather than one bag, because two of the assertions below are
 * about *which* cache a file is in: the worker fills its own while the app
 * reads, and this module fills the same one by name.
 */
function fakeCaches(seed: Readonly<Record<string, readonly string[]>> = {}) {
  const stores = new Map<string, Set<string>>(
    Object.entries(seed).map(([name, urls]) => [name, new Set(urls)]),
  );
  const fetched: string[] = [];

  const open = (name: string) => {
    const store = stores.get(name) ?? new Set<string>();
    stores.set(name, store);
    return Promise.resolve({
      add: async (url: string) => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`failed to fetch ${url}`);
        store.add(url);
      },
      delete: (url: string) => Promise.resolve(store.delete(url)),
    });
  };

  vi.stubGlobal('caches', {
    open,
    keys: () => Promise.resolve([...stores.keys()]),
    match: (url: string) =>
      Promise.resolve(
        [...stores.values()].some((store) => store.has(url)) ? new Response('') : undefined,
      ),
  });
  vi.stubGlobal('fetch', (url: string) => {
    fetched.push(url);
    return Promise.resolve({ ok: true, status: 200 });
  });

  return { stores, fetched };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('a device with no cache storage', () => {
  it('says so rather than offering something that would do nothing', () => {
    // jsdom has no Cache Storage, so this is the unstubbed case as well as the
    // honest answer for a browser without it.
    const offline = createOfflinePacks(course());

    expect(offline.supported).toBe(false);
    expect(offline).toBe(NO_OFFLINE_PACKS);
  });
});

describe('what the device is holding', () => {
  it('counts the files and adds up what they weigh, before anything is downloaded', async () => {
    fakeCaches();
    const [status] = await createOfflinePacks(course()).status();

    expect(status).toEqual({
      pack: PACK,
      files: 3,
      cached: 0,
      // Declared in the manifest, which is the whole reason a Keep button can
      // say what it costs.
      bytes: 3_500_000,
      cachedBytes: 0,
    });
  });

  it('reads every cache, not one by name', async () => {
    // A file is here because the worker's `CacheFirst` stored it while the app
    // was reading it, or because `install` put it there. To a learner asking
    // whether the pack is available offline, those are the same answer.
    fakeCaches({ 'workbox-runtime': [`${ROOT}sentences-a1.jsonl`] });
    const [status] = await createOfflinePacks(course()).status();

    expect(status?.cached).toBe(1);
    expect(status?.cachedBytes).toBe(2_000_000);
  });
});

describe('keeping a pack', () => {
  it('downloads what is missing, in order, and reports as each file lands', async () => {
    const fake = fakeCaches({ 'linguastein-packs': [`${ROOT}sentences-a1.jsonl`] });
    const offline = createOfflinePacks(course());
    const progress: string[] = [];

    await offline.install(PACK, (done, total) => progress.push(`${done}/${total}`));

    // The two it did not have, and not the one it did.
    expect(fake.fetched).toEqual([`${ROOT}sentences-a2.jsonl`, `${UNIT}translations-en.jsonl`]);
    expect(progress).toEqual(['0/2', '1/2', '2/2']);

    const [status] = await offline.status();
    expect(status?.cached).toBe(3);
  });

  it('asks for nothing when the pack is already here', async () => {
    const urls = [
      `${ROOT}sentences-a1.jsonl`,
      `${ROOT}sentences-a2.jsonl`,
      `${UNIT}translations-en.jsonl`,
    ];
    const fake = fakeCaches({ 'linguastein-packs': urls });

    await createOfflinePacks(course()).install(PACK);

    expect(fake.fetched).toEqual([]);
  });

  it('leaves what did land, when one file of many fails', async () => {
    fakeCaches();
    vi.stubGlobal('fetch', (url: string) =>
      Promise.resolve({ ok: !url.endsWith('translations-en.jsonl'), status: 200 }),
    );
    const offline = createOfflinePacks(course());

    await expect(offline.install(PACK)).rejects.toThrow();

    // Sequential rather than `addAll` is what buys this: two of three on the
    // device and a screen that can say so, instead of nothing and an error.
    expect((await offline.status())[0]?.cached).toBe(2);
  });
});

describe('removing a pack', () => {
  it('takes it out of every cache that holds it', async () => {
    // The worker put some of these here and this module put the rest. A Remove
    // that emptied one would report the pack gone while the app went on serving
    // it from the other.
    const fake = fakeCaches({
      'linguastein-packs': [`${ROOT}sentences-a1.jsonl`],
      'workbox-runtime': [`${ROOT}sentences-a2.jsonl`],
    });
    const offline = createOfflinePacks(course());

    await offline.remove(PACK);

    expect((await offline.status())[0]?.cached).toBe(0);
    expect([...fake.stores.values()].every((store) => store.size === 0)).toBe(true);
  });

  it('ignores a pack it was never given', async () => {
    fakeCaches();
    const offline = createOfflinePacks(course());

    await expect(offline.remove(id<PackId>('nothing'))).resolves.toBeUndefined();
    await expect(offline.install(id<PackId>('nothing'))).resolves.toBeUndefined();
  });
});
