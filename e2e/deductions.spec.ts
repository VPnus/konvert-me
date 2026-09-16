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

  test('the children of the tax service example give back 23 166 only when the employer did not', async ({
    page,
  }) => {
    await openDeductions(page);

    // tax service: four children, 40 000 a month, 16 200 a month until November
    await page.getByTestId('deduction-income').fill('480000');
    await page.getByTestId('had-kids').check();
    await page.getByTestId('kid-add').click();
    await page.getByTestId('kid-add').click();
    await page.getByTestId('kid-add').click();
    await expect(page.getByTestId('kid')).toHaveCount(4);
    // the place by birth follows the list: first, second, then the third and on
    await expect(page.getByTestId('kid-order-1')).toHaveValue('2');
    await expect(page.getByTestId('kid-order-3')).toHaveValue('3');

    // most employers give it on their own, so nothing is promised until told otherwise
    await expect(page.getByTestId('kids-at-work')).toBeChecked();
    await expect(page.getByTestId('refund-children')).toHaveText('учтено работодателем');
    await expect(page.getByTestId('refund-tax-paid')).toHaveText(/39\s?234/);

    await page.getByTestId('kids-at-work').uncheck();
    await expect(page.getByTestId('refund-children')).toHaveText(/23\s?166/);
    await expect(page.getByTestId('refund-total')).toHaveText(/23\s?166/);

    await page.getByTestId('deduction-save').click();
    await page.reload();
    await expect(page.getByTestId('kid')).toHaveCount(4);
    await expect(page.getByTestId('refund-total')).toHaveText(/23\s?166/);
  });

  test('a home sold is a tax to pay, until a home bought in the same year takes it off', async ({ page }) => {
    const year = await openDeductions(page);

    // tax service: sold for 3 million, bought for 2,5 million — 65 000 of tax
    await page.getByTestId('deduction-income').fill('1200000');
    await page.getByTestId('had-sale').check();
    await page.getByTestId('sale-price').fill('3000000');
    await page.getByTestId('sale-expenses').fill('2500000');

    await expect(page.getByTestId('refund-title')).toHaveText('Нужно доплатить');
    await expect(page.getByTestId('refund-total')).toHaveText(/65\s?000/);
    await expect(page.getByTestId('refund-sale-deadline')).toContainText(`30 апреля ${year + 1}`);
    await expect(page.getByTestId('refund-sale-deadline')).toContainText(`15 июля ${year + 1}`);

    // a flat of 2 million bought the same year: the salary takes 1,2 million, the sale the rest
    await page.getByTestId('had-property').check();
    await page.getByTestId('deduction-purchase').fill('2000000');

    await expect(page.getByTestId('refund-title')).toHaveText('Можно вернуть');
    await expect(page.getByTestId('refund-total')).toHaveText(/156\s?000/);
    await expect(page.getByTestId('refund-sale-deadline')).toContainText('даже если налога не осталось');
    await expect(page.getByTestId('refund-property-left')).toContainText(/300\s?000/);

    await page.getByTestId('deduction-save').click();
    await expect(page.getByTestId(`deduction-year-${year}`)).toContainText(/156\s?000/);

    // owned long enough, the sale is no one's business but the owner's
    await page.getByTestId('sale-owned-long').check();
    await expect(page.getByTestId('sale-expenses')).toBeHidden();
    await expect(page.getByTestId('refund-sale-notes')).toContainText('налога с продажи нет');
  });

  test('the checklist follows the answers, and the papers ticked stay ticked', async ({ page }) => {
    await openDeductions(page);

    await expect(page.getByTestId('checklist-empty')).toBeVisible();

    await page.getByTestId('deduction-income').fill('1200000');
    await page.getByTestId('had-treatment').check();
    await page.getByTestId('deduction-treatment').fill('50000');
    await page.getByTestId('had-property').check();
    await page.getByTestId('deduction-purchase').fill('2000000');

    // from the spending of 2024 one certificate stands for the contract, the licence and the receipts
    await expect(page.getByTestId('check-treatment-treatmentCertificate')).toBeVisible();
    await expect(page.getByTestId('check-treatment-treatmentContract')).toHaveCount(0);
    await expect(page.getByTestId('checklist-property')).toBeVisible();
    await expect(page.getByTestId('checklist-mortgage')).toHaveCount(0);
    await page.getByTestId('deduction-interest').fill('100000');
    await expect(page.getByTestId('checklist-mortgage')).toBeVisible();

    // nothing to tick until the answers are kept
    await expect(page.getByTestId('checklist-save-first')).toBeVisible();
    await expect(page.getByTestId('check-general-passport')).toBeDisabled();
    await page.getByTestId('deduction-save').click();
    await expect(page.getByTestId('checklist-save-first')).toHaveCount(0);

    // general 4, treatment 1, medicine 2, relatives 2, property 4, mortgage 2
    await page.getByTestId('check-general-passport').check();
    await page.getByTestId('check-treatment-treatmentCertificate').check();
    await expect(page.getByTestId('checklist-progress')).toHaveText('Собрано 2 из 15');

    await page.getByTestId('doc-category').selectOption('treatment');
    await page.getByTestId('doc-file').setInputFiles({
      name: 'справка об оплате.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 справка'),
    });
    await expect(page.getByTestId('checklist-treatment')).toContainText('файлов здесь: 1');

    await page.reload();
    await expect(page.getByTestId('check-general-passport')).toBeChecked();
    await expect(page.getByTestId('check-treatment-treatmentCertificate')).toBeChecked();

    // a question unticked takes its papers off the list and out of the count
    await page.getByTestId('had-treatment').uncheck();
    await expect(page.getByTestId('checklist-treatment')).toHaveCount(0);
    await expect(page.getByTestId('checklist-progress')).toHaveText('Собрано 1 из 10');
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
