/**
 * The core loop end to end: an answer is graded and saved to IndexedDB, under
 * the production content security policy.
 */

import { expect, test } from '@playwright/test';
import { recordedErrors, storedAttempts } from './helpers';

test('saves an answered card', async ({ page }) => {
  /*
   * No device voices, so the session is the same on every machine. Which voices
   * exist changes which exercises a session offers: a Linux CI runner has a
   * Spanish voice where a developer's browser may not.
   */
  await page.addInitScript(() => {
    if ('speechSynthesis' in window) speechSynthesis.getVoices = () => [];
  });
  // Seeded, so the first card is the same multiple-choice card every run.
  await page.goto('./es/a1/session?seed=1');
  await expect(page.getByRole('progressbar')).toBeVisible();

  // The first answer, by its number badge. Any answer will do: the test is
  // about saving, not about being right.
  await page
    .getByRole('region')
    .getByRole('button')
    .filter({ has: page.getByText('1', { exact: true }) })
    .click();

  await expect.poll(() => storedAttempts(page)).toBe(1);
  expect(await recordedErrors(page)).toEqual([]);
});
