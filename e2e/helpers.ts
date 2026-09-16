import { expect, type Page } from '@playwright/test';

/**
 * A fresh browser profile always starts at the onboarding. Tests that are about
 * something else skip it: that still creates the categories, the reserve goal and
 * the default dashboard.
 *
 * The skip opens the database for the first time and writes four tables. When the
 * whole suite starts at once, every worker does that together, and once it took
 * longer than the default five seconds.
 */
export async function skipOnboarding(page: Page): Promise<void> {
  await page.goto('/welcome');
  await page.getByTestId('onboarding-skip').click();
  await expect(page).toHaveURL(/\/overview$/, { timeout: 15_000 });
}
