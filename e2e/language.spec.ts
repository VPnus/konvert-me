import { expect, test, type Page } from '@playwright/test';

import { skipOnboarding } from './helpers';

/**
 * Stage 9: the words come from the language saved on the device. Nothing in the interface offers
 * English until stage 9.5, so these tests save it the way the switch will.
 */
const english = (page: Page) => page.addInitScript(() => localStorage.setItem('konvert-me.language', 'en'));

/** Every Russian word left on the screen, with a little of its context. */
async function russianOnScreen(page: Page): Promise<string[]> {
  const text = await page.evaluate(() => document.body.innerText);
  return [...text.matchAll(/.{0,30}[А-Яа-яЁё]+.{0,30}/g)].map((match) => match[0]);
}

test.describe('the language of the page', () => {
  test('without a saved language the page is Russian', async ({ page }) => {
    await skipOnboarding(page);

    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
    await expect(page).toHaveTitle('Конверкот');
    await expect(
      page.getByRole('navigation', { name: 'Разделы' }).getByRole('link', { name: 'Бюджет' }),
    ).toBeVisible();
  });

  test('in English, a newcomer reads the landing, the policy and the introduction without a Russian word', async ({
    page,
  }) => {
    await english(page);

    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page).toHaveTitle('Konvercat');
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.en.webmanifest');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Budget, goals and envelopes');
    expect(await russianOnScreen(page)).toEqual([]);

    await page.goto('/privacy');
    await expect(page.getByRole('heading', { name: 'Privacy policy', level: 1 })).toBeVisible();
    expect(await russianOnScreen(page)).toEqual([]);

    await page.goto('/welcome');
    await expect(page.getByTestId('onboarding-income')).toBeVisible();
    expect(await russianOnScreen(page)).toEqual([]);
  });

  test('in English, every section of the app has no Russian word', async ({ page }) => {
    await english(page);
    await skipOnboarding(page);

    const sections = [
      '/overview',
      '/budget',
      '/goals',
      '/balance',
      '/deductions',
      '/settings',
      ...Array.from({ length: 8 }, (_, index) => `/plan?step=${index + 1}`),
    ];
    for (const path of sections) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      // Everything a section reads from the database has arrived: no loading text is left.
      await expect(page.getByText(/Loading…|Counting…/)).toHaveCount(0);
      expect(await russianOnScreen(page), path).toEqual([]);
    }
  });
});
