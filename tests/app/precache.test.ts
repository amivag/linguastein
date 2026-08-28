/**
 * One list decides what the service worker precaches.
 *
 * `vite.config.ts` had two: `includeAssets` named `favicon.svg` and
 * `icons/*.svg`, and `workbox.globPatterns` matched `svg` as well — so all three
 * files were precached **twice** and the build reported 25 entries for 22 files.
 * The duplicates were harmless in themselves, since the revisions matched and the
 * second entry described the same bytes. What they cost is the entry count, which
 * is the one number a reader uses to check coverage at a glance — and the number
 * that has to be read carefully when `docs/tasks/language-matrix.md` §5 moves the
 * packs from precache to runtime caching.
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

describe('the precache manifest', () => {
  it('reads a real glob list, so the check below cannot pass vacuously', () => {
    // The guard on the guard: a renamed option would make every assertion here
    // true of nothing, which is how a stale test outlives the rule it protects.
    const extensions = globbedExtensions();
    expect(extensions.length).toBeGreaterThan(0);
    expect(extensions).toContain('jsonl');
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

  it('keeps the datasets in the glob, which is what makes a session work offline', () => {
    // Not a style rule: `jsonl` leaving this list is how the packs would silently
    // stop being available on a train. §5 will move them to runtime caching *and*
    // an install step; until it does, their being precached is the feature.
    expect(globbedExtensions()).toContain('jsonl');
    expect(source).toContain('maximumFileSizeToCacheInBytes');
  });
});
