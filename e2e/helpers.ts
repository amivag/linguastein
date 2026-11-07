import { expect, type Page } from '@playwright/test';

/** The course every fresh install opens on. */
export const HOME_HEADING = 'Español · A1';

export async function openHome(page: Page): Promise<void> {
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(HOME_HEADING);
}

/** What `app/diagnostics.ts` kept on the device: errors and policy violations. */
export async function recordedErrors(page: Page): Promise<readonly unknown[]> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('linguastein.errors') ?? '[]'));
}

/** Resolves once the service worker is installed and controls this page. */
export async function waitForServiceWorker(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (navigator.serviceWorker.controller) return;
    await new Promise<void>((resolve) => {
      navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true });
    });
  });
}

/** Content files this page has read that no cache holds yet. */
export async function uncachedContent(page: Page): Promise<readonly string[]> {
  return page.evaluate(async () => {
    const read = performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .filter((url) => new URL(url).pathname.endsWith('.jsonl'));
    const missing: string[] = [];
    for (const url of read) if (!(await caches.match(url))) missing.push(url);
    return missing;
  });
}

/** How many attempts the learner's database holds. */
export async function storedAttempts(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open('linguastein');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const count = db.transaction('attempts').objectStore('attempts').count();
          count.onsuccess = () => {
            db.close();
            resolve(count.result);
          };
          count.onerror = () => reject(count.error);
        };
      }),
  );
}
