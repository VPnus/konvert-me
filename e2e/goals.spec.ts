import { expect, test, type Page } from '@playwright/test';

import { skipOnboarding } from './helpers';

/** The month n months after the one the browser is in, as "YYYY-MM". */
async function monthAhead(page: Page, months: number): Promise<string> {
  return page.evaluate((ahead) => {
    const now = new Date();
    const index = now.getFullYear() * 12 + now.getMonth() + ahead;
    const year = Math.floor(index / 12);
    const month = index - year * 12 + 1;
    return `${year}-${String(month).padStart(2, '0')}`;
  }, months);
}

async function addGoal(
  page: Page,
  values: { name: string; cost: string; targetMonth: string; returnRate?: string },
): Promise<void> {
  await page.getByTestId('add-goal').click();
  await page.getByTestId('goal-name').fill(values.name);
  await page.getByTestId('goal-cost').fill(values.cost);
  await page.getByTestId('goal-month').fill(values.targetMonth);
  if (values.returnRate) await page.getByTestId('goal-return').fill(values.returnRate);
  await page.getByTestId('goal-save').click();
  await expect(page.getByTestId(`goal-open-${values.name}`)).toBeVisible();
}

async function addAccount(page: Page, name: string, balance: string): Promise<void> {
  await page.goto('/balance');
  await page.getByTestId('add-account').click();
  await page.getByTestId('account-name').fill(name);
  await page.getByTestId('account-balance').fill(balance);
  await page.getByTestId('account-submit').click();
  await expect(page.getByTestId(`balance-${name}`)).toBeVisible();
}

test.describe('goals', () => {
  test('the vectors of the plan come out of the interface', async ({ page }) => {
    await skipOnboarding(page);
    await page.goto('/goals');

    // Lesson 2.2: 4 000 000 in today's prices, 36 months, inflation 8 %, return 10 %
    // → the goal will cost 5 038 848,00 and asks for 120 599,05 a month.
    await addGoal(page, { name: 'Квартира', cost: '4000000', targetMonth: await monthAhead(page, 36) });

    await expect(page.getByTestId('goal-contribution-Квартира')).toHaveText(/120\s?599/);

    await page.getByTestId('goal-open-Квартира').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText(/5\s?038\s?848/);
    await expect(dialog).toContainText(/36 месяцев/);
  });

  test('a contribution is a transfer plus an envelope, and the reserve gives that money up', async ({
    page,
  }) => {
    await skipOnboarding(page);
    await addAccount(page, 'Карта', '300000');
    await addAccount(page, 'Накопления', '0');

    await page.goto('/goals');
    await addGoal(page, { name: 'Машина', cost: '1000000', targetMonth: await monthAhead(page, 24) });

    // the reserve counts every liquid rouble while no goal has claimed any
    await expect(page.getByTestId('goal-open-Финансовый резерв')).toBeVisible();
    const reserveRow = page.getByTestId('goal-row').first();
    await expect(reserveRow).toContainText(/300\s?000/);

    await page.getByTestId('goal-open-Машина').click();
    await page.getByTestId('contribute-amount').fill('100000');
    await page.getByTestId('contribute-to').selectOption({ label: 'Накопления' });
    await page.getByTestId('contribute-from').selectOption({ label: 'Карта' });
    await page.getByTestId('contribute-save').click();
    await expect(page.getByTestId('envelope-Накопления')).toHaveValue('100000');
    await page.getByTestId('goal-details-close').click();

    // formula 9: the reserve is liquid money minus the envelopes of the other goals
    await expect(page.getByTestId('goal-row').first()).toContainText(/200\s?000/);

    // and the money moved as a transfer, not as an expense
    await page.goto('/budget');
    await expect(page.getByTestId('total-expense')).toHaveText(/^0/);
    await expect(page.getByTestId('operation-row')).toHaveCount(1);
  });

  test('the sliders only count until the button is pressed', async ({ page }) => {
    await skipOnboarding(page);
    await page.goto('/goals');
    await addGoal(page, { name: 'Отпуск', cost: '600000', targetMonth: await monthAhead(page, 12) });

    const before = await page.getByTestId('goal-contribution-Отпуск').textContent();

    await page.getByTestId('goal-open-Отпуск').click();
    await page.getByTestId('what-if-months').fill('24');

    // the panel recounts at once, the goal itself is untouched
    const whatIf = await page.getByTestId('what-if-contribution').textContent();
    expect(whatIf).not.toBe(before);
    await page.getByTestId('goal-details-close').click();
    await expect(page.getByTestId('goal-contribution-Отпуск')).toHaveText(before ?? '');

    await page.getByTestId('goal-open-Отпуск').click();
    await page.getByTestId('what-if-months').fill('24');
    await page.getByTestId('what-if-apply').click();
    await page.getByTestId('goal-details-close').click();

    await expect(page.getByTestId('goal-contribution-Отпуск')).not.toHaveText(before ?? '');
  });

  test('the free money of the month goes to the goals by priority', async ({ page }) => {
    await skipOnboarding(page);
    // operations need an account to sit on
    await addAccount(page, 'Карта', '0');
    await page.goto('/budget');
    await page.getByTestId('add-transaction').click();
    await page.getByTestId('transaction-kind').selectOption('income');
    await page.getByTestId('transaction-amount').fill('100000');
    await page.getByTestId('transaction-category').selectOption('salary');
    await page.getByTestId('transaction-save').click();
    await expect(page.getByTestId('transaction-save')).toBeHidden();

    await page.goto('/goals');
    await addGoal(page, { name: 'Первая', cost: '600000', targetMonth: await monthAhead(page, 12) });
    await addGoal(page, { name: 'Вторая', cost: '600000', targetMonth: await monthAhead(page, 12) });

    await expect(page.getByTestId('allocation-free')).toHaveText(/100\s?000/);
    // the first goal is served in full, the second gets what is left
    // the more important goal takes its whole contribution, the other one what is left
    const needed = await page.getByTestId('goal-contribution-Первая').textContent();
    await expect(page.getByTestId('goal-allocated-Первая')).toContainText(needed ?? '');
    await expect(page.getByTestId('goal-allocated-Первая')).not.toContainText('Не хватает');
    await expect(page.getByTestId('goal-allocated-Вторая')).toContainText('Не хватает');
    await expect(page.getByTestId('allocation-leftover')).toHaveText(/^0/);
    await expect(page.getByTestId('allocation-deficit')).not.toHaveText(/^0/);

    // a goal on pause asks for nothing
    await page.getByTestId('goal-pause-Вторая').click();
    await expect(page.getByTestId('goal-allocated-Вторая')).toBeHidden();
  });
});
