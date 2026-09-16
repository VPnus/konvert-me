import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { skipOnboarding } from './helpers';

async function addAccount(
  page: Page,
  values: { name: string; side: 'asset' | 'liability'; type: string; balance: string },
): Promise<void> {
  await page.getByTestId('add-account').click();
  await page.getByTestId('account-name').fill(values.name);
  await page.getByTestId('account-side').selectOption(values.side);
  await page.getByTestId('account-type').selectOption(values.type);
  await page.getByTestId('account-balance').fill(values.balance);
  await page.getByTestId('account-submit').click();
  await expect(page.getByTestId(`balance-${values.name}`)).toBeVisible();
}

test.describe('accounts', () => {
  test('the balance of an account comes from its opening balance', async ({ page }) => {
    await page.goto('/balance');
    await expect(page.getByText('Счетов пока нет.', { exact: false })).toBeVisible();

    await addAccount(page, { name: 'Карта', side: 'asset', type: 'debit', balance: '100000' });
    await addAccount(page, { name: 'Ипотека', side: 'liability', type: 'mortgage', balance: '3000000' });

    await expect(page.getByTestId('balance-Карта')).toHaveText(/100\s?000/);
    await expect(page.getByTestId('balance-Ипотека')).toHaveText(/3\s?000\s?000/);
    // 100 000 − 3 000 000
    await expect(page.getByTestId('net-worth')).toHaveText(/-2\s?900\s?000/);

    await page.reload();
    await expect(page.getByTestId('balance-Карта')).toBeVisible();
  });

  test('an invalid account is refused with a russian message', async ({ page }) => {
    await page.goto('/balance');
    await page.getByTestId('add-account').click();
    await page.getByTestId('account-name').fill('Карта');
    await page.getByTestId('account-date').fill('');
    await page.getByTestId('account-balance').fill('100');

    // The date is required by the form itself, so the dialog stays open.
    await page.getByTestId('account-submit').click();
    await expect(page.getByTestId('account-name')).toBeVisible();
  });

  test('a field for a number refuses letters', async ({ page }) => {
    await page.goto('/balance');
    await page.getByTestId('add-account').click();

    const balance = page.getByTestId('account-balance');
    await balance.fill('');
    await balance.pressSequentially('12абв34,5x6');
    await expect(balance).toHaveValue('1234,56');

    await page.getByTestId('account-side').selectOption('liability');
    const day = page.getByTestId('account-payment-day');
    // two digits at most, letters and separators never appear
    await day.pressSequentially('1a5,7');
    await expect(day).toHaveValue('15');
  });

  test('an account can be archived and deleted', async ({ page }) => {
    await page.goto('/balance');
    await addAccount(page, { name: 'Наличные', side: 'asset', type: 'cash', balance: '5000' });

    await page.getByRole('button', { name: 'В архив' }).click();
    await expect(page.getByTestId('balance-Наличные')).toBeHidden();

    await page.getByLabel('Показывать архив').check();
    await expect(page.getByText('В архиве')).toBeVisible();

    await page.getByRole('button', { name: 'Удалить' }).first().click();
    await page.getByTestId('confirm-action').click();
    await expect(page.getByText('Счетов пока нет.', { exact: false })).toBeVisible();
  });
});

test.describe('income sources', () => {
  test('a source of income counts the days to its next payment', async ({ page }) => {
    await skipOnboarding(page);
    await page.goto('/balance');
    await expect(page.getByTestId('payday-empty')).toBeVisible();

    // the day is taken from the browser, whose time zone the config pins
    const today = await page.evaluate(() => new Date().getDate());

    await page.getByTestId('add-income-source').click();
    await page.getByTestId('income-name').fill('Аванс');
    await page.getByTestId('income-day').fill(String(today));
    await page.getByTestId('income-amount').fill('60000');
    await page.getByTestId('income-save').click();

    await expect(page.getByTestId('payday-Аванс')).toHaveText('сегодня');
    await expect(page.getByTestId('payday-total')).toContainText('60 000');

    await page.getByTestId('add-income-source').click();
    await page.getByTestId('income-name').fill('Зарплата');
    await page.getByTestId('income-day').fill(String(today));
    await page.getByTestId('income-save').click();

    await expect(page.getByTestId('payday-row')).toHaveCount(2);
    // the source without a sum does not change the total
    await expect(page.getByTestId('payday-total')).toContainText('60 000');

    await page.getByRole('button', { name: 'Удалить источник: Аванс' }).click();
    await page.getByTestId('confirm-action').click();
    await expect(page.getByTestId('payday-row')).toHaveCount(1);
  });

  test('a day outside a month is refused', async ({ page }) => {
    await skipOnboarding(page);
    await page.goto('/balance');

    await page.getByTestId('add-income-source').click();
    await page.getByTestId('income-name').fill('Премия');
    await page.getByTestId('income-day').fill('45');
    await page.getByTestId('income-save').click();

    await expect(page.getByTestId('income-error')).toContainText('от 1 до 31');
  });
});

