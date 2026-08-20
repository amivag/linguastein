import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8'),
) as { version: string };

/**
 * Short commit of the build, or `unknown` outside a git checkout (a source
 * tarball, a container that copied only `dist`). Never fatal: not knowing the
 * commit is worth strictly less than a build that fails.
 */
/**
 * The app is served from a project page — `amivag.github.io/linguastein/` — not
 * from a domain root. Every absolute path the build emits has to carry this, so
 * it is declared once and reused: Vite's `base`, the manifest's `start_url`,
 * `scope` and icon paths, and the router's basename by way of
 * `import.meta.env.BASE_URL`. Set in development too, so a base-path mistake
 * shows up locally instead of only once deployed.
 */
const BASE = '/linguastein/';

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
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.svg'],
      manifest: {
        name: 'Linguastein — Spanish Practice',
        short_name: 'Linguastein',
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
        runtimeCaching: [
          {
            // Canonical audio is fetched on demand and kept for replay.
            urlPattern: ({ request }) => request.destination === 'audio',
            handler: 'CacheFirst',
            options: {
              cacheName: 'linguastein-audio',
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
