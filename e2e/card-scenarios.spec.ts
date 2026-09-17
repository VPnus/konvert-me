import { expect, test, type Page } from '@playwright/test';

import { account, goal, operation, RUB, seed, type BackupData } from './backup-seed';
import { skipOnboarding } from './helpers';

/**
 * Regressions of the report «Рабочий и кредитка Платинум» of 17.09.2026: the worker of the first report
 * got a credit card with a grace period, statement on the 19th, the whole of it due by the 14th, 8 % but
 * not less than 600 ₽, 49,9 % once the grace period is lost, and moved 48 000 ₽ from it to the old card.
 */

const PLATINUM = 'Кредитка Платинум';

interface Household {
  readonly today: string;
  /** The transfer of 20 September from «Платинум» to the old card. */
  readonly transfer?: boolean;
  readonly platinumPayment?: { readonly date: string; readonly rubles: number };
}

function household(data: BackupData, { today, transfer = true, platinumPayment }: Household): void {
  data.accounts.push(
    account('debit', { name: 'Зарплатная карта', openingBalanceMinor: 22_000 * RUB }),
    account('savings', {
      name: 'Накопительный счёт',
      type: 'savings',
      rate: 0.13,
      openingBalanceMinor: 18_000 * RUB,
    }),
    account('kopilka', {
      name: 'Копилка на миллион',
      type: 'savings',
      rate: 0.155,
      openingDate: '2026-07-01',
      openingBalanceMinor: 0,
    }),
    account('consumer', {
      name: 'Потребительский кредит',
      side: 'liability',
      type: 'consumer',
      isLiquid: false,
      rate: 0.219,
      openingBalanceMinor: 230_000 * RUB,
      monthlyPaymentMinor: 9_800 * RUB,
      paymentDay: 5,
    }),
    account('old', {
      name: 'Кредитная карта',
      side: 'liability',
      type: 'credit_card',
      isLiquid: false,
      rate: 0.299,
      openingBalanceMinor: 60_000 * RUB,
      monthlyPaymentMinor: 3_000 * RUB,
      paymentDay: 20,
    }),
    account('closed', {
      name: 'Старая карта',
      side: 'liability',
      type: 'credit_card',
      isLiquid: false,
      rate: 0.35,
      openingBalanceMinor: 0,
      monthlyPaymentMinor: 1_000 * RUB,
      paymentDay: 22,
    }),
    account('platinum', {
      name: PLATINUM,
      side: 'liability',
      type: 'credit_card',
      isLiquid: false,
      rate: 0.499,
      openingDate: '2026-08-20',
      openingBalanceMinor: 0,
      statementDay: 19,
      paymentDay: 14,
      minPaymentRate: 0.08,
      monthlyPaymentMinor: 600 * RUB,
      creditLimitMinor: 106_000 * RUB,
      freeTransfersMinor: 50_000 * RUB,
    }),
  );

  const rows = [];
  for (const month of ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10']) {
    rows.push(
      operation(`${month}-05`, 'expense', 4_000, { accountId: 'debit', categoryId: 'loan-interest' }),
      operation(`${month}-05`, 'transfer', 5_800, { accountId: 'debit', toAccountId: 'consumer' }),
      operation(`${month}-10`, 'income', 39_000, { accountId: 'debit', categoryId: 'salary' }),
      operation(`${month}-10`, 'expense', 23_000, { accountId: 'debit', categoryId: 'housing' }),
      operation(`${month}-12`, 'expense', 18_000, { accountId: 'debit', categoryId: 'groceries' }),
      operation(`${month}-14`, 'expense', 8_000, { accountId: 'debit', categoryId: 'clothes' }),
      operation(`${month}-16`, 'expense', 3_000, { accountId: 'debit', categoryId: 'fun' }),
      operation(`${month}-20`, 'transfer', 3_000, { accountId: 'debit', toAccountId: 'old' }),
      operation(`${month}-25`, 'income', 26_000, { accountId: 'debit', categoryId: 'advance' }),
    );
    if (month !== '2026-06') {
      rows.push(operation(`${month}-26`, 'transfer', 3_000, { accountId: 'debit', toAccountId: 'kopilka' }));
    }
  }
  for (const date of [
    '2026-08-20',
    '2026-08-27',
    '2026-09-06',
    '2026-09-13',
    '2026-09-20',
    '2026-09-27',
    '2026-10-06',
    '2026-10-13',
  ]) {
    rows.push(operation(date, 'expense', 3_500, { accountId: 'platinum', categoryId: 'groceries' }));
  }
  if (transfer) {
    // the old card is repaid whole: 60 000 less four payments of 3 000
    rows.push(operation('2026-09-20', 'transfer', 48_000, { accountId: 'platinum', toAccountId: 'old' }));
  }
  if (platinumPayment) {
    rows.push(
      operation(platinumPayment.date, 'transfer', platinumPayment.rubles, {
        accountId: 'debit',
        toAccountId: 'platinum',
      }),
    );
  }
  data.transactions.push(...rows.filter((row) => String(row.date) <= today));
  data.goals.push(goal('million', 'Первый миллион', { kind: 'other', costMinor: 1_000_000 * RUB }));
}

