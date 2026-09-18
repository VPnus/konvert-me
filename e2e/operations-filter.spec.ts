import { expect, test } from '@playwright/test';

import { account, operation, RUB, seed, type BackupData } from './backup-seed';
import { skipOnboarding } from './helpers';

/**
 * Stage 4c: the list of operations answers a period, not a single month. What a user asked for:
 * to pick a month or a category and find the row at once instead of walking through everything.
 */

/** Four months of groceries, one cafe row of the current month and a salary. */
function months(data: BackupData): void {
  data.accounts.push(account('card', { name: 'Карта', openingBalanceMinor: 500_000 * RUB }));

  for (const [month, amount] of [
    ['2026-06', 4_100],
    ['2026-07', 5_200],
    ['2026-08', 6_300],
    ['2026-09', 7_400],
  ] as const) {
    data.transactions.push(
      operation(`${month}-12`, 'expense', amount, { accountId: 'card', categoryId: 'groceries' }),
    );
  }

  data.transactions.push(
    operation('2026-09-10', 'income', 90_000, { accountId: 'card', categoryId: 'salary' }),
    operation('2026-09-14', 'expense', 1_200, { accountId: 'card', categoryId: 'cafe' }),
  );
}

test.describe('the operations of any period', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date(2026, 8, 18, 12));
    await skipOnboarding(page);
    await seed(page, months);
    await page.goto('/budget');
  });

  test('finds a purchase three months back without walking the months', async ({ page }) => {
    // the month alone knows nothing of June
    await expect(page.getByTestId('operation-row')).toHaveCount(3);

    await page.getByTestId('period-quarter').click();
    await expect(page.getByTestId('operation-row')).toHaveCount(5);

    await page.getByTestId('period-all').click();
    await page.getByTestId('filter-more').click();
    await page.getByTestId('filter-category-groceries').click();

    await expect(page.getByTestId('operation-row')).toHaveCount(4);
    await expect(page.getByTestId('operations-count')).toContainText('4');
    // 4 100 + 5 200 + 6 300 + 7 400
    await expect(page.getByTestId('operations-totals')).toContainText(/23\s?000/);
  });

  test('the filter lives in the address and survives a reload', async ({ page }) => {
    await page.getByTestId('period-year').click();
    await page.getByTestId('filter-only-expenses').click();

    await expect(page).toHaveURL(/period=year/);
    await expect(page).toHaveURL(/kind=expense/);

    await page.reload();
    await expect(page.getByTestId('period-year')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('operation-row')).toHaveCount(5);
  });

  test('a link with a category opens the budget already filtered', async ({ page }) => {
    await page.goto('/budget?period=all&category=cafe');

    await expect(page.getByTestId('operation-row')).toHaveCount(1);
    await expect(page.getByTestId('operations-count')).toContainText('1');
  });

  test('a category of the table filters the list below it', async ({ page }) => {
    await page.getByTestId('pick-groceries').click();

    await expect(page.getByTestId('operation-row')).toHaveCount(1);
    await expect(page).toHaveURL(/category=groceries/);
  });

  test('own dates take exactly what falls between them', async ({ page }) => {
    await page.getByTestId('period-custom').click();
    await page.getByTestId('period-from').fill('2026-07-01');
    await page.getByTestId('period-to').fill('2026-08-31');

    await expect(page.getByTestId('operation-row')).toHaveCount(2);
    await expect(page.getByTestId('operations-totals')).toContainText(/11\s?500/);
  });

  test('the sums over the found rows follow the filter', async ({ page }) => {
    await page.getByTestId('period-all').click();
    await expect(page.getByTestId('operations-totals')).toContainText(/90\s?000/);

    await page.getByTestId('filter-only-expenses').click();
    await expect(page.getByTestId('operations-totals')).toContainText(/24\s?200/);
  });
});
