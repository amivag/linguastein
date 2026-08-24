import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';
// With the extension: Vite's future native config loader refuses an
// extensionless import, and it already warns about one today.
import { APP } from './src/app/identity.ts';
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
      includeAssets: ['favicon.svg', 'icons/*.svg'],
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
        // App shell + datasets are precached so a session works offline.
        globPatterns: ['**/*.{js,css,html,svg,woff2,json,jsonl}'],
        /**
         * Workbox refuses to precache a file over 2 MiB by default, and the
         * B1 content took the sentences file to 2.65 MB — which failed the
         * build rather than silently shipping a pack the app could not open
         * offline. That is the right failure mode and the wrong limit for this
         * app: the whole point of precaching the datasets is that a session
         * works on a train, and a learner is not choosing to download the pack
         * — it is bundled, so it is already in the artifact either way.
         *
         * 8 MiB is roughly three times the current largest file. It is a
         * ceiling to be raised deliberately, not a headroom to grow into: a
         * pack heading past it wants `runtimeCaching` and an install step, the
         * add-on story in docs/tasks/pack-addressing.md §4, rather than a
         * bigger number here.
         */
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        runtimeCaching: [
          {
            // Canonical audio is fetched on demand and kept for replay.
            urlPattern: ({ request }) => request.destination === 'audio',
            handler: 'CacheFirst',
            options: {
              cacheName: `${APP.id}-audio`,
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
