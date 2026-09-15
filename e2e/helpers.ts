import { expect, type Page } from '@playwright/test';

/**
 * A fresh browser profile always starts at the onboarding. Tests that are about
 * something else skip it: that still creates the categories, the reserve goal and
 * the default dashboard.
 */
export async function skipOnboarding(page: Page): Promise<void> {
  await page.goto('/welcome');
  await page.getByTestId('onboarding-skip').click();
  await expect(page).toHaveURL(/\/overview$/);
}
