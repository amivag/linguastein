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

import {
  catalogReferenceLanguages,
  loadPack,
  loadTranslationUnit,
  shardLevelsFor,
  translationUnitFor,
  type DatasetSource,
  type LoadedPack,
  type LoadedTranslations,
  type PackCatalog,
} from '../data/loaders';
import type { ValidationIssue } from '../data/validation';
import type { ContentRepository, LanguageTag, Level, LevelScope } from '../domain/content';

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
  /** Whether meanings in this language are already in the index. */
  hasReference(language: LanguageTag): boolean;
  /**
   * Fetches this language's meanings for every loaded pack, once.
   *
   * The second thing a course can be missing, and the one a *preference*
   * decides rather than an address. Translations are their own versioned unit
   * (`docs/tasks/language-matrix.md` §3), so boot fetches one language and a
   * learner changing the setting fetches another — the alternative being to
   * download every language the catalog offers in case one is picked, which is
   * the multiplicative download the split exists to avoid.
   *
   * Idempotent on the same terms as {@link ensure}: a language already held
   * resolves without a request.
   */
  ensureReference(language: LanguageTag): Promise<void>;
  /**
   * The translation units in memory, with the paths they were read from.
   *
   * Read by `offline.ts` so Settings → Packs can price a course's meanings
   * beside its content. A function rather than a list handed over once, because
   * the set changes: a learner who switches reference language after boot has a
   * different unit on the device, and a download offer quoting the old one is
   * quoting a number that is no longer true.
   */
  translationUnits(): readonly LoadedTranslations[];
  /**
   * Reference languages this installation could switch to, loaded or not.
   *
   * The picker's list. What is *in* the index is one language — the learner's —
   * so a picker built from that would offer no alternative to the setting it is
   * showing. Read from the catalog, which is the only unversioned file in the
   * tree and therefore the only one that can name a unit published after the
   * pack it explains.
   */
  availableReferences(): readonly LanguageTag[];
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
  hasReference: () => true,
  ensureReference: () => Promise.resolve(),
  translationUnits: () => [],
  availableReferences: () => [],
  issues: () => [],
};

export interface ContentLoadingOptions {
  readonly source: DatasetSource;
  readonly repository: ContentRepository;
  /** What boot loaded, carrying each pack's manifest path and shard levels. */
  readonly loaded: readonly LoadedPack[];
  /** What else is published, which is where a translation unit is addressed. */
  readonly catalog?: PackCatalog;
  /**
   * The translation units boot already indexed.
   *
   * Which languages are held is read off these rather than passed beside them,
   * so the two cannot disagree — the bug that shape prevents is a language
   * listed as held whose records never arrived, which reads to a learner as a
   * reference language that silently shows nothing.
   */
  readonly translations?: readonly LoadedTranslations[];
}

export function createContentLoading(options: ContentLoadingOptions): ContentLoading {
  const packs = options.loaded.map((loaded) => ({
    path: loaded.path,
    manifest: loaded.pack.manifest,
    have: new Set<Level>(loaded.levels),
  }));
  const issues: ValidationIssue[] = [];
  const units: LoadedTranslations[] = [...(options.translations ?? [])];
  const references = new Set<LanguageTag>(units.map((unit) => unit.manifest.referenceLanguage));
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

  /**
   * Every unit that would supply this language, for the packs actually loaded.
   *
   * Per pack rather than per language, because the unit is keyed by the pair:
   * a learner with `core-es` and `core-de` installed and German as their
   * reference language wants the German meanings of the Spanish pack, and the
   * German pack has none to give. A pack the catalog lists no unit for simply
   * contributes nothing here — it is not an error for a pack to be unexplained
   * in a language, it is the normal state of a matrix that is filled in over
   * time.
   */
  const catalog = options.catalog;
  const unitsFor = (language: LanguageTag): readonly string[] =>
    catalog
      ? packs.flatMap((pack) => {
          const path = translationUnitFor(catalog, pack.manifest.id, language);
          return path ? [path] : [];
        })
      : [];

  async function fetchReference(language: LanguageTag): Promise<void> {
    if (references.has(language)) return;

    for (const path of unitsFor(language)) {
      const unit = await loadTranslationUnit(options.source, path);
      options.repository.addTranslations(unit.translations);
      units.push(unit);
      issues.push(...unit.issues);
    }

    /*
     * Held once it has arrived, and held for a language nothing was published in
     * — the loop above simply ran zero times, and asking again next render would
     * be asking the same catalog the same question. What it is deliberately *not*
     * is held after a failed fetch: this line is unreachable when the await
     * throws, so a learner who changed language on a dead connection gets a real
     * retry rather than a permanent gap with the preference set.
     */
    references.add(language);
  }

  return {
    has: (level) => missing(level).length === 0,

    hasReference: (language) => references.has(language),

    ensureReference(language) {
      /*
       * The same queue as the shards, not a second one. A learner who changes
       * reference language while the background prefetch is still widening the
       * pack should get both, in the order they were asked for, and a single
       * chain is what makes `repository.add` calls serial — two concurrent
       * indexers on one repository is a race nothing above here could see.
       */
      const next = queue.then(() => fetchReference(language));
      queue = next.catch(() => {});
      return next;
    },

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

    translationUnits: () => units,

    availableReferences: () =>
      catalogReferenceLanguages(
        catalog ?? {},
        packs.map((pack) => pack.manifest.id),
      ),

    issues: () => issues,
  };
}
