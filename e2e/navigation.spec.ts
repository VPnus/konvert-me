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

  await page.getByTestId('theme-toggle').click();
  await expect(html).not.toHaveClass(/dark/);

  await page.reload();
  await expect(html).not.toHaveClass(/dark/);
});

test('the tabs walk through every section, above the page or in the column of a phone', async ({ page }) => {
  await page.goto('/overview');
  // From a tablet on the tabs stand in the bar above the page, on a phone in a column at the edge.
  const tabs = page.locator('[data-testid="tab-bar"]:visible, [data-testid="tab-rail"]:visible');
  await expect(tabs).toHaveCount(1);

  for (const tab of TABS) {
    // Not every tab shows its name, so the tabs are found by the title their links carry at every width.
    await tabs.locator(`a[title="${tab.navLabel ?? tab.heading}"]`).click();
    await expect(page).toHaveURL(new RegExp(`${tab.path}$`));
    await expect(page.getByRole('heading', { name: tab.heading, level: 1 })).toBeVisible();
  }
});

test.describe('narrow screen, 375 px', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) >= 768, 'this is about the phone layout');

  test('the tabs stand in a column at the right edge, and at the left one for the left hand', async ({
    page,
  }) => {
    await page.goto('/overview');
    const rail = page.getByTestId('tab-rail');
    await expect(rail.getByRole('link')).toHaveCount(TABS.length);
    await expect(page.getByTestId('tab-bar')).toBeHidden();

    const width = page.viewportSize()?.width ?? 375;
    const sides = async () => {
      const railBox = await rail.boundingBox();
      const pageBox = await page.getByRole('heading', { level: 1 }).boundingBox();
      if (!railBox || !pageBox) throw new Error('the tabs or the page are not on the screen');
      return { railBox, pageBox };
    };

    // a right hand by default: the column stands at the right edge, the page keeps clear of it
    let { railBox, pageBox } = await sides();
    expect(railBox.x + railBox.width).toBeCloseTo(width, 0);
    expect(pageBox.x + pageBox.width).toBeLessThanOrEqual(railBox.x);

    await page.goto('/settings');
    await page.getByTestId('hand-left').click();
    await expect(rail).toHaveAttribute('data-hand', 'left');

    await page.goto('/overview');
    ({ railBox, pageBox } = await sides());
    expect(railBox.x).toBeCloseTo(0, 0);
    expect(pageBox.x).toBeGreaterThanOrEqual(railBox.x + railBox.width);

    // the choice stays on the device
    await page.reload();
    await expect(rail).toHaveAttribute('data-hand', 'left');
  });

  test('no horizontal scrolling at 375 px, whichever hand', async ({ page }) => {
    for (const hand of ['right', 'left']) {
      await page.goto('/settings');
      await page.getByTestId(`hand-${hand}`).click();
      for (const tab of TABS) {
        await page.goto(tab.path);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `горизонтальная прокрутка на ${tab.path}, рука: ${hand}`).toBeLessThanOrEqual(0);
      }
    }
  });
});
