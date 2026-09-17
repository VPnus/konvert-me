import { expect, test, type Page } from '@playwright/test';

import { contrastIssues, keyboardReport, unnamedControls } from './a11y';

/**
 * The accessibility the plan asks of the MVP: readable contrast, every control reachable
 * and visibly focused from the keyboard, and every field and button named — on every tab,
 * in the dialogs and through the onboarding, in both themes and both widths.
 */

type Findings = Record<string, unknown>;

async function audit(page: Page, findings: Findings, screen: string, scope = 'body'): Promise<void> {
  // The theme crosses over in a quarter of a second; measure the colours it arrives at.
  await page.waitForTimeout(400);
  const [contrast, unnamed, keyboard] = [
    await contrastIssues(page),
    await unnamedControls(page),
    await keyboardReport(page, { scope }),
  ];
  const found = {
    ...(contrast.length > 0 ? { contrast } : {}),
    ...(unnamed.length > 0 ? { unnamed } : {}),
    ...(keyboard.invisibleFocus.length > 0 ? { invisibleFocus: keyboard.invisibleFocus } : {}),
    ...(keyboard.unreachable.length > 0 ? { unreachable: keyboard.unreachable } : {}),
  };
  if (Object.keys(found).length > 0) findings[screen] = found;
}

const DIALOG = '[role="dialog"], [role="alertdialog"]';

const WIDTHS = [
  { name: 'laptop', width: 1280, height: 800 },
  { name: 'phone', width: 375, height: 720 },
] as const;

for (const size of WIDTHS) {
  for (const theme of ['light', 'dark'] as const) {
    test(`contrast, keyboard and names of the controls — ${theme} theme, ${size.name}`, async ({ page }) => {
      test.setTimeout(180_000);
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.addInitScript((value) => localStorage.setItem('konvert-me.theme', value), theme);
      const findings: Findings = {};

      // The site first, as someone new sees it: the landing and the policy.
      await page.goto('/');
      await expect(page.getByTestId('landing-start')).toBeVisible();
      await audit(page, findings, 'лендинг');
      await page.goto('/privacy');
      await audit(page, findings, 'политика конфиденциальности');

      await page.goto('/welcome');
      await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
      const steps: [string, () => Promise<void>][] = [
        ['onboarding-income', () => page.getByTestId('onboarding-income').fill('150000')],
        ['onboarding-mandatory', () => page.getByTestId('onboarding-mandatory').fill('70000')],
        ['onboarding-variable', () => page.getByTestId('onboarding-variable').fill('30000')],
        [
          'onboarding-savings',
          async () => {
            await page.getByTestId('onboarding-savings').fill('400000');
            await page.getByTestId('onboarding-debt').fill('300000');
            await page.getByTestId('onboarding-debt-payment').fill('12000');
          },
        ],
      ];
      for (const [index, [, answer]] of steps.entries()) {
        await audit(page, findings, `знакомство, шаг ${index + 1}`);
        await answer();
        await page.getByTestId('onboarding-next').click();
      }
      await audit(page, findings, 'знакомство, шаг 5');
      await page.getByTestId('onboarding-goal-name').fill('Квартира');
      await page.getByTestId('onboarding-goal-cost').fill('4000000');
      await page.getByTestId('onboarding-goal-month').fill('2030-09');
      await page.getByTestId('onboarding-finish').click();
      await expect(page).toHaveURL(/\/overview$/);

      const pages = ['/overview', '/budget', '/goals', '/balance', '/deductions', '/settings'];
      for (let step = 1; step <= 8; step += 1) pages.push(`/plan?step=${step}`);
      for (const path of pages) {
        await page.goto(path);
        await audit(page, findings, path);
      }

      // Some of these open a dialog, some a form in the page; the keyboard walk stays inside a dialog.
      const opened: [string, string][] = [
        ['/overview', 'customize-dashboard'],
        ['/budget', 'tab-year'],
        ['/budget', 'add-transaction'],
        ['/budget', 'import-open'],
        ['/goals', 'add-goal'],
        ['/goals', 'goal-open-Квартира'],
        ['/balance', 'add-account'],
        ['/balance', 'add-policy'],
        ['/balance', 'add-income-source'],
        ['/plan?step=2', 'education-add'],
        ['/settings', 'wipe-data'],
        ['/overview', 'report-problem'],
      ];
      for (const [path, opener] of opened) {
        await page.goto(path);
        // the header keeps two of some buttons, one for each width: the one on the screen is pressed
        await page.locator(`[data-testid="${opener}"]:visible`).first().click();
        const dialog = await page
          .locator(DIALOG)
          .first()
          .waitFor({ timeout: 1500 })
          .then(() => true)
          .catch(() => false);
        await audit(page, findings, `${path} → ${opener}`, dialog ? DIALOG : 'body');
      }

      await page.goto('/overview');
      await page.getByTestId('customize-dashboard').click();
      await page.getByTestId('add-widget').click();
      await expect(page.locator(DIALOG).first()).toBeVisible();
      await audit(page, findings, '/overview → каталог виджетов', DIALOG);

      expect(findings).toEqual({});
    });
  }
}
