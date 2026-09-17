import { expect, test, type Page } from '@playwright/test';

import { skipOnboarding } from './helpers';

const USAGE_KEY = 'konvert-me.usage';

/** Pretends the app was first opened that many days ago, before the page runs. */
async function firstOpenedDaysAgo(page: Page, days: number): Promise<void> {
  await page.addInitScript(
    ([key, ago]) => {
      if (localStorage.getItem(key)) return;
      const first = new Date();
      first.setDate(first.getDate() - ago);
      const iso = `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, '0')}-${String(first.getDate()).padStart(2, '0')}`;
      localStorage.setItem(
        key,
        JSON.stringify({
          firstDay: iso,
          days: [iso],
          onboarding: null,
          installed: false,
          sharedMilestone: 0,
        }),
      );
    },
    [USAGE_KEY, days] as const,
  );
}

test.describe('the landing', () => {
  test('meets someone new and leads into the onboarding', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1, name: 'Бюджет, цели и конверты' })).toBeVisible();
    await expect(page.getByTestId('landing-pilot')).toBeVisible();
    await page.getByTestId('landing-start').click();

    await expect(page).toHaveURL(/\/welcome$/);
    await expect(page.getByTestId('onboarding-income')).toBeVisible();
  });

  test('leaves nothing on the device of a visitor who only looks', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('landing-start')).toBeVisible();
    await page.goto('/privacy');
    await expect(page.getByRole('heading', { level: 1, name: 'Политика конфиденциальности' })).toBeVisible();

    const left = await page.evaluate(async (key) => {
      const databases = (await indexedDB.databases()).map((database) => database.name);
      return { databases, usage: localStorage.getItem(key) };
    }, USAGE_KEY);
    expect(left).toEqual({ databases: [], usage: null });
  });

  test('sends someone who already uses the app straight into it', async ({ page }) => {
    await skipOnboarding(page);

    await page.goto('/');
    await expect(page).toHaveURL(/\/overview$/);
  });

  test('the onboarding does not run twice', async ({ page }) => {
    await skipOnboarding(page);

    await page.goto('/welcome');
    await expect(page).toHaveURL(/\/overview$/);
  });
});

test.describe('the privacy policy', () => {
  test('opens from the landing, the onboarding and the app', async ({ page }) => {
    const heading = page.getByRole('heading', { level: 1, name: 'Политика конфиденциальности' });

    await page.goto('/');
    await page.getByTestId('site-privacy-link').click();
    await expect(heading).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Что уходит в интернет' })).toBeVisible();

    await page.goto('/welcome');
    await page.getByRole('link', { name: 'Политика конфиденциальности' }).click();
    await expect(heading).toBeVisible();

    await skipOnboarding(page);
    await page.getByTestId('app-privacy-link').click();
    await expect(heading).toBeVisible();
    await page.getByTestId('privacy-open-app').click();
    await expect(page).toHaveURL(/\/overview$/);
  });
});

test.describe('narrow screen, 375 px', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) >= 768, 'this is about the phone layout');

  test('the landing and the policy fit the width', async ({ page }) => {
    for (const path of ['/', '/privacy']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `горизонтальная прокрутка на ${path}`).toBeLessThanOrEqual(0);
    }
  });
});

test.describe('the pilot', () => {
  test('the settings show the stats without sums and copy them', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await skipOnboarding(page);

    await page.goto('/settings#pilot');
    const stats = page.getByTestId('pilot-stats');
    await expect(stats).toContainText('Дней с первого запуска: 0');
    await expect(stats).toContainText('Знакомство: пропущено');
    await expect(stats).toContainText('Открывали через 7 дней и позже: ещё рано');
    await expect(stats).not.toContainText('₽');

    await page.getByTestId('pilot-copy').click();
    await expect(page.getByTestId('pilot-copy-status')).toHaveText(/Скопировано/);
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toBe(await stats.innerText());
  });

  test('a week after the first day the app asks to share, once', async ({ page }) => {
    await firstOpenedDaysAgo(page, 8);
    await skipOnboarding(page);

    const reminder = page.getByTestId('pilot-reminder');
    await expect(reminder).toHaveAttribute('data-kind', 'day-7');
    await reminder.getByRole('link', { name: 'Поделиться' }).click();
    await expect(page).toHaveURL(/\/settings#pilot$/);
    await expect(page.getByTestId('pilot-stats')).toContainText('Открывали через 7 дней и позже: да');

    await page.getByTestId('pilot-reminder-dismiss').click();
    await expect(reminder).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId('pilot-stats')).toBeVisible();
    await expect(reminder).toHaveCount(0);
  });

  test('wiping the data forgets the days of use too', async ({ page }) => {
    await firstOpenedDaysAgo(page, 8);
    await skipOnboarding(page);
    await page.goto('/settings');
    await expect(page.getByTestId('pilot-stats')).toContainText('Дней с первого запуска: 8');

    await page.getByTestId('wipe-data').click();
    await page.getByTestId('confirm-action').click();
    await expect(page.getByTestId('confirm-action')).toBeHidden();

    // The app still open may count today in again at once; the eight days before are gone either way.
    await expect(page.getByTestId('pilot-stats')).not.toContainText('Дней с первого запуска: 8');
    const firstDays = await page.evaluate((key) => {
      const stored = localStorage.getItem(key);
      return stored === null ? 0 : (JSON.parse(stored) as { days: string[] }).days.length;
    }, USAGE_KEY);
    expect(firstDays).toBeLessThanOrEqual(1);
  });
});
