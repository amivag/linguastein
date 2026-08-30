/**
 * Keeping a pack on the device, as a thing a learner chooses.
 *
 * The packs used to be precached: 6.3 MB fetched before the first screen, by a
 * service worker, on a connection nobody asked about. That was defensible while
 * boot loaded every file anyway — it was the same bytes either way — and stopped
 * being defensible the moment boot started fetching only the shards its course
 * reads. So the packs are runtime-cached now (`CacheFirst`, `vite.config.ts`),
 * which makes "is this pack here?" a real question with a real answer, and
 * "download the rest of it" a real offer.
 *
 * The vendor is the Cache Storage API and it stays behind this interface, per
 * rule 5. Three operations, all of them about the *device* rather than about
 * what is in memory: `src/app/content.ts` is the other half of that pair, and the
 * two are deliberately separate — a shard can be in the cache and not in the
 * repository (the common case after a reload) or in the repository and not the
 * cache (a browser with no worker at all).
 */

import type { LoadedPack, LoadedTranslations } from '../data/loaders';
import type { PackFile, PackId } from '../domain/content';
import { cacheName } from './identity';

/** What a pack weighs, and how much of it this device is holding. */
export interface PackOffline {
  readonly pack: PackId;
  /** Files the pack is made of, and how many of them are on the device. */
  readonly files: number;
  readonly cached: number;
  /**
   * Declared bytes, and the declared bytes of the files that are here.
   *
   * From `PackFile.bytes`, so both are known before anything is downloaded —
   * which is the difference between "keep this offline" and "keep this offline
   * (6.4 MB)". A pack whose manifest omits the sizes reports zero rather than a
   * guess, and the screen says how many files instead.
   */
  readonly bytes: number;
  readonly cachedBytes: number;
}

export interface OfflinePacks {
  /** Whether this browser can keep a pack at all. */
  readonly supported: boolean;
  status(): Promise<readonly PackOffline[]>;
  /**
   * Downloads whatever is missing, in order, reporting as each file lands.
   *
   * Sequential rather than `cache.addAll`, and both halves of that matter: a
   * learner watching a 6 MB download wants to see it move, and one failed file
   * out of fifteen should leave fourteen on the device rather than none.
   */
  install(pack: PackId, onProgress?: (done: number, total: number) => void): Promise<void>;
  /** Takes the pack off the device. What is already in memory stays there. */
  remove(pack: PackId): Promise<void>;
}

/**
 * A device that keeps nothing: the answer in a test, and in any browser without
 * the Cache Storage API.
 *
 * `supported: false` is what the screen reads to say so plainly, rather than
 * offering a button that would do nothing.
 */
export const NO_OFFLINE_PACKS: OfflinePacks = {
  supported: false,
  status: () => Promise.resolve([]),
  install: () => Promise.resolve(),
  remove: () => Promise.resolve(),
};

export interface OfflinePacksOptions {
  /** What boot loaded: each pack's manifest, and the path it was read from. */
  readonly packs: readonly LoadedPack[];
  /**
   * The translation units in memory, counted against the pack each explains.
   *
   * A function rather than a list, because the set changes after boot: a learner
   * who switches reference language has different meanings on the device, and a
   * screen that had been handed the old list would price a download that no
   * longer describes what is here.
   *
   * Counted with the pack rather than listed separately because that is what
   * "keep this course offline" means to the person choosing it. A pack held
   * without its meanings is a pack that opens offline and cannot explain a
   * single word — technically installed, and useless in exactly the situation
   * installing it was for.
   */
  readonly translations?: () => readonly LoadedTranslations[];
  /** Absolute url the packs are served from, so a cache key is a real url. */
  readonly baseUrl: string;
}

export function createOfflinePacks(options: OfflinePacksOptions): OfflinePacks {
  if (typeof caches === 'undefined') return NO_OFFLINE_PACKS;

  /*
   * Resolved per call rather than once, because the translation half of a pack
   * can arrive after this module was created — see {@link
   * OfflinePacksOptions.translations}.
   */
  const packsNow = () =>
    options.packs.map((loaded) => {
      const id = loaded.pack.manifest.id;
      const units = (options.translations?.() ?? []).filter((unit) => unit.manifest.pack === id);
      return {
        id,
        files: [
          ...fileUrls(loaded.pack.manifest.files, loaded.path, options.baseUrl),
          ...units.flatMap((unit) => fileUrls(unit.manifest.files, unit.path, options.baseUrl)),
        ],
      };
    });
  const find = (id: PackId) => packsNow().find((pack) => pack.id === id);

  return {
    supported: true,

    async status() {
      return Promise.all(
        packsNow().map(async (pack) => {
          /*
           * `caches.match` searches every cache in the origin rather than one by
           * name, which is the point: a file may be here because the worker's
           * `CacheFirst` stored it while the app was reading it, or because
           * `install` below put it there, and to a learner asking "is this
           * available offline?" those are the same answer.
           */
          const present = await Promise.all(
            pack.files.map(async (file) => ((await caches.match(file.url)) ? file : undefined)),
          );
          const held = present.filter((file) => file !== undefined);

          return {
            pack: pack.id,
            files: pack.files.length,
            cached: held.length,
            bytes: pack.files.reduce((total, file) => total + file.bytes, 0),
            cachedBytes: held.reduce((total, file) => total + file.bytes, 0),
          };
        }),
      );
    },

    async install(id, onProgress) {
      const pack = find(id);
      if (!pack) return;

      const cache = await caches.open(PACK_CACHE);
      const missing: string[] = [];
      for (const file of pack.files) {
        if (!(await caches.match(file.url))) missing.push(file.url);
      }

      let done = 0;
      onProgress?.(done, missing.length);
      for (const url of missing) {
        // `cache.add` rather than a bare `fetch`: the entry has to land whether
        // or not a worker is running, which is also what makes this testable and
        // what makes `remove` exactly symmetrical with it.
        await cache.add(url);
        done += 1;
        onProgress?.(done, missing.length);
      }
    },

    async remove(id) {
      const pack = find(id);
      if (!pack) return;

      /*
       * Out of every cache that holds it, for the reason `status` reads every
       * cache: the worker put some of these here and this module put the rest,
       * and a Remove that only emptied one of the two would report the pack gone
       * while the app went on serving it from the other.
       */
      const names = await caches.keys();
      await Promise.all(
        names.map(async (name) => {
          const cache = await caches.open(name);
          await Promise.all(pack.files.map((file) => cache.delete(file.url)));
        }),
      );
    },
  };
}

/** The cache the worker's pack strategy writes into, and this module shares. */
const PACK_CACHE = cacheName('packs');

/**
 * Every file of a pack, as the absolute url a cache is keyed by.
 *
 * Resolved beside the manifest exactly the way `loadPack` resolves them, because
 * a cache key that is one slash away from what the app requests is a cache that
 * always reports empty.
 */
function fileUrls(
  files: readonly PackFile[],
  manifestPath: string,
  baseUrl: string,
): readonly { readonly url: string; readonly bytes: number }[] {
  const root = manifestPath.replace(/[^/]+$/, '');
  return files.map((file: PackFile) => ({
    url: new URL(`${root}${file.path}`, baseUrl).toString(),
    bytes: file.bytes ?? 0,
  }));
}
