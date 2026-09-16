import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { skipOnboarding } from './helpers';

/**
 * The requirement of the plan for the MVP: with 10 000 operations the budget opens and
 * the overview is counted again within 500 ms on an average laptop.
 *
 * The data goes in the way a user's data does — through a backup file — and the time
 * is taken inside the page, from the click to the frame that shows the result, so the
 * test runner's own round trips are not counted.
 */

const OPERATIONS = 10_000;
const MONTHS = 36;
const LIMIT_MS = 500;
const RUNS = 5;

const INCOME = ['salary', 'advance'] as const;
const EXPENSES = [
  'housing',
  'groceries',
  'transport',
  'communication',
  'health',
  'children',
  'cafe',
  'clothes',
  'fun',
  'gifts',
  'travel',
] as const;

/** A fixed sequence, so every run measures the same data. */
function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function monthsUpTo(current: string, count: number): string[] {
  const [year, month] = current.split('-').map(Number);
  return Array.from({ length: count }, (_, index) => {
    const total = year * 12 + (month - 1) - (count - 1 - index);
    return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
  });
}

/** The month the app itself thinks it is: the tests run in Moscow time. */
function moscowMonth(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow' }).format(new Date()).slice(0, 7);
}

interface Generated {
  readonly transactions: Record<string, unknown>[];
  readonly plans: Record<string, unknown>[];
  readonly inCurrentMonth: number;
}

/**
 * Three years of a household: an advance and a salary every month, a transfer to
 * savings, and everyday spending with an occasional refund — 10 000 operations in all.
 */
function generate(cardId: string, savingsId: string, months: readonly string[]): Generated {
  const next = random(20260916);
  const transactions: Record<string, unknown>[] = [];
  const plans: Record<string, unknown>[] = [];
  const perMonth = Math.floor(OPERATIONS / months.length);
  let createdAt = Date.now() - OPERATIONS * 1000;

  const add = (row: Record<string, unknown>) => {
    transactions.push({ id: crypto.randomUUID(), createdAt: createdAt++, ...row });
  };

  months.forEach((month, index) => {
    const count = index === months.length - 1 ? OPERATIONS - perMonth * (months.length - 1) : perMonth;

    add({
      date: `${month}-05`,
      amountMinor: 6_000_000,
      kind: 'income',
      accountId: cardId,
      categoryId: INCOME[1],
    });
    add({
      date: `${month}-20`,
      amountMinor: 9_000_000,
      kind: 'income',
      accountId: cardId,
      categoryId: INCOME[0],
    });
    add({
      date: `${month}-21`,
      amountMinor: 2_000_000,
      kind: 'transfer',
      accountId: cardId,
      toAccountId: savingsId,
    });

    for (let item = 3; item < count; item += 1) {
      const day = String(1 + Math.floor(next() * 28)).padStart(2, '0');
      const categoryId = EXPENSES[Math.floor(next() * EXPENSES.length)];
      add({
        date: `${month}-${day}`,
        amountMinor: 5_000 + Math.floor(next() * 90_000),
        kind: item % 50 === 0 ? 'refund' : 'expense',
        accountId: cardId,
        categoryId,
        note: `Покупка ${item}`,
      });
    }

    for (const categoryId of [...INCOME, ...EXPENSES]) {
      plans.push({ id: crypto.randomUUID(), month, categoryId, amountMinor: 1_000_000 });
    }
  });

  const current = months[months.length - 1];
  return {
    transactions,
    plans,
    inCurrentMonth: transactions.filter((row) => String(row.date).startsWith(current)).length,
  };
}

/**
 * Clicks inside the page and waits there for the result: the time runs from the click
 * to just after the frame in which the element first shows what it should.
 */
function timeClick(
  page: Page,
  click: string,
  ready: { selector: string; includes?: string; differsFrom?: string },
): Promise<number> {
  return page.evaluate(
    ({ click, ready }) =>
      new Promise<number>((resolve, reject) => {
        const target = document.querySelector<HTMLElement>(click);
        if (!target) {
          reject(new Error(`Нет элемента ${click}`));
          return;
        }

        const start = performance.now();
        const isReady = () => {
          const text = document.querySelector(ready.selector)?.textContent;
          if (text == null) return false;
          if (ready.includes !== undefined && !text.includes(ready.includes)) return false;
          return ready.differsFrom === undefined || text !== ready.differsFrom;
        };
        const check = () => {
          if (isReady()) {
            // The frame is painted after the animation callbacks; a task queued here runs after it.
            setTimeout(() => resolve(performance.now() - start), 0);
          } else if (performance.now() - start > 10_000) {
            reject(new Error(`Не дождались ${ready.selector}`));
          } else {
            requestAnimationFrame(check);
          }
        };

        target.click();
        requestAnimationFrame(check);
      }),
    { click, ready },
  );
}

