import { expect, test, type Page } from '@playwright/test';

/** The plan asks for the whole onboarding in no more than 25 actions. */
async function passOnboarding(page: Page): Promise<number> {
  let actions = 0;
  const act = async (run: () => Promise<void>) => {
    await run();
    actions += 1;
  };

  await page.goto('/overview');
  await expect(page).toHaveURL(/\/welcome$/);

  await act(() => page.getByTestId('onboarding-income').fill('150000'));
  await act(() => page.getByTestId('onboarding-next').click());

  await act(() => page.getByTestId('onboarding-mandatory').fill('70000'));
  await act(() => page.getByTestId('onboarding-next').click());

  await act(() => page.getByTestId('onboarding-variable').fill('30000'));
  await expect(page.getByTestId('onboarding-free-cash')).toContainText('50 000');
  await act(() => page.getByTestId('onboarding-next').click());

  await act(() => page.getByTestId('onboarding-savings').fill('400000'));
  await act(() => page.getByTestId('onboarding-debt').fill('300000'));
  await act(() => page.getByTestId('onboarding-debt-payment').fill('12000'));
  await act(() => page.getByTestId('onboarding-next').click());

  await act(() => page.getByTestId('onboarding-goal-name').fill('Квартира'));
  await act(() => page.getByTestId('onboarding-goal-cost').fill('4000000'));
  await act(() => page.getByTestId('onboarding-goal-month').fill('2029-09'));
  await act(() => page.getByTestId('onboarding-finish').click());

  await expect(page).toHaveURL(/\/overview$/);
  return actions;
}

test.describe('onboarding', () => {
  test('five steps give a dashboard that answers the main question', async ({ page }) => {
    const actions = await passOnboarding(page);
    expect(actions).toBeLessThanOrEqual(25);

    // how much is free this month
    const freeCash = page.getByTestId('widget-free-cash');
    await expect(freeCash).toBeVisible();

    // how much to put aside for the goal
    const goals = page.getByTestId('widget-goals');
    await expect(goals).toContainText('Квартира');
    await expect(goals).toContainText('Взнос в месяц');

    // the reserve knows how many months it covers
    await expect(page.getByTestId('widget-reserve')).toContainText('месяцев расходов');

    // and the accounts of the onboarding are really there
    await page.goto('/balance');
    await expect(page.getByTestId('balance-Накопления')).toHaveText(/400\s?000/);
    await expect(page.getByTestId('balance-Кредит')).toHaveText(/300\s?000/);
  });

  test('the onboarding can be skipped and still leaves a working app', async ({ page }) => {
    await page.goto('/overview');
    await expect(page).toHaveURL(/\/welcome$/);

    await page.getByTestId('onboarding-skip').click();
    await expect(page).toHaveURL(/\/overview$/);
    await expect(page.getByTestId('dashboard-grid')).toBeVisible();
    await expect(page.getByTestId('widget-goals')).toBeVisible();
  });
});

test.describe('dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await passOnboarding(page);
  });

  test('a widget can be added, resized, moved and removed, and it survives a reload', async ({ page }) => {
    await page.getByTestId('customize-dashboard').click();

    // remove
    await page.getByTestId('remove-quick-add').click();
    await expect(page.getByTestId('widget-quick-add')).toBeHidden();

    // add from the catalogue
    await page.getByTestId('add-widget').click();
    await page.getByTestId('catalog-add-goal-progress').click();
    await expect(page.getByTestId('widget-goal-progress')).toBeVisible();

    // resize
    await page.getByTestId('size-net-worth-M').click();
    await expect(page.getByTestId('widget-net-worth')).toHaveAttribute('data-size', 'M');

    await page.reload();
    await expect(page.getByTestId('widget-quick-add')).toBeHidden();
    await expect(page.getByTestId('widget-goal-progress')).toBeVisible();
    await expect(page.getByTestId('widget-net-worth')).toHaveAttribute('data-size', 'M');
  });

  test('the order can be changed with the keyboard and comes back to standard on reset', async ({
    page,
    viewport,
  }) => {
    await page.getByTestId('customize-dashboard').click();

    const order = async () =>
      page
        .getByTestId('dashboard-grid')
        .locator('[data-testid^="widget-"]')
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-testid')));

    const before = await order();

    // dnd-kit supports the keyboard: space picks the widget up, the arrow moves it
    await page
      .getByRole('button', { name: /Перетащить/ })
      .first()
      .focus();
    // dnd-kit needs a frame between picking the widget up, moving it and dropping it.
    await page.keyboard.press('Space');
    await page.waitForTimeout(200);
    // On a wide screen the widgets stand side by side, on a phone they go one under another.
    await page.keyboard.press((viewport?.width ?? 0) >= 768 ? 'ArrowRight' : 'ArrowDown');
    await page.waitForTimeout(200);
    await page.keyboard.press('Space');
    await page.waitForTimeout(200);

    await expect.poll(order).not.toEqual(before);

    await page.reload();
    await expect.poll(order).not.toEqual(before);

    await page.getByTestId('customize-dashboard').click();
    await page.getByTestId('reset-dashboard').click();
    await page.getByTestId('confirm-action').click();

    await expect.poll(order).toEqual(before);
  });

  test('a quick operation lands in the month and changes the free balance', async ({ page }) => {
    await page.getByTestId('quick-amount').fill('2500');
    await page.getByTestId('quick-category').selectOption('cafe');
    await page.getByTestId('quick-submit').click();

    await expect(page.getByTestId('quick-saved')).toBeVisible();
    await expect(page.getByTestId('widget-free-cash')).toContainText('-2 500');
  });
});

test.describe('narrow screen', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) >= 768, 'only on a phone width');

  test('the dashboard is a single column without horizontal scrolling', async ({ page }) => {
    await passOnboarding(page);

    const widgets = page.getByTestId('dashboard-grid').locator('[data-testid^="widget-"]');
    const boxes = await widgets.evaluateAll((nodes) =>
      nodes.map((node) => node.getBoundingClientRect().left),
    );
    expect(new Set(boxes).size).toBe(1);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
