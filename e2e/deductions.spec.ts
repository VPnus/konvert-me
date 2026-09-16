import { expect, test, type Page } from '@playwright/test';

import { skipOnboarding } from './helpers';

/** The latest year a return can be filed for, by the clock of the browser. */
async function lastYear(page: Page): Promise<number> {
  return page.evaluate(() => new Date().getFullYear() - 1);
}

async function openDeductions(page: Page): Promise<number> {
  await skipOnboarding(page);
  await page.goto('/deductions');
  const year = await lastYear(page);
  await expect(page.getByTestId(`deduction-year-${year}`)).toHaveAttribute('aria-selected', 'true');
  return year;
}

test.describe('deductions', () => {
  test('the tax service example comes out on screen, and the year is kept', async ({ page }) => {
    const year = await openDeductions(page);

    // tax service: a salary of 100 000 a month, 300 000 paid for schooling at once → 19 500
    await page.getByTestId('deduction-income').fill('1200000');
    await page.getByTestId('had-education').check();
    await page.getByTestId('deduction-education').fill('300000');

    // the refund follows the answers before anything is saved
    await expect(page.getByTestId('refund-total')).toHaveText(/19\s?500/);
    await expect(page.getByTestId('refund-tax-paid')).toHaveText(/156\s?000/);

    await page.getByTestId('deduction-status').selectOption('filed');
    await page.getByTestId('deduction-save').click();
    await expect(page.getByTestId('deduction-saved')).toBeVisible();

    await page.reload();
    await expect(page.getByTestId('refund-total')).toHaveText(/19\s?500/);
    await expect(page.getByTestId('deduction-status')).toHaveValue('filed');
    await expect(page.getByTestId(`deduction-year-${year}`)).toContainText(/19\s?500/);
  });

  test('a home returns what the income allows and says what is left for the years after', async ({
    page,
  }) => {
    const year = await openDeductions(page);

    await page.getByTestId('deduction-income').fill('600000');
    await page.getByTestId('had-property').check();
    await page.getByTestId('deduction-purchase').fill('3000000');

    // 2 million at most; 600 000 of income returns 78 000 and 1,4 million moves on
    await expect(page.getByTestId('refund-property')).toHaveText(/78\s?000/);
    await expect(page.getByTestId('refund-property-left')).toContainText(/1\s?400\s?000/);
    await expect(page.getByTestId('refund-property-left')).toContainText(String(year + 1));
  });

  test('the answers of one year do not leak into another', async ({ page }) => {
    const year = await openDeductions(page);

    await page.getByTestId('deduction-income').fill('900000');
    await page.getByTestId(`deduction-year-${year - 1}`).click();

    await expect(page.getByTestId('deduction-income')).toHaveValue('');
    await expect(page.getByTestId('refund-empty')).toBeVisible();
  });

  test('a paper is brought in and thrown away, and one over the limit is refused', async ({ page }) => {
    await openDeductions(page);

    await page.getByTestId('doc-category').selectOption('schooling');
    await page.getByTestId('doc-file').setInputFiles({
      name: 'договор на обучение.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 договор'),
    });

    const row = page.getByTestId('doc-row');
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('договор на обучение.pdf');
    await expect(row).toContainText('Своё обучение');
    await expect(page.getByTestId('docs-size')).toBeVisible();

    await page.getByTestId('doc-file').setInputFiles({
      name: 'видео квартиры.mp4',
      mimeType: 'application/pdf',
      buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
    });
    await expect(page.getByTestId('doc-error')).toContainText('больше');
    await expect(row).toHaveCount(1);

    await page.getByRole('button', { name: 'Удалить договор на обучение.pdf' }).click();
    await page.getByTestId('confirm-action').click();
    await expect(page.getByTestId('docs-empty')).toBeVisible();
  });

  test('deleting a year takes its answers and its papers', async ({ page }) => {
    await openDeductions(page);

    await page.getByTestId('deduction-income').fill('1200000');
    await page.getByTestId('had-treatment').check();
    await page.getByTestId('deduction-treatment').fill('50000');
    await page.getByTestId('deduction-save').click();
    await page.getByTestId('doc-file').setInputFiles({
      name: 'справка.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 справка'),
    });
    await expect(page.getByTestId('doc-row')).toHaveCount(1);

    await page.getByTestId('deduction-delete').click();
    await page.getByTestId('confirm-action').click();

    await expect(page.getByTestId('docs-empty')).toBeVisible();
    await expect(page.getByTestId('refund-empty')).toBeVisible();
    await expect(page.getByTestId('deduction-income')).toHaveValue('');
  });
});