/**
 * Lets the page finish what the previous step started: the screen shows a change
 * before everything around it is done — the rest of the save, the other queries — and
 * a measurement that starts on top of that measures both.
 */
async function settle(page: Page): Promise<void> {
  await page.waitForTimeout(1_000);
}

async function addAccount(page: Page, name: string): Promise<void> {
  await page.getByTestId('add-account').click();
  await page.getByTestId('account-name').fill(name);
  await page.getByTestId('account-balance').fill('0');
  await page.getByTestId('account-submit').click();
  await expect(page.getByTestId(`balance-${name}`)).toBeVisible();
}

test.describe('10 000 operations', () => {
  test.setTimeout(180_000);

  test('the budget opens and the overview is counted again within 500 ms', async ({ page }, testInfo) => {
    await skipOnboarding(page);
    await page.goto('/balance');
    await addAccount(page, 'Карта');
    await addAccount(page, 'Накопления');

    // The file the app itself writes, with three years of operations put into it.
    await page.goto('/settings');
    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('backup-export').click();
    const directory = await mkdtemp(join(tmpdir(), 'konverkot-performance-'));
    const file = join(directory, 'backup.json');
    await (await downloadPromise).saveAs(file);

    const backup = JSON.parse(await readFile(file, 'utf8')) as {
      data: { accounts: { id: string; name: string; openingDate: string }[]; [table: string]: unknown[] };
    };
    const months = monthsUpTo(moscowMonth(), MONTHS);
    const idOf = (name: string) => backup.data.accounts.find((account) => account.name === name)?.id ?? '';
    for (const account of backup.data.accounts) account.openingDate = `${months[0]}-01`;

    const generated = generate(idOf('Карта'), idOf('Накопления'), months);
    expect(generated.transactions).toHaveLength(OPERATIONS);
    backup.data.transactions = generated.transactions;
    backup.data.budgetPlans = generated.plans;
    await writeFile(file, JSON.stringify(backup));

    await page.getByTestId('backup-import').setInputFiles(file);
    await page.getByTestId('confirm-action').click();
    await expect(page.getByTestId('backup-message')).toContainText('восстановлены', { timeout: 60_000 });

    await page.goto('/overview');
    await expect(page.getByTestId('widget-free-cash')).toContainText('₽');

    // Opening the budget from the tab bar, again and again: the first time counts too.
    const budget: number[] = [];
    for (let run = 0; run < RUNS; run += 1) {
      await settle(page);
      budget.push(
        await timeClick(page, '[data-testid="tab-bar"] a[href="/budget"]', {
          selector: '[data-testid="operations-count"]',
          includes: `: ${generated.inCurrentMonth}`,
        }),
      );
      await page.getByTestId('tab-bar').locator('a[href="/overview"]').click();
      await expect(page.getByTestId('widget-free-cash')).toContainText('₽');
    }

    // An operation added on the overview: the free cash of the month has to follow it.
    const overview: number[] = [];
    for (let run = 0; run < RUNS; run += 1) {
      const before = (await page.getByTestId('widget-free-cash').textContent()) ?? '';
      await page.getByTestId('quick-amount').fill(String(100 + run));
      await page.getByTestId('quick-category').selectOption('cafe');
      await settle(page);
      overview.push(
        await timeClick(page, '[data-testid="quick-submit"]', {
          selector: '[data-testid="widget-free-cash"]',
          differsFrom: before,
        }),
      );
      // The widget follows the write at once, the form is cleared when the whole save is
      // done: a sum typed in between would be wiped.
      await expect(page.getByTestId('quick-saved')).toBeVisible();
      await expect(page.getByTestId('quick-amount')).toHaveValue('');
    }

    const report = [
      `Бюджет, мс: ${budget.map(Math.round).join(', ')}`,
      `Обзор, мс: ${overview.map(Math.round).join(', ')}`,
    ].join('\n');
    // In the terminal and in the HTML report of CI alike.
    process.stdout.write(`${report}\n`);
    testInfo.annotations.push({ type: 'timings', description: report });

    // The requirement is a ceiling, so the slowest run is the one that has to fit.
    expect(Math.max(...budget), 'открытие «Бюджета»').toBeLessThanOrEqual(LIMIT_MS);
    expect(Math.max(...overview), 'пересчёт «Обзора»').toBeLessThanOrEqual(LIMIT_MS);
  });
});
