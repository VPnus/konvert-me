import { expect, test, type Locator, type Page } from '@playwright/test';

import { skipOnboarding } from './helpers';

/** The plan asks for the whole onboarding in no more than 25 actions. */
async function passOnboarding(page: Page): Promise<number> {
  let actions = 0;
  const act = async (run: () => Promise<void>) => {
    await run();
    actions += 1;
  };

  await page.goto('/overview');
  await expect(page).toHaveURL(/\/welcome$/);

  // the first question is the country, and Russia is the answer already chosen
  await act(() => page.getByTestId('onboarding-next').click());

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
  test('six steps give a dashboard that answers the main question', async ({ page }) => {
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

    // resize from the keyboard: the corner is a button, not only a grip
    const netWorth = page.getByTestId('widget-net-worth');
    await expect(netWorth).toHaveAttribute('data-width', '1');
    await page.getByTestId('resize-net-worth').focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    await expect(netWorth).toHaveAttribute('data-width', '2');
    await expect(netWorth).toHaveAttribute('data-height', '2');

    await page.reload();
    await expect(page.getByTestId('widget-quick-add')).toBeHidden();
    await expect(page.getByTestId('widget-goal-progress')).toBeVisible();
    await expect(netWorth).toHaveAttribute('data-width', '2');
    await expect(netWorth).toHaveAttribute('data-height', '2');
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
    // evaluateAll does not wait: the dashboard reads the database first
    await expect(widgets.first()).toBeVisible();
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

test.describe('dashboard: a widget is resized by its corner', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 768, 'dragging a corner needs a wide screen');

  test('dragging the corner makes a widget wider, and it stays that way', async ({ page }) => {
    await passOnboarding(page);
    await page.getByTestId('customize-dashboard').click();

    // the first widget of the layout: its corner is on screen without scrolling
    const widget = page.getByTestId('widget-free-cash');
    await widget.scrollIntoViewIfNeeded();
    await expect(widget).toHaveAttribute('data-width', '2');

    const handle = page.getByTestId('resize-free-cash');
    const corner = await handle.boundingBox();
    const cell = await widget.boundingBox();
    if (!corner || !cell) throw new Error('виджет не отрисовался');

    // one column to the right: two columns become three
    const from = { x: corner.x + corner.width / 2, y: corner.y + corner.height / 2 };
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + cell.width / 2, from.y, { steps: 10 });
    await expect(widget).toHaveAttribute('data-width', '3');
    await page.mouse.up();

    await expect(widget).toHaveAttribute('data-width', '3');

    await page.reload();
    await expect(page.getByTestId('widget-free-cash')).toHaveAttribute('data-width', '3');
  });
});

test.describe('dashboard on a phone: a finger', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) >= 768, 'only on a phone width');
  test.use({ hasTouch: true, isMobile: true });

  test('pulls the corner to make a widget taller and drags a widget below the next one', async ({ page }) => {
    await skipOnboarding(page);
    await page.getByTestId('customize-dashboard').tap();

    // Touch events of the browser itself, not mouse ones: a finger that moves may scroll the page
    // instead, and that is what broke both gestures on a phone.
    const touch = await page.context().newCDPSession(page);
    const swipe = async (from: { x: number; y: number }, dy: number) => {
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] });
      for (let step = 1; step <= 20; step++) {
        const point = { x: from.x, y: from.y + (dy * step) / 20 };
        await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point] });
        await page.waitForTimeout(16);
      }
      await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    const centre = async (target: Locator) => {
      const box = await target.boundingBox();
      if (!box) throw new Error('виджет не отрисовался');
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    };

    const widget = page.getByTestId('widget-free-cash');
    await expect(widget).toHaveAttribute('data-width', '2');
    await expect(widget).toHaveAttribute('data-height', '1');

    // A row down. The phone shows one column, and the width kept for a wide screen stays.
    const corner = page.getByTestId('resize-free-cash');
    await corner.scrollIntoViewIfNeeded();
    await swipe(await centre(corner), 200);
    await expect(widget).toHaveAttribute('data-height', '2');
    await expect(widget).toHaveAttribute('data-width', '2');

    const order = () =>
      page
        .getByTestId('dashboard-grid')
        .locator('[data-testid^="widget-"]')
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-testid')));
    const [first, second, ...rest] = await order();
    expect(first).toBe('widget-free-cash');

    // The grip near the top of the screen, so the drag does not scroll the page on its own.
    await widget.evaluate((node) =>
      window.scrollTo(0, node.getBoundingClientRect().top + window.scrollY - 70),
    );
    const next = await page.getByTestId(second ?? '').boundingBox();
    if (!next) throw new Error('виджет не отрисовался');
    await swipe(await centre(widget.getByRole('button', { name: /Перетащить/ })), next.height + 60);
    await expect.poll(order).toEqual([second, first, ...rest]);

    await page.reload();
    await expect.poll(order).toEqual([second, first, ...rest]);
    await expect(page.getByTestId('widget-free-cash')).toHaveAttribute('data-height', '2');
  });
});
