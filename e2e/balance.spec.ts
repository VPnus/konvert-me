import { expect, test, type Page } from '@playwright/test';

import { skipOnboarding } from './helpers';

interface AccountValues {
  name: string;
  side?: 'asset' | 'liability';
  type?: string;
  balance: string;
  openingDate?: string;
  bank?: string;
  payment?: string;
  paymentDay?: string;
  maturity?: string;
}

async function addAccount(page: Page, values: AccountValues): Promise<void> {
  await page.getByTestId('add-account').click();
  await page.getByTestId('account-name').fill(values.name);
  if (values.side) await page.getByTestId('account-side').selectOption(values.side);
  if (values.type) await page.getByTestId('account-type').selectOption(values.type);
  await page.getByTestId('account-balance').fill(values.balance);
  if (values.openingDate) await page.getByTestId('account-date').fill(values.openingDate);
  if (values.bank) await page.getByTestId('account-bank').fill(values.bank);
  if (values.payment) await page.getByTestId('account-payment').fill(values.payment);
  if (values.paymentDay) await page.getByTestId('account-payment-day').fill(values.paymentDay);
  if (values.maturity) await page.getByTestId('account-maturity').fill(values.maturity);
  await page.getByTestId('account-submit').click();
  await expect(page.getByTestId(`balance-${values.name}`)).toBeVisible();
}

/** A date the given number of days from the browser's today, as "YYYY-MM-DD". */
async function dateAhead(page: Page, days: number): Promise<string> {
  return page.evaluate((ahead) => {
    const date = new Date();
    date.setDate(date.getDate() + ahead);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  }, days);
}

test.describe('balance', () => {
  test('capital and the debt burden match a hand calculation', async ({ page }) => {
    await skipOnboarding(page);
    await page.goto('/balance');

    // 100 000 on a card against a 300 000 loan → capital is −200 000
    await addAccount(page, { name: 'Карта', balance: '100000' });
    await addAccount(page, {
      name: 'Кредит',
      side: 'liability',
      type: 'consumer',
      balance: '300000',
      payment: '12000',
      paymentDay: '10',
    });

    await expect(page.getByTestId('net-worth')).toHaveText(/[-−]\s?200\s?000/);

    // 12 000 of payments against 60 000 of income is 20 % — within the norm of 25 %
    await page.goto('/budget');
    await page.getByTestId('add-transaction').click();
    await page.getByTestId('transaction-kind').selectOption('income');
    await page.getByTestId('transaction-amount').fill('60000');
    await page.getByTestId('transaction-account').selectOption({ label: 'Карта' });
    await page.getByTestId('transaction-category').selectOption('salary');
    await page.getByTestId('transaction-save').click();
    await expect(page.getByTestId('transaction-save')).toBeHidden();

    await page.goto('/overview');
    const burden = page.getByTestId('widget-debt-burden');
    await expect(burden).toContainText('20 %');
    await expect(burden).toContainText('В норме');

    // and the capital moved with the salary: 160 000 − 300 000
    await page.goto('/balance');
    await expect(page.getByTestId('net-worth')).toHaveText(/[-−]\s?140\s?000/);
  });

  test('the capital chart appears once there is more than one month of history', async ({ page }) => {
    await skipOnboarding(page);
    await page.goto('/balance');

    await addAccount(page, { name: 'Карта', balance: '50000' });
    // one month, one point: a line needs two
    await expect(page.getByTestId('capital-empty')).toBeVisible();

    await addAccount(page, {
      name: 'Старый вклад',
      type: 'deposit',
      balance: '200000',
      openingDate: await dateAhead(page, -200),
    });

    await expect(page.getByTestId('capital-chart')).toBeVisible();
  });

  test('deposits of one bank are checked against the insurance limit', async ({ page }) => {
    await skipOnboarding(page);
    await page.goto('/balance');

    await addAccount(page, { name: 'Вклад 1', type: 'deposit', balance: '900000', bank: 'Банк А' });
    await expect(page.getByTestId('insurance-Банк А')).not.toContainText('Сверх лимита');

    await addAccount(page, { name: 'Вклад 2', type: 'deposit', balance: '700000', bank: 'Банк А' });

    // 1 600 000 in one bank: 200 000 of it is not insured
    await expect(page.getByTestId('insurance-Банк А')).toContainText(/1\s?600\s?000/);
    await expect(page.getByTestId('insurance-Банк А')).toContainText(/Сверх лимита\s?200\s?000/);
  });

  test('a policy is added, counted down and removed', async ({ page }) => {
    await skipOnboarding(page);
    await page.goto('/balance');
    await expect(page.getByTestId('policies-empty')).toBeVisible();

    await page.getByTestId('add-policy').click();
    await page.getByTestId('policy-name').fill('ОСАГО');
    await page.getByTestId('policy-end').fill(await dateAhead(page, 10));
    await page.getByTestId('policy-sum').fill('400000');
    await page.getByTestId('policy-save').click();

    await expect(page.getByTestId('policy-row')).toHaveCount(1);
    await expect(page.getByTestId('policy-left-ОСАГО')).toContainText('через 10 дней');

    await page.getByRole('button', { name: 'Удалить полис: ОСАГО' }).click();
    await page.getByTestId('confirm-action').click();
    await expect(page.getByTestId('policies-empty')).toBeVisible();
  });

  test('the soon feed shows the dates that are about to matter', async ({ page }) => {
    await skipOnboarding(page);
    await page.goto('/balance');

    await addAccount(page, {
      name: 'Вклад',
      type: 'deposit',
      balance: '100000',
      maturity: await dateAhead(page, 12),
    });

    await page.getByTestId('add-policy').click();
    await page.getByTestId('policy-name').fill('ДМС');
    await page.getByTestId('policy-end').fill(await dateAhead(page, 3));
    await page.getByTestId('policy-save').click();
    await expect(page.getByTestId('policy-row')).toHaveCount(1);

    // the feed stands on the default overview: the catalog knows it is already there
    await page.goto('/overview');
    await page.getByTestId('customize-dashboard').click();
    await page.getByTestId('add-widget').click();
    await expect(page.getByTestId('catalog-add-upcoming')).toBeDisabled();
    await page.keyboard.press('Escape');

    const widget = page.getByTestId('widget-upcoming');
    await expect(widget).toBeVisible();
    // the policy runs out first, so it stands above the deposit
    await expect(widget.getByTestId('upcoming-ДМС')).toContainText('через 3 дня');
    await expect(widget.getByTestId('upcoming-Вклад')).toContainText('через 12 дней');
  });
});
