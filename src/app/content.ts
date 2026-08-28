/**
 * The content a course has not fetched yet.
 *
 * Boot loads the shards the address asks for — an A1 course is 3.0 MB of the
 * pack's 6.3 — so the repository is deliberately incomplete from the first
 * render. This is what completes it: the rest arrives in the background so a
 * level chip is usually instant, and a chip tapped before that lands is awaited
 * rather than answered with an empty screen.
 *
 * Chosen once in `services.ts` like every other seam (rule 5), so nothing above
 * it knows that content arrives over HTTP or in pieces.
 */

import { loadPack, shardLevelsFor, type DatasetSource, type LoadedPack } from '../data/loaders';
import type { ValidationIssue } from '../data/validation';
import type { ContentRepository, Level, LevelScope } from '../domain/content';

export interface ContentLoading {
  /** Whether every shard a course at this ceiling reads is already in memory. */
  has(level: LevelScope): boolean;
  /**
   * Fetches whatever it does not have, and resolves once that is readable.
   *
   * Idempotent and safe to call from a render-driven effect: a ceiling already
   * held resolves without a request, and a widening asked for twice is fetched
   * once.
   */
  ensure(level: LevelScope): Promise<void>;
  /** Problems in what arrived after boot, for the list Settings already shows. */
  issues(): readonly ValidationIssue[];
}

/**
 * A repository nothing will add to.
 *
 * What a test's hand-built packs are, and what an import or a bundled dataset
 * would be: already whole, so every course is ready and nothing ever fetches.
 */
export const NOTHING_TO_LOAD: ContentLoading = {
  has: () => true,
  ensure: () => Promise.resolve(),
  issues: () => [],
};

export interface ContentLoadingOptions {
  readonly source: DatasetSource;
  readonly repository: ContentRepository;
  /** What boot loaded, carrying each pack's manifest path and shard levels. */
  readonly loaded: readonly LoadedPack[];
}

export function createContentLoading(options: ContentLoadingOptions): ContentLoading {
  const packs = options.loaded.map((loaded) => ({
    path: loaded.path,
    manifest: loaded.pack.manifest,
    have: new Set<Level>(loaded.levels),
  }));
  const issues: ValidationIssue[] = [];
  let queue = Promise.resolve();

  /** Per pack, the shards this ceiling needs and this install has not got. */
  const missing = (level: LevelScope) =>
    packs
      .map((pack) => ({
        pack,
        levels: shardLevelsFor(pack.manifest, level).filter((rung) => !pack.have.has(rung)),
      }))
      .filter((entry) => entry.levels.length > 0);

  async function fetch(level: LevelScope): Promise<void> {
    for (const { pack, levels } of missing(level)) {
      const loaded = await loadPack(options.source, pack.path, { only: levels });
      /*
       * Added rather than reloaded: the unsharded files and the shards below are
       * already indexed, and re-reading them would list every translation twice.
       * `only` is what keeps this to new records, so `add` sees each one once.
       */
      options.repository.add(loaded.pack);
      issues.push(...loaded.issues);
      for (const rung of loaded.levels) pack.have.add(rung);
    }
  }

  return {
    has: (level) => missing(level).length === 0,

    ensure(level) {
      /*
       * Chained rather than concurrent, which is the whole of the race. A level
       * tapped while the background prefetch is in flight waits for it instead of
       * fetching the same shard a second time, because `missing` is recomputed
       * inside the queue and by then the prefetch has added what it fetched.
       *
       * The queue itself never stays rejected: a widening that fails offline must
       * not take the next one down with it.
       */
      const next = queue.then(() => fetch(level));
      queue = next.catch(() => {});
      return next;
    },

    issues: () => issues,
  };
}
