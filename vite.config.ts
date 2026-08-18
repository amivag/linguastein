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
function buildCommit(): string {
  if (process.env['LINGO_BUILD_COMMIT']) return process.env['LINGO_BUILD_COMMIT'];
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
  /**
   * Build identity, injected rather than imported: importing `package.json` would
   * pull the whole manifest into the bundle, and a hand-copied constant would
   * drift from the package that produced it. `LINGO_BUILD_*` overrides keep the
   * values reproducible where that matters (tests, release pipelines).
   */
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_COMMIT__: JSON.stringify(buildCommit()),
    __BUILD_TIME__: JSON.stringify(
      process.env['LINGO_BUILD_TIME'] ?? new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
    ),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.svg'],
      manifest: {
        name: 'Lingo — Spanish Practice',
        short_name: 'Lingo',
        description: 'Mobile-first Spanish practice: listen, repeat, reveal, review.',
        lang: 'en',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0f1115',
        theme_color: '#0f1115',
        icons: [
          { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          {
            src: '/icons/icon-maskable.svg',
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
              cacheName: 'lingo-audio',
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
