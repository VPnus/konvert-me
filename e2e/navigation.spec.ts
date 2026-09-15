import { expect, test } from '@playwright/test';

const TABS: { path: string; heading: string; navLabel?: string }[] = [
  { path: '/overview', heading: 'Обзор' },
  { path: '/budget', heading: 'Бюджет' },
  { path: '/goals', heading: 'Цели' },
  { path: '/balance', heading: 'Счета и долги', navLabel: 'Баланс' },
  { path: '/deductions', heading: 'Вычеты' },
  { path: '/plan', heading: 'Финплан' },
  { path: '/settings', heading: 'Настройки' },
];

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

test.describe('wide screen', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 768, 'the sidebar only exists on a wide screen');

  test('the sidebar navigates between tabs', async ({ page }) => {
    await page.goto('/overview');
    const sidebar = page.getByRole('complementary');

    for (const tab of TABS) {
      await sidebar.getByRole('link', { name: tab.navLabel ?? tab.heading, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${tab.path}$`));
      await expect(page.getByRole('heading', { name: tab.heading, level: 1 })).toBeVisible();
    }
  });
});

test.describe('narrow screen, 375 px', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) >= 768, 'the bottom bar only exists on a narrow screen');

  test('the bottom bar navigates and "Ещё" opens the remaining tabs', async ({ page }) => {
    await page.goto('/overview');
    const bottomBar = page.locator('nav.fixed');

    await bottomBar.getByRole('link', { name: 'Цели' }).click();
    await expect(page).toHaveURL(/\/goals$/);

    await page.getByTestId('nav-more').click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();

    await sheet.getByRole('link', { name: 'Настройки' }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByRole('heading', { name: 'Настройки', level: 1 })).toBeVisible();
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
