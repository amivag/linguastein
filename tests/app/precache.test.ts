/**
 * What the service worker installs up front, and what it fetches when asked.
 *
 * Two rules live here, and the second replaced the first.
 *
 * **One list decides what is precached.** `includeAssets` named `favicon.svg` and
 * `icons/*.svg`, and `workbox.globPatterns` matched `svg` as well — so all three
 * files were precached twice and the build reported 25 entries for 22 files. The
 * duplicates were harmless in themselves; what they cost is the entry count,
 * which is the one number a reader uses to check coverage at a glance.
 *
 * **The packs are not precached.** `jsonl` was in that glob, which fetched the
 * whole 6.3 MB dataset before a learner saw a screen — 7.1 MB across 28 entries,
 * of which the app itself was under a megabyte. That was the honest shape while
 * boot loaded every file anyway; it stopped being honest when the app started
 * fetching only the shards its course reads. A pack is an add-on and a 6 MB
 * download, so it is runtime-cached and offered rather than installed silently
 * (`docs/tasks/language-matrix.md` §5).
 *
 * The config is read as text, the way `design-language.test.ts` and
 * `motion.test.ts` read stylesheets: the rule being protected is about what the
 * source *says*, and importing the config would run the whole plugin chain to
 * learn it. What cannot be asserted here is the built manifest, because `npm run
 * check` builds after it tests — so this guards the cause rather than the symptom,
 * which is also where the fix would go.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const CONFIG = 'vite.config.ts';
const source = readFileSync(join(process.cwd(), CONFIG), 'utf8');

/** The extensions `globPatterns` covers: `['**\/*.{js,css,…}']` → the braced set. */
function globbedExtensions(): readonly string[] {
  const patterns = /globPatterns:\s*\[([^\]]*)\]/.exec(source);
  expect(patterns, `${CONFIG}: no workbox.globPatterns to read`).not.toBeNull();
  return [...patterns![1]!.matchAll(/\{([^}]*)\}/g)].flatMap((braced) =>
    braced[1]!.split(',').map((extension) => extension.trim()),
  );
}

/** Whatever `includeAssets` lists, or `[]` where it is absent — which is the goal. */
function includedAssets(): readonly string[] {
  const listed = /includeAssets:\s*\[([^\]]*)\]/.exec(source);
  if (!listed) return [];
  return [...listed[1]!.matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1]!);
}

/** The `runtimeCaching` array as text, which is where the packs live now. */
function runtimeCaching(): string {
  const start = source.indexOf('runtimeCaching:');
  expect(start, `${CONFIG}: no workbox.runtimeCaching to read`).toBeGreaterThan(-1);
  return source.slice(start, source.indexOf('devOptions:', start));
}

describe('the precache manifest', () => {
  it('reads a real glob list, so the checks below cannot pass vacuously', () => {
    // The guard on the guard: a renamed option would make every assertion here
    // true of nothing, which is how a stale test outlives the rule it protects.
    const extensions = globbedExtensions();
    expect(extensions.length).toBeGreaterThan(0);
    expect(extensions).toContain('js');
    expect(extensions).toContain('css');
  });

  it('never lists an asset the glob already matches', () => {
    const globbed = new Set(globbedExtensions());
    const overlapping = includedAssets().filter((pattern) => {
      const extension = pattern.split('.').at(-1);
      return extension !== undefined && globbed.has(extension);
    });

    expect(
      overlapping,
      `${CONFIG}: these are precached twice — once by includeAssets and once by ` +
        'globPatterns. Drop them from includeAssets, or take their extension out of ' +
        'the glob; two lists deciding one thing is how the entry count stopped ' +
        'meaning the number of files.',
    ).toEqual([]);
  });

  it('leaves the datasets out, because a pack is a download a learner chooses', () => {
    expect(
      globbedExtensions(),
      `${CONFIG}: putting jsonl back in the precache makes the shell a 7 MB ` +
        'install again, and takes the choice away from the learner. The packs are ' +
        'runtime-cached; Settings → Packs is where one is kept or removed.',
    ).not.toContain('jsonl');
  });

  it('keeps the files that describe a pack, so one can be offered while offline', () => {
    // `catalog.json` and each `pack.json` are a few kilobytes between them, and
    // they are what lets the app name its packs and say what is missing when
    // there is no connection to ask.
    expect(globbedExtensions()).toContain('json');
  });
});

describe('the packs at runtime', () => {
  it('caches them first, which their versioned path is what makes safe', () => {
    const rule = runtimeCaching();
    expect(rule).toContain('.jsonl');
    expect(rule).toMatch(/handler:\s*'CacheFirst'/);
  });

  it('matches on nothing but its arguments, because the matcher ships as text', () => {
    /*
     * The bug this exists for, found in a built worker and not by any test that
     * preceded it: the matcher read `url.pathname.startsWith(`${BASE}packs/`)`,
     * which type-checks here, serialises into `sw.js` verbatim, and throws
     * `ReferenceError: BASE is not defined` inside the worker — where it matched
     * no route, cached no pack, and left Settings truthfully reporting that
     * nothing was kept. Nothing failed. It was simply off.
     *
     * `workbox-build` stringifies these functions, so a `urlPattern` may read its
     * own arguments and literals and nothing else. A template hole is the shape
     * that closure took and the cheapest thing to refuse.
     */
    const patterns = [...runtimeCaching().matchAll(/urlPattern:.*?(?=handler:)/gs)].map(
      (match) => match[0],
    );
    expect(patterns.length).toBeGreaterThan(0);

    for (const pattern of patterns) {
      expect(
        pattern,
        `${CONFIG}: a urlPattern is serialised into sw.js as source text, so it ` +
          'cannot read a variable from this file — the worker throws and the route ' +
          'silently never matches. Inline the value, or match on the path alone.',
      ).not.toContain('${');
    }
  });

  /**
   * A translation unit is under `packs/` and two directories deeper than a pack.
   *
   * That depth is the reason the tree was put inside the packs root rather than
   * beside it (`docs/tasks/language-matrix.md` §3): the route below already
   * matches it, the `json` glob already precaches its manifest, and neither had
   * to learn a second place to look. Asserted rather than assumed, because the
   * failure is the silent one this whole suite exists for — a route that matches
   * nothing caches nothing, and Settings truthfully reports that the meanings are
   * not on the device while the app reads them from the network every time.
   */
  it('matches a translation unit, which is under `packs/` and deeper than a pack', () => {
    const pattern = /\/packs\/.+\.jsonl$/;
    expect(runtimeCaching()).toContain(String(pattern));

    expect(pattern.test('/linguastein/packs/core-es/0.16.0/es-a1-b1-core-sentences-a1.jsonl')).toBe(
      true,
    );
    expect(
      pattern.test(
        '/linguastein/packs/translations/core-es/en/0.16.0/es-a1-b1-core-translations-en.jsonl',
      ),
    ).toBe(true);
    // And the manifests are not runtime-cached: they are precached by the `json`
    // glob, so a pack and a unit can both describe themselves with no connection.
    expect(
      pattern.test('/linguastein/packs/translations/core-es/en/0.16.0/translations.json'),
    ).toBe(false);
  });

  it('names the cache through `cacheName`, because two files have to agree on it', () => {
    // `src/app/offline.ts` opens the same cache to put a pack there or take it
    // away. A literal in either place would not fail anything — it would quietly
    // give the app a second, empty cache and a Settings screen reporting that
    // nothing is kept while the worker serves everything from the other one.
    expect(runtimeCaching()).toContain("cacheName: cacheName('packs')");
    expect(source).toContain("from './src/app/identity.ts'");
  });
});