test.describe('backup', () => {
  test('data → export → clear → import gives the same data back', async ({ page }) => {
    await page.goto('/balance');
    await addAccount(page, { name: 'Карта', side: 'asset', type: 'debit', balance: '100000' });
    await addAccount(page, { name: 'Вклад', side: 'asset', type: 'deposit', balance: '250000' });

    await page.goto('/settings');
    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('backup-export').click();
    const download = await downloadPromise;

    const directory = await mkdtemp(join(tmpdir(), 'konverkot-'));
    const file = join(directory, 'backup.json');
    await download.saveAs(file);
    expect(download.suggestedFilename()).toMatch(/^konverkot-backup-\d{4}-\d{2}-\d{2}\.json$/);

    await page.getByTestId('wipe-data').click();
    await page.getByTestId('confirm-action').click();
    // The dialog closes only when the wipe is really done — no race with the next step.
    await expect(page.getByTestId('confirm-action')).toBeHidden();

    await page.goto('/balance');
    await expect(page.getByText('Счетов пока нет.', { exact: false })).toBeVisible();

    await page.goto('/settings');
    await page.getByTestId('backup-import').setInputFiles(file);
    await page.getByTestId('confirm-action').click();
    await expect(page.getByTestId('backup-message')).toContainText('восстановлены');

    await page.goto('/balance');
    await expect(page.getByTestId('balance-Карта')).toHaveText(/100\s?000/);
    await expect(page.getByTestId('balance-Вклад')).toHaveText(/250\s?000/);
  });

  test('a file with a password needs that password', async ({ page }) => {
    await page.goto('/balance');
    await addAccount(page, { name: 'Карта', side: 'asset', type: 'debit', balance: '100000' });

    await page.goto('/settings');
    await page.getByTestId('backup-password').fill('кот-в-мешке');
    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('backup-export').click();
    const download = await downloadPromise;

    const directory = await mkdtemp(join(tmpdir(), 'konverkot-'));
    const file = join(directory, 'secret.json');
    await download.saveAs(file);

    await page.getByTestId('wipe-data').click();
    await page.getByTestId('confirm-action').click();
    // The dialog closes only when the wipe is really done — no race with the next step.
    await expect(page.getByTestId('confirm-action')).toBeHidden();

    await page.getByTestId('backup-import').setInputFiles(file);
    await expect(page.getByTestId('import-password')).toBeVisible();

    await page.getByTestId('import-password').fill('не тот пароль');
    await page.getByTestId('confirm-action').click();
    await expect(page.getByTestId('backup-error')).toContainText('пароль');

    await page.getByTestId('import-password').fill('кот-в-мешке');
    await page.getByTestId('confirm-action').click();
    await expect(page.getByTestId('backup-message')).toContainText('восстановлены');

    await page.goto('/balance');
    await expect(page.getByTestId('balance-Карта')).toBeVisible();
  });

  test('the reminder asks for the first backup and goes away after it', async ({ page }) => {
    await skipOnboarding(page);
    await expect(page.getByTestId('backup-reminder')).toBeVisible();

    await page.goto('/settings');
    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('backup-export').click();
    await downloadPromise;

    await expect(page.getByTestId('backup-reminder')).toBeHidden();
    await expect(page.getByTestId('last-backup')).not.toContainText('копий ещё не было');
  });
});

test.describe('the risk of losing the data', () => {
  test('a browser that does not keep the storage is named, and hiding the warning keeps it hidden', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator.storage, 'persisted', { value: () => Promise.resolve(false) });
      Object.defineProperty(navigator.storage, 'persist', { value: () => Promise.resolve(false) });
    });
    await skipOnboarding(page);

    const warning = page.getByTestId('data-risk');
    await expect(warning).toHaveAttribute('data-kind', 'not-persisted');
    await page.getByTestId('data-risk-dismiss').click();
    await expect(warning).toHaveCount(0);

    await page.reload();
    await expect(page.getByTestId('backup-reminder')).toBeVisible();
    await expect(warning).toHaveCount(0);
  });

  test('a storage nearly full says how much is taken', async ({ page }) => {
    await page.addInitScript(() => {
      const GB = 1024 ** 3;
      Object.defineProperty(navigator.storage, 'persisted', { value: () => Promise.resolve(true) });
      Object.defineProperty(navigator.storage, 'estimate', {
        value: () => Promise.resolve({ usage: 9 * GB, quota: 10 * GB }),
      });
    });
    await skipOnboarding(page);

    const warning = page.getByTestId('data-risk');
    await expect(warning).toHaveAttribute('data-kind', 'space');
    await expect(warning).toContainText('занято 9.0 ГБ из 10 ГБ');
  });

  test('a window that refuses the private file system is taken for a private one', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator.storage, 'getDirectory', {
        value: () => Promise.reject(new DOMException('unknown transient reason', 'UnknownError')),
      });
    });
    await skipOnboarding(page);

    await expect(page.getByTestId('data-risk')).toHaveAttribute('data-kind', 'private');
  });

  test('a backup is one press away before everything is wiped', async ({ page }) => {
    await skipOnboarding(page);
    await page.goto('/settings');

    await page.getByTestId('wipe-data').click();
    await expect(page.getByTestId('backup-first')).toContainText('копий ещё не было');

    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('backup-first-download').click();
    await downloadPromise;
    await expect(page.getByTestId('backup-first-done')).toBeVisible();
    await expect(page.getByTestId('last-backup')).not.toContainText('копий ещё не было');
  });
});

test.describe('two tabs of the same app', () => {
  test('an account added in one tab shows up in the other', async ({ context }) => {
    const first = await context.newPage();
    const second = await context.newPage();

    await first.goto('/balance');
    await second.goto('/balance');

    await addAccount(first, { name: 'Карта', side: 'asset', type: 'debit', balance: '100000' });

    await expect(second.getByTestId('balance-Карта')).toBeVisible({ timeout: 10_000 });

    await first.close();
    await second.close();
  });
});
