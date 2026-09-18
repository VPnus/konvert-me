import { expect, test, type Page } from '@playwright/test';

import { skipOnboarding } from './helpers';

/**
 * Stage 9: the words come from the language saved on the device, and from the language of the
 * browser when nothing is saved. The settings save it; these tests save it the same way.
 */
const english = (page: Page) => page.addInitScript(() => localStorage.setItem('konvert-me.language', 'en'));

/** Every Russian word left on the screen, with a little of its context. */
async function russianOnScreen(page: Page): Promise<string[]> {
  const text = await page.evaluate(() => document.body.innerText);
  return [...text.matchAll(/.{0,30}[А-Яа-яЁё]+.{0,30}/g)].map((match) => match[0]);
}

test.describe('the language of the page', () => {
  test('without a saved language the page follows the browser, Russian here', async ({ page }) => {
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
    await expect(page.getByTestId('onboarding-country-us')).toBeVisible();
    expect(await russianOnScreen(page)).toEqual([]);
    await page.getByTestId('onboarding-next').click();
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

  test('one press in the header of the site turns the landing into English', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Бюджет, цели и конверты');
    await page.getByTestId('language-toggle').click();

    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Budget, goals and envelopes');
    // and the introduction opens in English, with the same button in its header
    await page.getByTestId('landing-start').click();
    await expect(page.getByTestId('language-toggle')).toBeVisible();
    expect(await russianOnScreen(page)).toEqual([]);
  });

  test('the names the app wrote itself follow the language', async ({ page }) => {
    await skipOnboarding(page);

    await page.goto('/budget');
    await expect(page.getByRole('cell', { name: 'Зарплата', exact: true })).toBeVisible();

    await page.goto('/settings');
    await page.getByTestId('language-en').click();
    await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();

    await page.goto('/budget');
    await expect(page.getByRole('cell', { name: 'Salary', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Зарплата', exact: true })).toHaveCount(0);

    // a name the person gave stays theirs whatever the language
    await page.goto('/goals');
    await expect(page.getByText('Emergency fund').first()).toBeVisible();
  });

  test('the language is chosen in the settings and holds after a reload', async ({ page }) => {
    await skipOnboarding(page);

    await page.goto('/settings');
    await expect(page.getByTestId('language-ru')).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('language-en').click();

    await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await page.reload();
    await expect(page.getByTestId('language-en')).toHaveAttribute('aria-pressed', 'true');

    await page.getByTestId('language-ru').click();
    await expect(page.getByRole('heading', { name: 'Настройки', level: 1 })).toBeVisible();
  });
});

test.describe('a browser that speaks English', () => {
  test.use({ locale: 'en-US' });

  test('gets the app in English without anything saved on the device', async ({ page }) => {
    await page.goto('/welcome');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { name: 'Which currency do you count in?' })).toBeVisible();
  });
});
