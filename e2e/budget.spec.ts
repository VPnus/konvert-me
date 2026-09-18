import { expect, test, type Page } from '@playwright/test';

import { skipOnboarding } from './helpers';

/** Adds an operation through the dialog and waits for the list to take it in. */
async function addOperation(
  page: Page,
  options: {
    kind: string;
    amount: string;
    category?: string;
    account?: string;
    toAccount?: string;
    note?: string;
  },
): Promise<void> {
  await page.getByTestId('add-transaction').click();
  await page.getByTestId('transaction-kind').selectOption(options.kind);
  await page.getByTestId('transaction-amount').fill(options.amount);
  if (options.account) {
    await page.getByTestId('transaction-account').selectOption({ label: options.account });
  }
  if (options.toAccount) {
    await page.getByTestId('transaction-to-account').selectOption({ label: options.toAccount });
  }
  if (options.category) await page.getByTestId('transaction-category').selectOption(options.category);
  if (options.note) await page.getByTestId('transaction-note').fill(options.note);
  await page.getByTestId('transaction-save').click();
  await expect(page.getByTestId('transaction-save')).toBeHidden();
}

/** The budget needs an account to write operations to; the onboarding is skipped. */
async function prepare(page: Page): Promise<void> {
  await skipOnboarding(page);

  await page.goto('/balance');
  await page.getByTestId('add-account').click();
  await page.getByLabel('Название').fill('Карта');
  await page.getByLabel('Начальный остаток, ₽').fill('100000');
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByTestId('balance-Карта')).toBeVisible();

  await page.goto('/budget');
  await expect(page.getByRole('heading', { name: 'Бюджет', level: 1 })).toBeVisible();
}

test.describe('budget', () => {
  test('records operations and totals the month the way a hand calculation does', async ({ page }) => {
    await prepare(page);

    // 120 000 income, 35 000 + 18 500 expenses, 1 200 back, 30 000 moved aside
    await addOperation(page, { kind: 'income', amount: '120000', category: 'salary' });
    await addOperation(page, { kind: 'expense', amount: '35000', category: 'housing' });
    await addOperation(page, {
      kind: 'expense',
      amount: '18500',
      category: 'groceries',
      note: 'Продукты на неделю',
    });
    await addOperation(page, { kind: 'refund', amount: '1200', category: 'groceries' });

    await expect(page.getByTestId('total-income')).toHaveText(/120\s?000/);
    await expect(page.getByTestId('total-expense')).toHaveText(/52\s?300/);
    await expect(page.getByTestId('free-cash')).toHaveText(/67\s?700/);

    // the refund is already inside the groceries line: 18 500 - 1 200
    await expect(page.getByTestId('fact-groceries')).toHaveText(/17\s?300/);
  });

  test('a transfer moves money without touching the budget', async ({ page }) => {
    await prepare(page);

    await page.goto('/balance');
    await page.getByTestId('add-account').click();
    await page.getByLabel('Название').fill('Вклад');
    await page.getByLabel('Начальный остаток, ₽').fill('0');
    await page.getByLabel('Тип').selectOption('deposit');
    await page.getByRole('button', { name: 'Сохранить' }).click();
    await expect(page.getByTestId('balance-Вклад')).toBeVisible();

    await page.goto('/budget');
    // both accounts exist now, so the operation says plainly which one it is about
    await addOperation(page, { kind: 'income', amount: '50000', category: 'salary', account: 'Карта' });
    await addOperation(page, { kind: 'transfer', amount: '20000', account: 'Карта', toAccount: 'Вклад' });

    await expect(page.getByTestId('free-cash')).toHaveText(/50\s?000/);
    await expect(page.getByTestId('total-expense')).toHaveText(/^0/);

    // the money did move, it just is not an expense
    await page.goto('/balance');
    await expect(page.getByTestId('balance-Вклад')).toHaveText(/20\s?000/);
    await expect(page.getByTestId('balance-Карта')).toHaveText(/130\s?000/);
  });

  test('the plan is typed in, copied to the next month and shows the deviation', async ({ page }) => {
    await prepare(page);

    await addOperation(page, { kind: 'expense', amount: '22000', category: 'groceries' });

    await page.getByTestId('plan-groceries').fill('20000');
    await page.getByTestId('plan-groceries').blur();

    // spent 2 000 more than planned, so the plan is 2 000 in the red
    await expect(page.getByTestId('remaining-groceries')).toHaveText(/[-−]\s?2\s?000/);

    await page.getByTestId('period-next').click();
    await expect(page.getByTestId('plan-groceries')).toHaveValue('');

    await page.getByTestId('copy-plan').click();
    await expect(page.getByTestId('copy-note')).toContainText('Скопировали строк: 1');
    await expect(page.getByTestId('plan-groceries')).toHaveValue('20000');
  });

  test('operations can be found, edited and deleted', async ({ page }) => {
    await prepare(page);

    await addOperation(page, { kind: 'expense', amount: '1500', category: 'cafe', note: 'Обед с коллегой' });
    await addOperation(page, { kind: 'expense', amount: '900', category: 'fun', note: 'Кино' });

    await page.getByTestId('operations-search').fill('обед');
    await expect(page.getByTestId('operation-row')).toHaveCount(1);

    await page.getByTestId('filter-reset').click();
    await expect(page.getByTestId('operation-row')).toHaveCount(2);

    await page.getByTestId('filter-more').click();
    await page.getByTestId('filter-category-fun').click();
    await expect(page.getByTestId('operation-row')).toHaveCount(1);
    await page.getByTestId('filter-reset').click();

    // the search picks one exact row, so the edit cannot land on the wrong operation
    await page.getByTestId('operations-search').fill('кино');
    await expect(page.getByTestId('operation-row')).toHaveCount(1);
    await page
      .getByTestId('operation-row')
      .getByRole('button', { name: /Изменить/ })
      .click();
    await page.getByTestId('transaction-amount').fill('1700');
    await page.getByTestId('transaction-save').click();
    await expect(page.getByTestId('transaction-save')).toBeHidden();

    await page.getByTestId('filter-reset').click();
    await expect(page.getByTestId('total-expense')).toHaveText(/3\s?200/);

    await page
      .getByTestId('operation-row')
      .first()
      .getByRole('button', { name: /Удалить/ })
      .click();
    await page.getByTestId('confirm-action').click();
    await expect(page.getByTestId('operation-row')).toHaveCount(1);
  });

  test('the year view sums the months', async ({ page }) => {
    await prepare(page);

    await addOperation(page, { kind: 'income', amount: '80000', category: 'salary' });
    await addOperation(page, { kind: 'expense', amount: '30000', category: 'housing' });

    await page.getByTestId('tab-year').click();
    await expect(page.getByTestId('year-income')).toHaveText(/80\s?000/);
    await expect(page.getByTestId('year-expense')).toHaveText(/30\s?000/);
    await expect(page.getByTestId('year-free')).toHaveText(/50\s?000/);
  });
});
