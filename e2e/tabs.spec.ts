/**
 * Two tabs, two builds, one database (`docs/storage.md`).
 *
 * A newer build in another tab opens the database at a higher version. The old
 * tab must let go, so the upgrade can run, and must say it can no longer save.
 * jsdom's fake IndexedDB covers the logic; this covers the browsers.
 */

import { expect, test } from '@playwright/test';
import { openHome } from './helpers';

test('an old tab steps aside for a newer build and asks to reload', async ({ context }) => {
  const old = await context.newPage();
  await openHome(old);

  const newer = await context.newPage();
  await newer.goto('./robots.txt');
  const upgraded = await newer.evaluate(
    () =>
      new Promise<string>((resolve) => {
        const open = indexedDB.open('linguastein', 1_000);
        open.onblocked = () => resolve('blocked');
        open.onerror = () => resolve(`error: ${open.error?.message}`);
        open.onsuccess = () => {
          open.result.close();
          resolve('upgraded');
        };
      }),
  );

  expect(upgraded).toBe('upgraded');
  await expect(old.getByRole('alert')).toContainText('This tab can no longer save progress.');
  await expect(old.getByRole('button', { name: 'Later' })).toHaveCount(0);
});
