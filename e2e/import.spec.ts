import { expect, test, type Page } from '@playwright/test';

import { skipOnboarding } from './helpers';

/** Windows-1251 bytes of a Russian statement — what a bank actually hands out. */
function toCp1251(text: string): Buffer {
  return Buffer.from(
    [...text].map((char) => {
      const code = char.codePointAt(0) ?? 0;
      if (code < 0x80) return code;
      if (char === 'Ё') return 0xa8;
      if (char === 'ё') return 0xb8;
      if (code >= 0x410 && code <= 0x44f) return code - 0x410 + 0xc0;
      throw new Error(`нет в 1251: ${char}`);
    }),
  );
}

const STATEMENT = [
  'Выписка по счёту 40817',
  'за период с 01.09.2026 по 30.09.2026',
  'Дата операции;Сумма операции;Назначение платежа',
  '05.09.2026;-1 234,56;Кофейня на Ленина',
  '05.09.2026;-1 234,56;Кофейня на Ленина',
  '06.09.2026;120 000,00;Зарплата за август',
  '07.09.2026;-3 500,00;Пятёрочка продукты',
  'Итого;114 030,88;',
].join('\r\n');

async function openImport(page: Page): Promise<void> {
  await page.goto('/budget');
  await page.getByTestId('import-open').click();
  await expect(page.getByTestId('import-step-file')).toBeVisible();
}

async function uploadStatement(page: Page, bytes: Buffer, name = 'statement.csv'): Promise<void> {
  await page.getByTestId('import-file').setInputFiles({ name, mimeType: 'text/csv', buffer: bytes });
  await expect(page.getByTestId('import-found')).toBeVisible();
}

async function addAccount(page: Page, name: string, balance: string): Promise<void> {
  await page.goto('/balance');
  await page.getByTestId('add-account').click();
  await page.getByTestId('account-name').fill(name);
  await page.getByTestId('account-balance').fill(balance);
  await page.getByTestId('account-submit').click();
  await expect(page.getByTestId(`balance-${name}`)).toBeVisible();
}

test.describe('import', () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
    await addAccount(page, 'Карта', '200000');
  });

  test('a statement in Windows-1251 is read, mapped and imported', async ({ page }) => {
    await openImport(page);
    await uploadStatement(page, toCp1251(STATEMENT));

    // five lines under the header: four operations and the total of the statement
    await expect(page.getByTestId('import-found')).toContainText('5');
    await page.getByTestId('import-next').click();

    // the columns are guessed from the headers
    await expect(page.getByTestId('import-column-date')).toHaveValue('0');
    await expect(page.getByTestId('import-column-amount')).toHaveValue('1');
    await expect(page.getByTestId('import-column-note')).toHaveValue('2');
    await page.getByTestId('import-next').click();

    // the Cyrillic survived the encoding
    await expect(page.getByTestId('import-row').first()).toContainText('Кофейня на Ленина');
    await expect(page.getByTestId('import-row')).toHaveCount(4);
    await expect(page.getByTestId('import-summary')).toContainText('4');

    await page.getByTestId('import-confirm').click();
    await expect(page.getByTestId('import-done')).toContainText('4');
    await page.getByTestId('import-close').click();

    // two identical purchases of one day both survive
    await expect(page.getByTestId('operations-count')).toContainText('4');
    await page.getByTestId('operations-search').fill('кофейня');
    await expect(page.getByTestId('operation-row')).toHaveCount(2);
    await page.getByTestId('filter-reset').click();

    await expect(page.getByTestId('total-income')).toHaveText(/120\s?000/);
    await expect(page.getByTestId('total-expense')).toHaveText(/5\s?969/);
  });

  test('importing the same file twice adds nothing the second time', async ({ page }) => {
    await openImport(page);
    await uploadStatement(page, toCp1251(STATEMENT));
    await page.getByTestId('import-next').click();
    await page.getByTestId('import-next').click();
    await page.getByTestId('import-confirm').click();
    await expect(page.getByTestId('import-done')).toContainText('4');
    await page.getByTestId('import-close').click();

    await page.getByTestId('import-open').click();
    await uploadStatement(page, toCp1251(STATEMENT));
    await page.getByTestId('import-next').click();
    await page.getByTestId('import-next').click();

    // every row is already there, so there is nothing left to take
    await expect(page.getByTestId('import-summary')).toContainText('К добавлению: 0');
    await expect(page.getByTestId('import-confirm')).toBeDisabled();
    // the dead button says why it is dead
    await expect(page.getByTestId('import-nothing')).toBeVisible();
    await page.getByTestId('import-dismiss').click();

    await expect(page.getByTestId('operations-count')).toContainText('4');
  });

  test('a keyword rule puts the rows into a category, and a row can be left out', async ({ page }) => {
    await openImport(page);
    await uploadStatement(page, Buffer.from(STATEMENT, 'utf8'));
    await page.getByTestId('import-next').click();
    await page.getByTestId('import-next').click();

    await page.getByTestId('import-rule-keyword').fill('кофейня');
    await page.getByTestId('import-rule-category').selectOption('cafe');
    await page.getByTestId('import-rule-add').click();
    await expect(page.getByTestId('import-rule')).toContainText('подходит строк: 2');

    // the salary row — third in the file — is not wanted this time
    await page.getByTestId('import-row-2').uncheck();
    await expect(page.getByTestId('import-summary')).toContainText('К добавлению: 3');

    await page.getByTestId('import-confirm').click();
    await expect(page.getByTestId('import-done')).toContainText('3');
    await page.getByTestId('import-close').click();

    await page.getByTestId('filter-category').selectOption('cafe');
    await expect(page.getByTestId('operation-row')).toHaveCount(2);
  });

  test('a possible duplicate is shown but not dropped, and an import can be undone', async ({ page }) => {
    // an operation typed by hand on the same day for the same sum
    await page.goto('/budget');
    await page.getByTestId('add-transaction').click();
    await page.getByTestId('transaction-amount').fill('3500');
    await page.getByTestId('transaction-date').fill('2026-09-07');
    await page.getByTestId('transaction-category').selectOption('groceries');
    await page.getByTestId('transaction-save').click();
    await expect(page.getByTestId('transaction-save')).toBeHidden();

    await page.getByTestId('import-open').click();
    await uploadStatement(page, Buffer.from(STATEMENT, 'utf8'));
    await page.getByTestId('import-next').click();
    await page.getByTestId('import-next').click();

    await expect(page.getByTestId('import-possible')).toHaveCount(1);
    // it is still taken: two identical purchases do happen
    await expect(page.getByTestId('import-summary')).toContainText('К добавлению: 4');

    await page.getByTestId('import-confirm').click();
    await expect(page.getByTestId('import-done')).toContainText('4');
    await page.getByTestId('import-close').click();

    await expect(page.getByTestId('operations-count')).toContainText('5');
    await expect(page.getByTestId('import-batch-row')).toHaveCount(1);

    await page.getByRole('button', { name: 'Отменить импорт' }).click();
    await page.getByTestId('confirm-action').click();

    // the import is gone, the operation typed by hand stays
    await expect(page.getByTestId('operations-count')).toContainText('1');
    await expect(page.getByTestId('import-batches-empty')).toBeVisible();
  });
});