async function open(page: Page, day: Date, options: Household): Promise<void> {
  await page.clock.setFixedTime(day);
  await skipOnboarding(page);
  await seed(page, (data) => household(data, options));
}

test.describe('the credit card of the report of 17 September', () => {
  test('the day before the due day the app asks for the whole statement, not the minimum', async ({
    page,
  }) => {
    await open(page, new Date(2026, 9, 13, 12), { today: '2026-10-13' });

    // 1 and 3: the notice above the page and the "soon" feed of the default overview
    await page.goto('/overview');
    const notice = page.getByTestId('card-reminder');
    await expect(notice).toHaveAttribute('data-kind', 'day');
    await expect(notice).toContainText(/Завтра последний день: внесите на «Кредитка Платинум» 14\s000\s₽/);
    const soon = page.getByTestId('widget-upcoming');
    await expect(soon.getByTestId(`upcoming-${PLATINUM}`)).toContainText('завтра');
    await expect(soon).toContainText(/Внести всю выписку · 14\s000\s₽/);
    await expect(soon).toContainText(/Минимум 1\s120\s₽ льготный период не сохранит/);
    // 10: the old card repaid by the transfer and the card closed long ago ask for nothing
    await expect(soon.getByTestId('upcoming-Кредитная карта')).toHaveCount(0);
    await expect(soon.getByTestId('upcoming-Старая карта')).toHaveCount(0);

    // 8, 9, 13: the terms, the limit and the dates in words on the balance
    await page.goto('/balance');
    await expect(page.getByTestId(`card-status-${PLATINUM}`)).toContainText(
      /До 14 октября внести 14\s000\s₽/,
    );
    await expect(page.getByTestId(`limit-${PLATINUM}`)).toHaveText(/Лимит 106\s000\s₽, свободно 30\s000\s₽/);
    await expect(page.getByText('выписка 19 числа, внести до 14 числа')).toBeVisible();
    await expect(page.getByText(/\d{4}-\d{2}-\d{2}/)).toHaveCount(0);

    // 7: the minimum of the card follows its debt: 9 800 + 8 % of 76 000, of 65 000 of income
    await page.goto('/plan?step=1');
    await expect(page.getByTestId('diagnosis-debt')).toContainText('24,43 %');
    // 6: the expenses are covered, the principal of the debts is not
    await expect(page.getByTestId('diagnosis-balance')).toHaveText(
      'Доходов хватает на расходы, но не на платежи по долгам',
    );

    // 5, 6, 11: the statement first, the dear loan against the piggy bank at 15,5 %, no saving at a loss
    await page.goto('/plan?step=7');
    const actions = page.getByTestId(/^action-/);
    await expect(actions.first()).toHaveAttribute('data-testid', 'action-statement:platinum:2026-10-14');
    await expect(page.getByTestId('action-debt:consumer')).toBeVisible();
    await expect(page.getByTestId('action-debt:old')).toHaveCount(0);
    await expect(page.getByTestId('action-contribution:million')).toHaveCount(0);

    await page.goto('/plan?step=5');
    await expect(page.getByTestId('plan-debt-platinum')).toContainText('Досрочно гасить не нужно');
    await expect(page.getByTestId('plan-debt-consumer')).toContainText('15,5 % на «Копилка на миллион»');
    await expect(page.getByTestId('plan-debt-old')).toHaveCount(0);
  });

  test('after the due day, with the minimum paid only, the app says the grace period is lost', async ({
    page,
  }) => {
    await open(page, new Date(2026, 9, 15, 12), {
      today: '2026-10-15',
      platinumPayment: { date: '2026-10-10', rubles: 6_080 },
    });

    // 2: a warning, the paid part, the rate and the interest of a month on 69 920
    await page.goto('/overview');
    const notice = page.getByTestId('card-reminder');
    await expect(notice).toHaveAttribute('data-kind', 'missed');
    await expect(notice).toContainText(/прошёл 14 октября: записано 6\s080\s₽ из 14\s000\s₽/);
    await expect(notice).toContainText(/по ставке 49,9 % с даты покупок: около 2\s908\s₽ в месяц/);
    await expect(page.getByTestId('widget-warnings')).toContainText(
      'Льготный период по «Кредитка Платинум» потерян',
    );

    await page.goto('/balance');
    await expect(page.getByTestId(`card-status-${PLATINUM}`)).toContainText('Льготный период потерян');

    // hidden, it stays hidden for this statement
    await page.goto('/overview');
    await page.getByTestId('card-reminder-dismiss').click();
    await expect(notice).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Обзор', level: 1 })).toBeVisible();
    await expect(notice).toHaveCount(0);
  });

  test('a transfer from the card to the old one says when it has to come back and that nothing is free', async ({
    page,
  }) => {
    await open(page, new Date(2026, 8, 20, 12), { today: '2026-09-20', transfer: false });

    // 4
    await page.goto('/budget');
    await page.getByTestId('add-transaction').click();
    await page.getByTestId('transaction-kind').selectOption('transfer');
    await page.getByTestId('transaction-account').selectOption({ label: PLATINUM });
    await page.getByTestId('transaction-to-account').selectOption({ label: 'Кредитная карта' });
    await page.getByTestId('transaction-amount').fill('48000');

    const warning = page.getByTestId('card-transfer-warning');
    await expect(warning).toContainText(/до 14 ноября: к этому дню понадобится около 65\s500\s₽/);
    await expect(warning).toContainText('свободных денег после платежей по долгам в обычный месяц нет');
    await expect(warning).toContainText('долг под 29,9 % станет долгом под 49,9 %');

    await page.getByTestId('transaction-amount').fill('60000');
    await expect(warning).toContainText(/без комиссии можно перевести ещё 50\s000\s₽/);
  });

  test('the terms of a card go in through the form, and the interest of a savings account is one tap', async ({
    page,
  }) => {
    await open(page, new Date(2026, 8, 17, 12), { today: '2026-09-17', transfer: false });

    // 8: the terms of the contract, typed by the person
    await page.goto('/balance');
    await page.getByTestId('add-account').click();
    await page.getByTestId('account-name').fill('Карта 55 дней');
    await page.getByTestId('account-side').selectOption('liability');
    await page.getByTestId('account-type').selectOption('credit_card');
    await page.getByTestId('account-balance').fill('0');
    await page.getByTestId('account-rate').fill('39,9');
    await page.getByTestId('account-credit-limit').fill('50000');
    await expect(page.getByTestId('account-grace')).toBeVisible();
    await page.getByTestId('account-statement-day').fill('5');
    // a card with a statement every month has no one date of grace
    await expect(page.getByTestId('account-grace')).toHaveCount(0);
    await page.getByTestId('account-submit').click();
    await expect(page.getByTestId('account-error')).toContainText('до какого числа нужно внести выписку');
    await page.getByTestId('account-payment-day').fill('25');
    await page.getByTestId('account-min-payment-rate').fill('5');
    await page.getByTestId('account-payment').fill('500');
    await page.getByTestId('account-free-transfers').fill('30000');
    await page.getByTestId('account-submit').click();
    await expect(page.getByText('выписка 5 числа, внести до 25 числа')).toBeVisible();
    await expect(page.getByTestId('limit-Карта 55 дней')).toHaveText(/Лимит 50\s000\s₽, свободно 50\s000\s₽/);

    // 11: 18 000 at 13 % through August, counted on every day, ready to be checked and saved
    const interest = page.getByTestId('interest-card');
    await expect(interest).toContainText('Проценты на остаток за август 2026');
    await expect(interest).toContainText(/ставка 13 %, около 198,74\s₽/);
    await page.getByTestId('interest-record-Накопительный счёт').click();
    await expect(page.getByTestId('transaction-amount')).toHaveValue('198.74');
    await expect(page.getByTestId('transaction-category')).toHaveValue('interest');
    await page.getByTestId('transaction-save').click();
    await expect(page.getByTestId('interest-record-Накопительный счёт')).toHaveCount(0);

    // 12: a category for bank fees from the start, and one's own
    await page.goto('/budget');
    await page.getByTestId('category-name').fill('Питомец');
    await page.getByTestId('category-group').selectOption('variable');
    await page.getByTestId('category-add').click();
    await expect(page.getByTestId('category-message')).toHaveText('Категория «Питомец» добавлена.');
    await page.getByTestId('add-transaction').click();
    const categories = page.getByTestId('transaction-category');
    await expect(categories.locator('option', { hasText: 'Питомец' })).toHaveCount(1);
    await expect(categories.locator('option', { hasText: 'Подписки и комиссии' })).toHaveCount(1);
  });
});
