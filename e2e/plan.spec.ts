import { readFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';

import { expect, test, type Page } from '@playwright/test';

import { skipOnboarding } from './helpers';

/** The month n months from the one the browser is in, as "YYYY-MM"; n may be negative. */
async function monthFromNow(page: Page, months: number): Promise<string> {
  return page.evaluate((shift) => {
    const now = new Date();
    const index = now.getFullYear() * 12 + now.getMonth() + shift;
    const year = Math.floor(index / 12);
    return `${year}-${String(index - year * 12 + 1).padStart(2, '0')}`;
  }, months);
}

const money = (rubles: string) => new RegExp(rubles.replace(/ /g, '\\s?'));

/**
 * Every compressed stream of a PDF, unpacked. What pdfkit writes is plain enough for this:
 * a dictionary, "stream", the bytes, "endstream".
 */
function streamsOf(bytes: Buffer): string[] {
  const text = bytes.toString('latin1');
  const streams: string[] = [];
  let at = text.indexOf('stream\n');
  while (at !== -1) {
    const start = at + 'stream\n'.length;
    const end = text.indexOf('\nendstream', start);
    try {
      streams.push(inflateSync(bytes.subarray(start, end)).toString('latin1'));
    } catch {
      // Not every stream is compressed; those are not the ones looked for.
    }
    at = text.indexOf('stream\n', end + 'endstream'.length);
  }
  return streams;
}

test.describe('financial plan', () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
  });

  test('the eight steps are walked with the buttons, and the step stays in the address', async ({ page }) => {
    await page.goto('/plan');
    await expect(page.getByTestId('plan-step-title')).toHaveText('Где вы сейчас');

    await page.getByTestId('plan-next').click();
    await expect(page).toHaveURL(/\/plan\?step=2$/);
    await expect(page.getByTestId('plan-step-title')).toHaveText('Цели');

    await page.getByTestId('plan-step-8').click();
    await expect(page).toHaveURL(/\/plan\?step=8$/);
    await page.reload();
    await expect(page.getByTestId('plan-step-title')).toHaveText('Пересмотр');
    await expect(page.getByTestId('plan-next')).toBeDisabled();
  });

  test('the education of a child comes out of the calculator, year by year and as one sum by the start', async ({
    page,
  }) => {
    const start = await monthFromNow(page, 96);
    await page.goto('/plan?step=2');

    await page.getByTestId('education-add').click();
    const card = page.getByTestId('education-new');
    await card.getByTestId('education-name').fill('Маша');
    await card.getByTestId('education-start').fill(start);
    await card.getByTestId('education-years').fill('6');
    await card.getByTestId('education-cost').fill('600000');
    await card.getByTestId('education-return').fill('8,83');
    await card.getByTestId('education-inflation').fill('6,9');

    // Year by year: recounted independently; the course sum and its 44 227 are the lesson's.
    await expect(card.getByTestId('education-capital')).toHaveText(money('5 825 523 ₽'));
    await expect(card.getByTestId('education-contribution')).toHaveText(money('41 966 ₽'));
    await expect(card.getByTestId('education-course')).toHaveText(money('6 139 375 ₽, или 44 227 ₽'));

    await card.getByTestId('education-goal').click();
    // Saved: the new card closes, the calculation stays with a goal of its own.
    await expect(page.getByTestId('education-new')).toHaveCount(0);
    await expect(page.getByText('Цель «Образование: Маша» — на вкладке «Цели»')).toBeVisible();

    await page.goto('/goals');
    await expect(page.getByTestId('goal-open-Образование: Маша')).toBeVisible();
  });

  test('the pension comes out of the calculator and is saved as a goal', async ({ page }) => {
    // Retiring at 60 in 22 years, as the family of the lesson does.
    const birth = await monthFromNow(page, 22 * 12 - 60 * 12);
    await page.goto('/plan?step=2');

    const card = page.getByTestId('pension-card');
    await card.getByTestId('pension-birth').fill(birth);
    await card.getByTestId('pension-expenses').fill('116149');
    await card.getByTestId('pension-state').fill('26000');
    await card.getByTestId('pension-return').fill('8,73');
    await card.getByTestId('pension-inflation').fill('6,9');

    // 240 032 a month in the prices of the year of retiring is the lesson's own number.
    await expect(card.getByTestId('pension-gap')).toHaveText(money('240 032 ₽'));
    await expect(card.getByTestId('pension-capital-spend')).toHaveText(money('49 263 685 ₽'));
    await expect(card.getByTestId('pension-capital-keep')).toHaveText(money('171 138 594 ₽'));
    await expect(card.getByTestId('pension-course')).toContainText(money('32 994 034 ₽'));

    await card.getByTestId('pension-save').click();
    await expect(card.getByTestId('pension-message')).toHaveText('Расчёт сохранён');
    await card.getByTestId('pension-goal').click();
    await expect(card.getByTestId('pension-message')).toHaveText('Цель «Пенсия» — на вкладке «Цели»');

    await page.reload();
    await expect(page.getByTestId('pension-expenses')).toHaveValue('116149');
    await page.goto('/goals');
    await expect(page.getByTestId('goal-open-Пенсия')).toBeVisible();
  });

  test('a goal gets its classes of assets once the risk is chosen', async ({ page }) => {
    await page.goto('/goals');
    await page.getByTestId('add-goal').click();
    await page.getByTestId('goal-name').fill('Квартира');
    await page.getByTestId('goal-cost').fill('3000000');
    await page.getByTestId('goal-month').fill(await monthFromNow(page, 84));
    await page.getByTestId('goal-save').click();
    await expect(page.getByTestId('goal-open-Квартира')).toBeVisible();

    await page.goto('/plan?step=6');
    await expect(page.getByTestId('plan-allocations')).toContainText('Выберите отношение к риску');
    await page.getByTestId('risk-moderate').click();

    const allocation = page.locator('[data-testid^="allocation-"]');
    await expect(allocation).toContainText('До цели 5–10 лет');
    await expect(allocation).toContainText('Акции — 40 %');
    await expect(allocation).toContainText('Облигации — 50 %');
    await expect(page.getByTestId('plan-disclaimer')).toContainText(
      'не являются индивидуальной инвестиционной рекомендацией',
    );
  });

  test('actions are ticked off and notes are kept', async ({ page }) => {
    await page.goto('/plan?step=7');
    await page.getByTestId('action-deductions').check();
    await expect(page.getByTestId('plan-actions-progress')).toContainText('Сделано 1 из');

    await page.goto('/plan?step=3');
    await page.getByTestId('plan-note-mechanisms').fill('Квартиру — в ипотеку, остальное копим');
    await page.getByTestId('plan-back').focus();
    await expect(page.getByTestId('plan-note-mechanisms-saved')).toBeVisible();

    await page.reload();
    await expect(page.getByTestId('plan-note-mechanisms')).toHaveValue(
      'Квартиру — в ипотеку, остальное копим',
    );
    await page.goto('/plan?step=7');
    await expect(page.getByTestId('action-deductions')).toBeChecked();
  });

  test('a quarter later the plan asks for a look, and hiding the reminder keeps it hidden', async ({
    page,
  }) => {
    await page.goto('/plan?step=7');
    await page.getByTestId('action-deductions').check();
    await expect(page.getByTestId('plan-review-reminder')).toHaveCount(0);

    await page.clock.setFixedTime(new Date(Date.now() + 100 * 24 * 60 * 60 * 1000));
    await page.goto('/overview');
    await expect(page.getByTestId('plan-review-reminder')).toContainText('итоги квартала');

    await page.getByTestId('plan-review-reminder-dismiss').click();
    await expect(page.getByTestId('plan-review-reminder')).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId('plan-review-reminder')).toHaveCount(0);
  });

  test('the plan is saved as a PDF whose font draws Cyrillic and the ruble sign', async ({ page }) => {
    await page.goto('/plan?step=8');

    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('plan-pdf').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^konverkot-plan-\d{4}-\d{2}-\d{2}\.pdf$/);

    const bytes = await readFile((await download.path()) as string);
    const text = bytes.toString('latin1');
    expect(text.startsWith('%PDF-')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    // The font travels inside the file, so it opens and prints the same anywhere.
    expect(text).toContain('/FontFile2');
    expect(text).toMatch(/\/BaseFont \/[A-Z]{6}\+Roboto/);

    // The map from the glyphs back to letters: Ф of the title and the ruble sign are in it.
    const maps = streamsOf(bytes).filter((stream) => stream.includes('begincmap'));
    expect(maps.length).toBeGreaterThan(0);
    expect(maps.join('\n')).toContain('<0424>');
    expect(maps.join('\n')).toContain('<20bd>');
    await expect(page.getByTestId('plan-pdf-error')).toHaveCount(0);
  });
});
