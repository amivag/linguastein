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
import { expect, test } from '@playwright/test';
import { openHome, waitForServiceWorker } from './helpers';

const WORKER = join(process.cwd(), 'dist', 'sw.js');

test('offers a new build instead of reloading by itself', async ({ page }) => {
  await openHome(page);
  await waitForServiceWorker(page);
  const url = page.url();

  const original = readFileSync(WORKER, 'utf8');
  try {
    writeFileSync(WORKER, `${original}\n// next build`);
    await page.evaluate(async () => {
      await (await navigator.serviceWorker.getRegistration())?.update();
    });

    await expect(
      page.getByRole('status').filter({ hasText: 'A new version is ready.' }),
    ).toBeVisible();
    expect(page.url()).toBe(url);
  } finally {
    writeFileSync(WORKER, original);
  }
});
