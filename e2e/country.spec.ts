import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { account, RUB, seed, type BackupData } from './backup-seed';
import { skipOnboarding } from './helpers';

/** Stage 9.3: the country of the data sets the currency, the norms and the tabs. */
const english = (page: Page) => page.addInitScript(() => localStorage.setItem('konvert-me.language', 'en'));

const tabs = (page: Page) => page.getByRole('navigation', { name: /Разделы|Sections/ });

/** Exports the data, as a file the test may change before it is imported. */
async function exportBackup(page: Page, password = ''): Promise<string> {
  await page.goto('/settings');
  await page.getByTestId('backup-password').fill(password);
  const download = page.waitForEvent('download');
  await page.getByTestId('backup-export').click();
  const file = join(await mkdtemp(join(tmpdir(), 'konverkot-country-')), 'backup.json');
  await (await download).saveAs(file);
  return file;
}

async function changeCountry(page: Page, country: 'ru' | 'us'): Promise<void> {
  await page.goto('/settings');
  await page.getByTestId(`country-${country}`).click();
  await page.getByTestId('confirm-action').click();
  await expect(page.getByTestId(`country-${country}`)).toHaveAttribute('aria-pressed', 'true');
}

test.describe('the country of the data', () => {
  test('the country is the first question of the introduction and a card of the settings', async ({
    page,
  }) => {
    await page.goto('/welcome');
    await expect(page.getByText('Шаг 1 из 6')).toBeVisible();
    await expect(page.getByTestId('onboarding-country-us')).toBeVisible();

    await page.getByTestId('onboarding-skip').click();
    await expect(page).toHaveURL(/\/overview$/, { timeout: 15_000 });
    await page.goto('/settings');
    await expect(page.getByTestId('country-card')).toBeVisible();
    await expect(page.getByTestId('country-ru')).toHaveAttribute('aria-pressed', 'true');
  });

  test('a newcomer from the United States answers in dollars and gets no deductions', async ({ page }) => {
    await page.goto('/welcome');

    await expect(page.getByText('Шаг 1 из 6')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'В какой валюте вы считаете деньги?' })).toBeVisible();
    await expect(page.getByTestId('onboarding-country-ru')).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('onboarding-country-us').click();
    await expect(page.getByTestId('onboarding-country-us')).toHaveAttribute('aria-pressed', 'true');

    await page.getByTestId('onboarding-next').click();
    await expect(page.getByLabel('Доход в месяц, $')).toBeVisible();
    await page.getByTestId('onboarding-income').fill('5000');
    await page.getByTestId('onboarding-next').click();
    await page.getByTestId('onboarding-mandatory').fill('2000');
    await page.getByTestId('onboarding-next').click();
    await page.getByTestId('onboarding-variable').fill('1000');
    await expect(page.getByTestId('onboarding-free-cash')).toContainText(/2\s000\s\$/);
    await page.getByTestId('onboarding-next').click();
    await page.getByTestId('onboarding-savings').fill('3000');
    await page.getByTestId('onboarding-next').click();
    await page.getByTestId('onboarding-finish').click();
    await expect(page).toHaveURL(/\/overview$/, { timeout: 15_000 });

    await expect(tabs(page).getByRole('link', { name: 'Бюджет' })).toBeVisible();
    await expect(tabs(page).getByRole('link', { name: 'Вычеты' })).toHaveCount(0);

    await page.goto('/balance');
    await expect(page.getByTestId('insurance-card')).toContainText(/250\s000\s\$/);
    await expect(page.getByTestId('insurance-card')).toContainText('fdic.gov');
    await page.goto('/deductions');
    await expect(page).toHaveURL(/\/overview$/);
  });

  test('another country changes the currency, the norms and the tabs, and converts no sum', async ({
    page,
  }) => {
    await skipOnboarding(page);
    await seed(page, (data: BackupData) => {
      data.accounts.push(
        account('card', { name: 'Карта', bankName: 'Банк А', openingBalanceMinor: 150_000 * RUB }),
      );
    });

    await page.goto('/balance');
    await expect(page.getByTestId('insurance-card')).toContainText(/1\s400\s000\s₽/);
    await expect(page.getByTestId('insurance-Банк А')).toContainText(/150\s000\s₽/);

    await page.goto('/settings');
    await expect(page.getByTestId('country-ru')).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('country-us').click();
    await expect(page.getByRole('dialog')).toContainText(/100\s000\s₽ станут 100\s000\s\$/);
    await page.getByTestId('confirm-action').click();
    await expect(page.getByTestId('country-us')).toHaveAttribute('aria-pressed', 'true');
    await expect(tabs(page).getByRole('link', { name: 'Вычеты' })).toHaveCount(0);

    await page.goto('/balance');
    await expect(page.getByTestId('insurance-card')).toContainText(/250\s000\s\$/);
    await expect(page.getByTestId('insurance-Банк А')).toContainText(/150\s000\s\$/);
    await page.getByTestId('add-account').click();
    await expect(page.getByLabel('Начальный остаток, $')).toBeVisible();

    await changeCountry(page, 'ru');
    await expect(tabs(page).getByRole('link', { name: 'Вычеты' })).toBeVisible();
    await page.goto('/balance');
    await expect(page.getByTestId('insurance-Банк А')).toContainText(/150\s000\s₽/);
  });

  test('a backup of another country warns before it replaces the data, and brings its country', async ({
    page,
  }) => {
    await skipOnboarding(page);
    const file = await exportBackup(page);
    const backup = JSON.parse(await readFile(file, 'utf8')) as { data: BackupData };
    backup.data.settings[0].country = 'us';
    backup.data.accounts.push(
      account('cash', { name: 'Cash', currency: 'USD', openingBalanceMinor: 500 * RUB }),
    );
    await writeFile(file, JSON.stringify(backup));

    await page.getByTestId('backup-import').setInputFiles(file);
    await expect(page.getByTestId('backup-country-warning')).toContainText('другой страны: США');
    await page.getByTestId('confirm-action').click();
    // the app is drawn anew for the country, and the report of the import is still there
    await expect(page.getByTestId('backup-message')).toContainText('восстановлены');
    await expect(tabs(page).getByRole('link', { name: 'Вычеты' })).toHaveCount(0);

    await page.goto('/overview');
    await expect(page.getByTestId('widget-net-worth')).toContainText(/500\s\$/);
  });

  test('an encrypted backup of another country names it once the password opens it', async ({ page }) => {
    await skipOnboarding(page);
    await changeCountry(page, 'us');
    const file = await exportBackup(page, 'secret-pass');
    await changeCountry(page, 'ru');

    await page.getByTestId('backup-import').setInputFiles(file);
    await page.getByTestId('import-password').fill('secret-pass');
    await expect(page.getByTestId('backup-country-warning')).toHaveCount(0);
    await page.getByTestId('confirm-action').click();
    await expect(page.getByTestId('backup-country-warning')).toContainText('США');
    await expect(page.getByTestId('country-ru')).toHaveAttribute('aria-pressed', 'true');

    await page.getByTestId('confirm-action').click();
    await expect(page.getByTestId('backup-message')).toContainText('восстановлены');
    await expect(page.getByTestId('country-us')).toHaveAttribute('aria-pressed', 'true');
  });

  test('in English, the sums of the United States are written in dollars', async ({ page }) => {
    await english(page);
    await page.goto('/welcome');

    await page.getByTestId('onboarding-country-us').click();
    await expect(page.getByTestId('onboarding-country-us')).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('onboarding-next').click();
    await expect(page.getByLabel('Monthly income, $')).toBeVisible();
    await page.getByTestId('onboarding-income').fill('5000');
    await page.getByTestId('onboarding-next').click();
    await page.getByTestId('onboarding-mandatory').fill('1500');
    await page.getByTestId('onboarding-next').click();
    await expect(page.getByTestId('onboarding-free-cash')).toContainText('$3,500');
  });
});
