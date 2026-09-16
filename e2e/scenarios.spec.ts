import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { skipOnboarding } from './helpers';

/**
 * Regressions of the scenario report of 16.09.2026: two people walked the app through, an
 * entrepreneur and a worker, and what went wrong for them is kept here. The data goes in through
 * a backup file, as three months of a real household would, and the screens are read as they are.
 */

type Row = Record<string, unknown>;
interface BackupData {
  accounts: Row[];
  transactions: Row[];
  goals: Row[];
  envelopes: Row[];
  [table: string]: Row[];
}

const RUB = 100;

/** Exports what the app has, lets the test add its rows, and imports the file back. */
async function seed(page: Page, fill: (data: BackupData) => void): Promise<void> {
  await page.goto('/settings');
  const download = page.waitForEvent('download');
  await page.getByTestId('backup-export').click();
  const file = join(await mkdtemp(join(tmpdir(), 'konverkot-scenario-')), 'backup.json');
  await (await download).saveAs(file);

  const backup = JSON.parse(await readFile(file, 'utf8')) as { data: BackupData };
  fill(backup.data);
  await writeFile(file, JSON.stringify(backup));

  await page.getByTestId('backup-import').setInputFiles(file);
  await page.getByTestId('confirm-action').click();
  await expect(page.getByTestId('backup-message')).toContainText('восстановлены');
}

function account(id: string, patch: Row): Row {
  return {
    id,
    currency: 'RUB',
    side: 'asset',
    type: 'debit',
    openingDate: '2026-06-01',
    isLiquid: true,
    archived: false,
    createdAt: 1,
    updatedAt: 1,
    ...patch,
  };
}

let created = 0;
function operation(date: string, kind: string, rubles: number, patch: Row = {}): Row {
  created += 1;
  return {
    id: `op-${created}`,
    date,
    kind,
    amountMinor: Math.round(rubles * RUB),
    createdAt: created,
    ...patch,
  };
}

function goal(id: string, name: string, patch: Row = {}): Row {
  return {
    id,
    name,
    priority: 1,
    kind: 'purchase',
    costAsOf: '2026-09',
    targetMonth: '2031-09',
    returnRate: 0.1,
    inflationRate: 0,
    status: 'active',
    createdAt: 1,
    updatedAt: 1,
    ...patch,
  };
}

/**
 * The worker of the report, made round: 65 000 a month, the salary on the 10th and the advance on
 * the 25th, 50 000 of expenses by the 15th, a loan of 9 800 a month of which 4 000 is interest. By
 * the 16th of a month only the salary has come, so the month alone looks like a deficit of 11 000.
 */
function worker(data: BackupData, today: number): void {
  data.accounts.push(
    account('card', { name: 'Карта', openingBalanceMinor: 20_000 * RUB }),
    account('loan', {
      name: 'Потребкредит',
      side: 'liability',
      type: 'consumer',
      isLiquid: false,
      openingBalanceMinor: 230_000 * RUB,
      monthlyPaymentMinor: 9_800 * RUB,
      rate: 0.219,
    }),
  );

  for (const month of ['2026-06', '2026-07', '2026-08', '2026-09']) {
    const rows = [
      operation(`${month}-05`, 'expense', 23_000, { accountId: 'card', categoryId: 'housing' }),
      operation(`${month}-10`, 'income', 39_000, { accountId: 'card', categoryId: 'salary' }),
      operation(`${month}-12`, 'expense', 15_000, { accountId: 'card', categoryId: 'groceries' }),
      operation(`${month}-14`, 'expense', 8_000, { accountId: 'card', categoryId: 'clothes' }),
      operation(`${month}-15`, 'expense', 4_000, { accountId: 'card', categoryId: 'loan-interest' }),
      operation(`${month}-20`, 'transfer', 5_800, { accountId: 'card', toAccountId: 'loan' }),
      operation(`${month}-25`, 'income', 26_000, { accountId: 'card', categoryId: 'advance' }),
    ];
    // the current month holds only what has happened by today
    data.transactions.push(
      ...rows.filter((row) => month !== '2026-09' || Number(String(row.date).slice(8)) <= today),
    );
  }
  // One kopeck more in June: three months of expenses no longer divide into whole kopecks.
  data.transactions.push(operation('2026-06-28', 'expense', 0.01, { accountId: 'card', categoryId: 'fun' }));

  data.goals.push(goal('million', 'Первый миллион', { kind: 'other', costMinor: 1_000_000 * RUB }));
}

