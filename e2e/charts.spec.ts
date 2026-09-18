import { expect, test } from '@playwright/test';

import { account, goal, operation, RUB, seed, type BackupData } from './backup-seed';
import { skipOnboarding } from './helpers';

/**
 * Stage 4d: the pictures. Every one of them is drawn from the same numbers as the table beside it,
 * so the test reads both and compares them instead of trusting the picture.
 */

function household(data: BackupData): void {
  data.accounts.push(
    account('card', { name: 'Карта', openingBalanceMinor: 60_000 * RUB }),
    account('savings', { name: 'Накопительный', type: 'savings', openingBalanceMinor: 200_000 * RUB }),
    account('loan', {
      name: 'Потребкредит',
      side: 'liability',
      type: 'consumer',
      isLiquid: false,
      openingBalanceMinor: 120_000 * RUB,
      monthlyPaymentMinor: 8_000 * RUB,
    }),
  );

  for (const month of ['2026-07', '2026-08', '2026-09']) {
    data.transactions.push(
      operation(`${month}-05`, 'expense', 25_000, { accountId: 'card', categoryId: 'housing' }),
      operation(`${month}-10`, 'income', 90_000, { accountId: 'card', categoryId: 'salary' }),
      operation(`${month}-12`, 'expense', 18_000, { accountId: 'card', categoryId: 'groceries' }),
      operation(`${month}-14`, 'expense', 7_000, { accountId: 'card', categoryId: 'cafe' }),
      operation(`${month}-16`, 'expense', 3_000, { accountId: 'card', categoryId: 'transport' }),
    );
  }

  data.goals.push(goal('flat', 'Квартира', { costMinor: 900_000 * RUB, targetMonth: '2031-09' }));
}

test.describe('the charts', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date(2026, 8, 18, 12));
    await skipOnboarding(page);
    await seed(page, household);
  });

  test('the expenses by category add up to the total of the table', async ({ page }) => {
    await page.goto('/budget');

    await expect(page.getByTestId('category-chart')).toBeVisible();
    // four categories, the biggest of them named on the axis
    await expect(page.getByTestId('chart-pick-housing')).toBeVisible();
    await expect(page.getByTestId('chart-pick-groceries')).toBeVisible();
    await expect(page.getByTestId('category-chart')).toContainText('Жильё и ЖКУ');

    // 25 000 + 18 000 + 7 000 + 3 000 is what the table calls the expenses of the month
    await expect(page.getByTestId('total-expense')).toHaveText(/53\s?000/);
  });

  test('a row of the chart filters the list under it', async ({ page }) => {
    await page.goto('/budget');

    await page.getByTestId('chart-pick-cafe').click();
    await expect(page).toHaveURL(/category=cafe/);
    await expect(page.getByTestId('operation-row')).toHaveCount(1);
    // the bar that is filtered by stands out, and the others stay to compare it with
    await expect(page.getByTestId('chart-pick-cafe')).toHaveAttribute('fill-opacity', '1');
    await expect(page.getByTestId('chart-pick-housing')).toHaveAttribute('fill-opacity', '0.62');

    // and off again
    await page.getByTestId('chart-pick-cafe').click();
    await expect(page.getByTestId('operation-row')).toHaveCount(5);
  });

  test('the year view draws the months and still holds its table', async ({ page }) => {
    await page.goto('/budget');
    await page.getByTestId('tab-year').click();

    await expect(page.getByTestId('year-chart')).toBeVisible();
    await expect(page.getByTestId('year-row-2026-09')).toBeVisible();
  });

  test('the dashboard shows the shape of the year', async ({ page }) => {
    await page.goto('/overview');

    await expect(page.getByTestId('trend-chart')).toBeVisible();
    // 90 000 in, 53 000 out
    await expect(page.getByTestId('trend-this-month')).toHaveText(/37\s?000/);
  });

  test('the free money of the month is drawn as one bar', async ({ page }) => {
    await page.goto('/goals');

    await expect(page.getByTestId('allocation-chart')).toBeVisible();
    await expect(page.getByTestId('allocation-chart')).toContainText('Резерв и цели');
  });

  test('the capital is shown as what it is made of', async ({ page }) => {
    await page.goto('/balance');

    await expect(page.getByTestId('mix-assets')).toContainText('Накопительный счёт');
    await expect(page.getByTestId('mix-debts')).toContainText('Потребительский кредит');
  });
});
