/**
 * The core loop end to end: an answer is graded and saved to IndexedDB, under
 * the production content security policy.
 */

import { expect, test } from '@playwright/test';
import { recordedErrors, storedAttempts } from './helpers';

test('saves an answered card', async ({ page }) => {
  // Seeded, so the first card is the same multiple-choice card every run.
  await page.goto('./es/a1/session?seed=1');
  await expect(page.getByRole('progressbar')).toBeVisible();

  // Any answer will do: the test is about saving, not about being right. Word
  // buttons in the prompt are named "About …"; the answers are not.
  await page
    .getByRole('region')
    .getByRole('button', { name: /^(?!About )/ })
    .first()
    .click();

  await expect.poll(() => storedAttempts(page)).toBe(1);
  expect(await recordedErrors(page)).toEqual([]);
});
