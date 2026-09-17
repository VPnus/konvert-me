import { expect, test } from '@playwright/test';

import { skipOnboarding } from './helpers';

/**
 * Stage 9: the words come from the language saved on the device. Nothing in the interface offers
 * English until the translation is whole (9.5), so these tests save it the way the switch will.
 */
test.describe('the language of the page', () => {
  test('without a saved language the page is Russian', async ({ page }) => {
    await skipOnboarding(page);

    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
    await expect(
      page.getByRole('navigation', { name: 'Разделы' }).getByRole('link', { name: 'Бюджет' }),
    ).toBeVisible();
  });

  test('a saved English is the language of the page, with the words translated so far', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('konvert-me.language', 'en'));
    await skipOnboarding(page);

    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    const sections = page.getByRole('navigation', { name: 'Sections' });
    await expect(sections.getByRole('link', { name: 'Budget' })).toBeVisible();
    await expect(sections.getByRole('link', { name: 'Бюджет' })).toHaveCount(0);

    // What is not translated yet stays Russian, and the app works as it did.
    await expect(page.getByRole('heading', { name: 'Обзор', level: 1 })).toBeVisible();
  });
});
