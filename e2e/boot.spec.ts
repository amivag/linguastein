/**
 * A first visit, in a real browser: the app opens, and its security policy is
 * enforced rather than merely present.
 */

import { expect, test } from '@playwright/test';
import { HOME_HEADING, openHome, recordedErrors } from './helpers';

test('opens on the default course with nothing going wrong', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await openHome(page);

  await expect(page).toHaveURL(/\/es\/a1$/);
  expect(errors).toEqual([]);
  expect(await recordedErrors(page)).toEqual([]);
});

test('serves a deep link as the screen it names', async ({ page }) => {
  await page.goto('./es/a1/study');

  await expect(page.getByRole('heading', { level: 1 })).not.toHaveText(HOME_HEADING);
  await expect(page.getByRole('main')).toBeVisible();
});

/*
 * Through the page's own DOM rather than `page.evaluate`, whose code arrives
 * over the debugging protocol and is exempt from the page's policy.
 */
test('refuses inline script that was not built in', async ({ page }) => {
  await openHome(page);

  await page.addScriptTag({ content: 'window.__injected = true' }).catch(() => undefined);

  expect(await page.evaluate(() => '__injected' in window)).toBe(false);
});

test('blocks HTML string sinks where the engine has Trusted Types', async ({ page }) => {
  await openHome(page);

  const result = await page.evaluate(() => {
    if (!('trustedTypes' in window)) return 'unsupported';
    try {
      document.createElement('div').innerHTML = '<b>x</b>';
      return 'allowed';
    } catch {
      return 'blocked';
    }
  });

  test.skip(result === 'unsupported', 'This engine has no Trusted Types');
  expect(result).toBe('blocked');
});
