import { expect, test, type Page } from '@playwright/test';

/**
 * Stage 9.4: a person who lives in the United States goes through the app in English — a pay every
 * fortnight, a 401(k) with a match of the employer, and the order the plan puts the steps in. The
 * language is saved the way the settings save it; the country is chosen in the introduction.
 */
const american = (page: Page) => page.addInitScript(() => localStorage.setItem('konvert-me.language', 'en'));

/** Every Russian word left on the screen, with a little of its context. */
async function russianOnScreen(page: Page): Promise<string[]> {
  const text = await page.evaluate(() => document.body.innerText);
  return [...text.matchAll(/.{0,30}[А-Яа-яЁё]+.{0,30}/g)].map((match) => match[0]);
}

/** A date some days back, written the way a date field takes it. */
function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function settleIn(page: Page): Promise<void> {
  await page.goto('/welcome');
  await page.getByTestId('onboarding-country-us').click();
  await page.getByTestId('onboarding-next').click();
  await page.getByTestId('onboarding-income').fill('4333');
  await page.getByTestId('onboarding-next').click();
  await page.getByTestId('onboarding-mandatory').fill('2000');
  await page.getByTestId('onboarding-next').click();
  await page.getByTestId('onboarding-variable').fill('1000');
  await page.getByTestId('onboarding-next').click();
  await page.getByTestId('onboarding-savings').fill('3000');
  await page.getByTestId('onboarding-next').click();
  await page.getByTestId('onboarding-finish').click();
  await expect(page).toHaveURL(/\/overview$/, { timeout: 15_000 });
}

test.describe('a household in the United States', () => {
  test('is paid every two weeks, and a month of that is the year over twelve', async ({ page }) => {
    await american(page);
    await settleIn(page);

    await page.goto('/balance');
    await page.getByTestId('add-income-source').click();
    await page.getByTestId('income-name').fill('Paycheck');
    await page.getByTestId('income-frequency').selectOption('biweekly');
    // the last payday was a fortnight ago, so the next one is today
    await page.getByTestId('income-first-date').fill(daysAgo(14));
    await page.getByTestId('income-amount').fill('2000');
    await page.getByTestId('income-save').click();

    await expect(page.getByTestId('payday-Paycheck')).toHaveText('today');
    await expect(page.getByTestId('payday-row')).toContainText('every two weeks');
    // 2 000 every fourteen days is 52 000 a year, so 4 333,33 in an ordinary month
    await expect(page.getByTestId('payday-total')).toContainText('$4,333');
    await expect(page.getByTestId('payday-total')).toContainText('spread over 12 months');
  });

  test('fills a 401(k) with a match and sees what the year still allows', async ({ page }) => {
    await american(page);
    await settleIn(page);

    await page.goto('/tax-accounts');
    await expect(page.getByRole('heading', { name: 'Tax accounts', level: 1 })).toBeVisible();
    await page.getByTestId('add-tax-account').click();
    await page.getByTestId('tax-account-name').fill('401(k) at work');
    await page.getByTestId('tax-account-kind').selectOption('401k');
    await page.getByTestId('tax-account-match-share').fill('50');
    await page.getByTestId('tax-account-match-up-to').fill('6');
    await page.getByTestId('tax-account-save').click();

    await page.getByTestId('tax-own-401(k) at work').fill('2000');
    await page.getByTestId('tax-employer-401(k) at work').fill('1000');
    await page.getByTestId('tax-save-401(k) at work').click();

    const limit = page.getByTestId('limit-deferral');
    await expect(limit).toContainText('Limit for 2026: $24,500');
    await expect(limit).toContainText('Contributed: $2,000.00');
    await expect(limit).toContainText('Left: $22,500.00');
    await expect(limit).toContainText('the match lies outside the limit');

    // an IRA of the same person shares one limit with a Roth IRA of theirs
    await page.getByTestId('add-tax-account').click();
    await page.getByTestId('tax-account-name').fill('Roth IRA');
    await page.getByTestId('tax-account-kind').selectOption('roth_ira');
    await page.getByTestId('tax-account-save').click();
    await expect(page.getByTestId('limit-ira')).toContainText('Limit for 2026: $7,500');

    expect(await russianOnScreen(page)).toEqual([]);
  });

  test('is told to take the whole match before anything else, and the room of the year after', async ({
    page,
  }) => {
    await american(page);
    await settleIn(page);

    await page.goto('/balance');
    await page.getByTestId('add-income-source').click();
    await page.getByTestId('income-name').fill('Paycheck');
    await page.getByTestId('income-frequency').selectOption('biweekly');
    await page.getByTestId('income-first-date').fill(daysAgo(14));
    await page.getByTestId('income-amount').fill('2000');
    await page.getByTestId('income-save').click();
    await expect(page.getByTestId('payday-total')).toContainText('$4,333');

    await page.goto('/tax-accounts');
    await page.getByTestId('add-tax-account').click();
    await page.getByTestId('tax-account-name').fill('401(k) at work');
    await page.getByTestId('tax-account-match-share').fill('50');
    await page.getByTestId('tax-account-match-up-to').fill('6');
    await page.getByTestId('tax-account-save').click();
    await page.getByTestId('tax-own-401(k) at work').fill('2000');
    await page.getByTestId('tax-save-401(k) at work').click();
    await expect(page.getByTestId('limit-deferral')).toContainText('Contributed: $2,000.00');

    await page.getByTestId('add-tax-account').click();
    await page.getByTestId('tax-account-name').fill('HSA');
    await page.getByTestId('tax-account-kind').selectOption('hsa');
    await page.getByTestId('tax-account-save').click();
    // the plan is read from the database: it is asked for once the account is written
    await expect(page.getByTestId('limit-hsa')).toBeVisible();

    await page.goto('/plan?step=7');
    const actions = page.getByTestId('plan-actions');
    // 6 % of a year of 52 000 is 3 120, of which 2 000 is already in
    await expect(actions).toContainText('to take the whole match: $1,120 short for the year');
    await expect(actions).toContainText('Add to the health savings account: $4,400');
    await expect(actions).not.toContainText('tax deductions');
    expect(await russianOnScreen(page)).toEqual([]);
  });
});
