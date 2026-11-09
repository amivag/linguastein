/**
 * A new build arriving while the app is open.
 *
 * The page must not reload itself (it could land mid-answer); it offers the
 * reload instead (`app/updates.ts`). A new build is simulated by changing one
 * byte of the served `sw.js`, which is all the browser compares. Playwright
 * cannot intercept a service worker's own script request, so the file on disk
 * changes, and is put back afterwards. That is why this file runs in its own
 * projects, after every other test and one engine at a time
 * (`playwright.config.ts`).
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Request } from '@playwright/test';
import { openHome, uncachedContent, waitForServiceWorker } from './helpers';

const WORKER = join(process.cwd(), 'dist', 'sw.js');

test('offers a new build instead of reloading by itself', async ({ page, context }) => {
  // Every request in the context, the service worker's own included, so a
  // failure can name whatever is still open: a waiting worker takes over only
  // once the active one has no events in flight.
  const open = new Map<object, string>();
  const label = (request: Request) =>
    `${request.serviceWorker() ? 'sw' : 'page'} ${request.method()} ${request.url()}`;
  context.on('request', (request) => open.set(request, label(request)));
  context.on('requestfinished', (request) => open.delete(request));
  context.on('requestfailed', (request) => open.delete(request));

  await openHome(page);
  await waitForServiceWorker(page);
  await expect.poll(() => uncachedContent(page)).toEqual([]);
  await expect.poll(() => open.size).toBe(0);
  const url = page.url();

  const original = readFileSync(WORKER, 'utf8');
  try {
    writeFileSync(WORKER, `${original}\n// next build`);
    await page.evaluate(async () => {
      await (await navigator.serviceWorker.getRegistration())?.update();
    });

    try {
      await expect(
        page.getByRole('status').filter({ hasText: 'A new version is ready.' }),
        // Installing the new worker re-checks every precached file; CI runners can
        // take longer than the default five seconds to do it.
      ).toBeVisible({ timeout: 20_000 });
    } catch (error) {
      // What the worker and page were doing, in the failure message itself, since
      // a CI log is the only place a failure here can be read.
      const state = await page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        return {
          active: registration?.active?.state ?? null,
          waiting: registration?.waiting?.state ?? null,
          installing: registration?.installing?.state ?? null,
          controlled: Boolean(navigator.serviceWorker.controller),
          url: location.href,
          h1: document.querySelector('h1')?.textContent ?? null,
          statuses: [...document.querySelectorAll('[role=status],[role=alert]')].map(
            (node) => node.textContent,
          ),
          errors: localStorage.getItem('linguastein.errors'),
          media: [...document.querySelectorAll('audio,video')].map(
            (node) =>
              `${(node as HTMLMediaElement).currentSrc}:${(node as HTMLMediaElement).networkState}`,
          ),
          unfinished: performance
            .getEntriesByType('resource')
            .filter((entry) => (entry as PerformanceResourceTiming).responseEnd === 0)
            .map((entry) => entry.name),
          resources: performance.getEntriesByType('resource').length,
        };
      });
      const first = (error as Error).message.split('\n')[0];
      const pending = JSON.stringify([...open.values()]);
      // Inside each worker: can it still reach its caches and the IndexedDB that
      // Workbox's cache expiry writes to? A stuck one holds activation back.
      const workers = await Promise.all(
        context.serviceWorkers().map((worker) =>
          worker
            .evaluate(async () => {
              const within = <T>(work: Promise<T>) =>
                Promise.race([
                  work.then(() => 'ok'),
                  new Promise<string>((resolve) => setTimeout(() => resolve('timeout'), 3000)),
                ]).catch((reason: unknown) => `error ${String(reason)}`);
              const idb = new Promise<void>((resolve, reject) => {
                const request = indexedDB.open('workbox-expiration');
                request.onsuccess = () => {
                  request.result.close();
                  resolve();
                };
                request.onerror = () => reject(request.error);
                request.onblocked = () => reject(new Error('blocked'));
              });
              return {
                url: (globalThis as unknown as { location: Location }).location.href,
                caches: await within(caches.keys()),
                expiration: await within(idb),
              };
            })
            .catch((reason: unknown) => ({ error: String(reason) })),
        ),
      );
      throw new Error(
        `${first}\nstate: ${JSON.stringify(state)}\nopen: ${pending}\nworkers: ${JSON.stringify(workers)}`,
      );
    }
    expect(page.url()).toBe(url);
  } finally {
    writeFileSync(WORKER, original);
  }
});
