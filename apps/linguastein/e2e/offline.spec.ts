/**
 * Offline after one visit.
 *
 * The promise of an installable app is that it opens on a train. The shell is
 * precached; the content the course read is runtime-cached. This checks that the
 * two together are enough to reopen with no network at all.
 */

import { expect, test } from '@playwright/test';
import { HOME_HEADING, openHome, uncachedContent, waitForServiceWorker } from './helpers';

test('reopens with no network once it has been visited', async ({ page, context }) => {
  await openHome(page);
  await waitForServiceWorker(page);
  // What boot read before the worker existed is cached after it arrives
  // (`keepWhatWasRead`); going offline before that finishes is a different test.
  await expect.poll(() => uncachedContent(page)).toEqual([]);

  await context.setOffline(true);
  await page.reload();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(HOME_HEADING);
});