test.describe('the scenarios of the report', () => {
  for (const day of [16, 30]) {
    test(`a usual month, not the ${day}th, decides the verdict, and the debt and the reserve come first`, async ({
      page,
    }) => {
      await page.clock.setFixedTime(new Date(2026, 8, day, 12));
      await skipOnboarding(page);
      await seed(page, (data) => worker(data, day));

      // the average of June, July and August, whatever day of September it is
      await page.goto('/plan?step=1');
      await expect(page.getByTestId('diagnosis-balance')).toHaveText('Профицитный: доходы больше расходов');
      await expect(page.getByTestId('diagnosis-free')).toContainText(/15\s000\s₽/);
      await expect(page.getByTestId('diagnosis-debt')).toContainText('15,08 %');

      // the loan takes its 5 800 of principal first, the reserve its 10 % next, the goal the rest
      await page.goto('/goals');
      await expect(page.getByTestId('allocation-free')).toHaveText(/15\s000\s₽/);
      await expect(page.getByTestId('allocation-principal')).toHaveText(/5\s800\s₽/);
      await expect(page.getByTestId('allocation-available')).toHaveText(/9\s200\s₽/);
      await expect(page.getByTestId('allocation-needed')).toHaveText(/19\s414\s₽/);
      await expect(page.getByTestId('goal-allocated-Первый миллион')).toContainText(/2\s700\s₽/);

      // the expenses of three months do not divide into kopecks, and the goals step still opens
      await page.goto('/plan?step=2');
      await expect(page.getByTestId('pension-card')).toBeVisible();
      await expect(page.getByText('Этот раздел не открылся')).toHaveCount(0);
    });
  }

  test('a rate typed for a debt makes the plan advise repaying it first', async ({ page }) => {
    await skipOnboarding(page);
    await page.goto('/balance');
    await page.getByTestId('add-account').click();
    await page.getByTestId('account-name').fill('Кредитка');
    await page.getByTestId('account-side').selectOption('liability');
    await page.getByTestId('account-balance').fill('60848');
    await page.getByTestId('account-rate').fill('29,9');
    await page.getByTestId('account-submit').click();
    await expect(page.getByTestId('balance-Кредитка')).toBeVisible();

    await page.goto('/plan?step=5');
    const debt = page.getByTestId(/^plan-debt-/);
    await expect(debt).toContainText('ставка 29,9 %');
    await expect(debt).toContainText('выгоднее гасить досрочно');

    await page.goto('/plan?step=7');
    await expect(page.getByTestId(/^action-debt:/)).toBeVisible();
  });

  test('money of a goal on a brokerage account leaves the reserve alone, and no envelope lies on a flat', async ({
    page,
  }) => {
    await page.clock.setFixedTime(new Date(2026, 8, 16, 12));
    await skipOnboarding(page);
    await seed(page, (data) => {
      data.accounts.push(
        account('card', { name: 'Карта', openingBalanceMinor: 300_000 * RUB }),
        account('broker', {
          name: 'Брокерский счёт',
          type: 'brokerage',
          isLiquid: false,
          openingBalanceMinor: 1_000_000 * RUB,
        }),
        account('flat', {
          name: 'Квартира',
          type: 'realty',
          isLiquid: false,
          openingBalanceMinor: 9_000_000 * RUB,
        }),
      );
      for (const month of ['2026-06', '2026-07', '2026-08']) {
        data.transactions.push(
          operation(`${month}-10`, 'income', 80_000, { accountId: 'card', categoryId: 'salary' }),
          operation(`${month}-11`, 'expense', 50_000, { accountId: 'card', categoryId: 'housing' }),
          operation(`${month}-12`, 'expense', 30_000, { accountId: 'card', categoryId: 'groceries' }),
        );
      }
      data.goals.push(goal('dacha', 'Дача', { costMinor: 5_000_000 * RUB }));
      data.envelopes.push({ id: 'e1', goalId: 'dacha', accountId: 'broker', amountMinor: 1_000_000 * RUB });
    });

    // the card still holds 300 000 of reserve: 3,8 months of 80 000
    await page.goto('/plan?step=1');
    await expect(page.getByTestId('diagnosis-reserve')).toContainText('3,8 мес.');

    await page.goto('/goals');
    await page.getByTestId('goal-open-Дача').click();
    await expect(page.getByTestId('envelope-Брокерский счёт')).toHaveValue('1000000');
    await expect(page.getByTestId('envelope-Карта')).toBeVisible();
    await expect(page.getByTestId('envelope-Квартира')).toHaveCount(0);
    await expect(page.getByTestId('contribute-to').locator('option', { hasText: 'Квартира' })).toHaveCount(0);
  });

  test('a first month of records gives the reserve of that month, not three times more', async ({ page }) => {
    await page.clock.setFixedTime(new Date(2026, 8, 16, 12));
    await skipOnboarding(page);
    await seed(page, (data) => {
      data.accounts.push(
        account('card', { name: 'Карта', openingDate: '2026-08-01', openingBalanceMinor: 120_000 * RUB }),
      );
      data.transactions.push(
        operation('2026-08-10', 'income', 80_000, { accountId: 'card', categoryId: 'salary' }),
        operation('2026-08-11', 'expense', 40_000, { accountId: 'card', categoryId: 'housing' }),
        operation('2026-08-12', 'expense', 20_000, { accountId: 'card', categoryId: 'groceries' }),
      );
    });

    // 140 000 against 60 000 of one month: 2,3 months, and 220 000 short of six
    await page.goto('/plan?step=1');
    await expect(page.getByTestId('diagnosis-reserve')).toContainText('2,3 мес.');
    await page.goto('/plan?step=4');
    await expect(page.getByTestId('plan-reserve-short')).toContainText(/220\s000\s₽/);
  });
});
