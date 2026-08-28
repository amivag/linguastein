import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';
// With the extension: Vite's future native config loader refuses an
// extensionless import, and it already warns about one today.
import { APP, cacheName } from './src/app/identity.ts';
import { prePaintAxes } from './src/styles/axes.ts';

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8'),
) as { version: string };

/**
 * Short commit of the build, or `unknown` outside a git checkout (a source
 * tarball, a container that copied only `dist`). Never fatal: not knowing the
 * commit is worth strictly less than a build that fails.
 */
/**
 * Base path, name and machine id all come from `src/app/identity.ts` — the one
 * module a new project edits. It is plain data with no imports precisely so a
 * config file can read it: nothing here may touch the DOM.
 */
const BASE = APP.basePath;

function buildCommit(): string {
  if (process.env['LINGUASTEIN_BUILD_COMMIT']) return process.env['LINGUASTEIN_BUILD_COMMIT'];
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
    }).trim();
  } catch {
    return 'unknown';
  }
}

export default defineConfig({
  base: BASE,
  /**
   * Build identity, injected rather than imported: importing `package.json` would
   * pull the whole manifest into the bundle, and a hand-copied constant would
   * drift from the package that produced it. `LINGUASTEIN_BUILD_*` overrides
   * keep the values reproducible where that matters (tests, release pipelines).
   */
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_COMMIT__: JSON.stringify(buildCommit()),
    __BUILD_TIME__: JSON.stringify(
      process.env['LINGUASTEIN_BUILD_TIME'] ?? new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
    ),
  },
  plugins: [
    /**
     * Identity and appearance into the HTML shell.
     *
     * `index.html` cannot import TypeScript, so its pre-paint script used to
     * carry duplicates of things it had no way to read: the storage-key prefix,
     * and a literal copy of every appearance axis's values. Both were kept in
     * step by a comment and a test — a contract, in other words, rather than a
     * mechanism.
     *
     * The placeholders below are replaced at build *and* dev time, so there is
     * one spelling of the app id and one list of the axes. Adding a palette or a
     * whole new axis needs no edit to the HTML, which is the property that makes
     * this layer reusable in another app rather than merely tidy in this one.
     */
    {
      name: 'app-identity-html',
      transformIndexHtml: {
        order: 'pre' as const,
        handler: (html: string) =>
          html
            .replaceAll('%APP_ID%', APP.id)
            .replaceAll('%APP_NAME%', APP.name)
            .replaceAll('%APP_TAGLINE%', APP.tagline)
            .replaceAll('%APPEARANCE_AXES%', JSON.stringify(prePaintAxes())),
      },
    },
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      /*
       * No `includeAssets`. It listed `favicon.svg` and `icons/*.svg`, which
       * `workbox.globPatterns` below already matches — so all three were precached
       * **twice**, and the manifest reported 25 entries for 22 files.
       *
       * Harmless in itself: the revisions were identical, so the second entry
       * described the same bytes. What it cost is the one number a reader uses to
       * check coverage at a glance, which is exactly the number
       * `docs/tasks/language-matrix.md` §5 has to be read against when the packs
       * move to runtime caching. One list decides what is precached now, and
       * `tests/app/precache.test.ts` fails if a second one starts overlapping it.
       */
      manifest: {
        name: `${APP.name} — ${APP.tagline}`,
        short_name: APP.name,
        description: 'Mobile-first Spanish practice: listen, repeat, reveal, review.',
        lang: 'en',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0f1115',
        theme_color: '#0f1115',
        icons: [
          { src: `${BASE}icons/icon.svg`, sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          {
            src: `${BASE}icons/icon-maskable.svg`,
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        /**
         * The shell, and the two small files that describe the packs — not the
         * packs.
         *
         * `jsonl` was in this list, which precached the whole 6.3 MB dataset
         * before a learner saw a screen: 7.1 MB across 28 entries, of which the
         * app itself was under a megabyte. That was the honest shape while boot
         * loaded every file anyway. It stopped being honest when the app started
         * fetching only the shards its course reads, and it was never the right
         * shape for an add-on — a pack is a 6 MB download, and the install
         * prompt is where a 6 MB download belongs.
         *
         * `json` stays, and `catalog.json` and each `pack.json` are why: they are
         * a few kilobytes between them, and they are what lets the app name its
         * packs, count its courses and say what is missing while offline. A pack
         * that cannot describe itself offline cannot be offered for installing.
         *
         * `maximumFileSizeToCacheInBytes` went with the datasets. It was raised
         * to 8 MiB because the B1 sentences file crossed Workbox's 2 MiB refusal,
         * and that comment said the real fix was `runtimeCaching` and an install
         * step rather than a bigger number. This is that fix, so the number goes
         * back to the default — where it is a useful alarm again: nothing in the
         * shell has any business being 2 MiB.
         */
        globPatterns: ['**/*.{js,css,html,svg,woff2,json}'],
        runtimeCaching: [
          {
            /*
             * The packs: fetched on demand, kept until the learner says
             * otherwise.
             *
             * `CacheFirst` is safe because a pack's version is in its path
             * (`packs/core-es/0.16.0/…`), so an update is a new URL rather than a
             * revalidation of an old one — which is the whole reason that landed
             * first. What a learner keeps offline is therefore an exact set of
             * URLs, and `src/app/offline.ts` puts them here and takes them away.
             *
             * `maxEntries` is a floor under old versions rather than a budget:
             * nothing evicts a pack a learner is using, but a device that has
             * seen four cuts of a fifteen-file pack should not hold all four
             * forever. Removing one is the learner's own control, in Settings.
             *
             * The matcher closes over **nothing**, and that is load-bearing rather
             * than tidy. `workbox-build` serialises this function into `sw.js` as
             * text, so a reference to `BASE` type-checks here, ships as a
             * `ReferenceError` inside the worker, and matches no route at all —
             * a pack that is never cached and a Settings screen reporting that
             * nothing is kept, with the failure visible only in a built worker.
             * It was written that way, caught in a browser, and is guarded by
             * `precache.test.ts` now. The path needs no base: the worker's scope
             * already is the base.
             */
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && /\/packs\/.+\.jsonl$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: cacheName('packs'),
              expiration: { maxEntries: 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Canonical audio is fetched on demand and kept for replay.
            urlPattern: ({ request }) => request.destination === 'audio',
            handler: 'CacheFirst',
            options: {
              cacheName: cacheName('audio'),
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist',
    /**
     * On, now that the repository is public: a sourcemap gives a visitor nothing
     * they could not read on GitHub, and it is the difference between debugging a
     * phone-only problem and guessing at one.
     */
    sourcemap: true,
    target: 'es2022',
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    /**
     * Longer than vitest's 5s default, and not a way of hiding slow code.
     *
     * The component tests drive real pointer events through `user-event`, some of
     * them into focus-trapped dialogs, and a few inject latency deliberately to
     * open a race worth testing. Alone they take five or six seconds; sixty-odd
     * jsdom environments in parallel push the slowest past the ceiling, and they
     * fail as timeouts that look like flakes and are not — the same test passes
     * the moment it runs on its own.
     *
     * Raising it costs nothing on a green run and only delays the report on a
     * genuinely hung test. It is set here rather than per file so that the next
     * component test to grow does not have to rediscover this.
     */
    testTimeout: 15_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.d.ts', 'src/main.tsx'],
      /**
       * Floors, not targets — set just under what the suite actually reaches, so
       * they catch a regression without failing on ordinary churn.
       *
       * The engine and the morphology are held far higher than the app as a
       * whole, which is the shape the coverage already has: they are pure and
       * cheap to test, while the low numbers sit in browser-API shims (speech
       * synthesis, recognition, clipboard) where a test would mostly assert that
       * a mock was called. Raise these when the real figure moves up; do not
       * lower one to make a change fit.
       */
      thresholds: {
        statements: 78,
        branches: 73,
        functions: 73,
        lines: 80,
        'src/domain/**': { statements: 88, branches: 76, functions: 90, lines: 92 },
        'src/languages/**': { statements: 96, branches: 96, functions: 95, lines: 97 },
      },
    },
  },
});
