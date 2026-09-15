import { expect, test } from '@playwright/test';

import { skipOnboarding } from './helpers';

const TABS: { path: string; heading: string; navLabel?: string }[] = [
  { path: '/overview', heading: 'Обзор' },
  { path: '/budget', heading: 'Бюджет' },
  { path: '/goals', heading: 'Цели' },
  { path: '/balance', heading: 'Счета и долги', navLabel: 'Баланс' },
  { path: '/deductions', heading: 'Вычеты' },
  { path: '/plan', heading: 'Финплан' },
  { path: '/settings', heading: 'Настройки' },
];

test.beforeEach(async ({ page }) => {
  await skipOnboarding(page);
});

test('the root redirects to the overview tab', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/overview$/);
  await expect(page.getByRole('heading', { name: 'Обзор', level: 1 })).toBeVisible();
});

test('every tab opens by its own url', async ({ page }) => {
  for (const tab of TABS) {
    await page.goto(tab.path);
    await expect(page.getByRole('heading', { name: tab.heading, level: 1 })).toBeVisible();
  }
});

test('an unknown url shows the not found page', async ({ page }) => {
  await page.goto('/there-is-no-such-tab');
  await expect(page.getByRole('heading', { name: 'Страница не найдена', level: 1 })).toBeVisible();
});

test('the theme toggle switches between dark and light and survives a reload', async ({ page }) => {
  await page.goto('/overview');
  const html = page.locator('html');
  await expect(html).toHaveClass(/dark/);

  // The sidebar toggle is hidden on a narrow screen and the header one on a wide screen.
  await page.locator('[data-testid="theme-toggle"]:visible').first().click();
  await expect(html).not.toHaveClass(/dark/);

  await page.reload();
  await expect(html).not.toHaveClass(/dark/);
});

test('the tab bar above the page walks through every tab', async ({ page }) => {
  await page.goto('/overview');
  const tabs = page.getByTestId('tab-bar');

  for (const tab of TABS) {
    // On a narrow screen only the open tab keeps its name, so the tabs are found by
    // the title their links carry at every width.
    await tabs.locator(`a[title="${tab.navLabel ?? tab.heading}"]`).click();
    await expect(page).toHaveURL(new RegExp(`${tab.path}$`));
    await expect(page.getByRole('heading', { name: tab.heading, level: 1 })).toBeVisible();
  }
});

test.describe('narrow screen, 375 px', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) >= 768, 'this is about the phone layout');

  test('the tab bar fits the width and nothing is pinned to the bottom', async ({ page }) => {
    await page.goto('/overview');

    await expect(page.getByTestId('tab-bar').getByRole('link')).toHaveCount(TABS.length);
    await expect(page.locator('nav.fixed')).toHaveCount(0);
  });

  test('no horizontal scrolling at 375 px', async ({ page }) => {
    for (const tab of TABS) {
      await page.goto(tab.path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `горизонтальная прокрутка на ${tab.path}`).toBeLessThanOrEqual(0);
    }
  });
});
