import { defineConfig, devices } from '@playwright/test';
// With the extension, for the same reason `vite.config.ts` gives one.
import { APP } from './src/app/identity.ts';

/**
 * Browser tests against the production build, in all three engines.
 *
 * jsdom cannot run a service worker, a content security policy, Trusted Types,
 * or two tabs sharing one IndexedDB. Those are the parts of this app most likely
 * to break silently, so this suite exercises them where they run. It serves
 * `dist/` through `vite preview`; `npm run test:e2e` builds it first.
 */

const PORT = 4180;
const ORIGIN = `http://localhost:${PORT}`;
const ENGINES = [
  ['chromium', devices['Desktop Chrome']],
  ['firefox', devices['Desktop Firefox']],
  ['webkit', devices['Desktop Safari']],
] as const;

/*
 * `update.spec.ts` rewrites the served `sw.js` to simulate a new build. It runs
 * after everything else, and one engine after another, so no other test sees
 * the changed file.
 */
const UPDATE = 'update.spec.ts';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env['CI']),
  reporter: process.env['CI'] ? [['github'], ['list']] : 'list',
  // A cold production boot in three engines at once is slow in Firefox; five
  // seconds failed it under load while passing alone.
  expect: { timeout: 10_000 },
  use: {
    baseURL: `${ORIGIN}${APP.basePath}`,
    trace: 'retain-on-failure',
  },
  projects: [
    ...ENGINES.map(([name, device]) => ({ name, use: { ...device }, testIgnore: UPDATE })),
    ...ENGINES.map(([name, device], index) => ({
      name: `${name}-update`,
      use: { ...device },
      testMatch: UPDATE,
      dependencies:
        index === 0 ? ENGINES.map(([engine]) => engine) : [`${ENGINES[index - 1]![0]}-update`],
    })),
  ],
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort`,
    url: `${ORIGIN}${APP.basePath}`,
    reuseExistingServer: !process.env['CI'],
  },
});
