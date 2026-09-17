import { expect, test } from '@playwright/test';

import { skipOnboarding } from './helpers';

test.describe('installable and offline', () => {
  test('the manifest describes an installable russian app', async ({ page, request }) => {
    await page.goto('/overview');

    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifestHref).toBeTruthy();

    const manifest = await (await request.get(manifestHref!)).json();
    expect(manifest.name).toBe('Конверкот');
    expect(manifest.display).toBe('standalone');
    // The installed app opens on the app; its identity stays the root, whatever the start.
    expect(manifest.id).toBe('/');
    expect(manifest.start_url).toBe('/overview');
    expect(manifest.icons.map((icon: { sizes: string }) => icon.sizes)).toEqual(
      expect.arrayContaining(['192x192', '512x512']),
    );
    expect(manifest.icons.some((icon: { purpose?: string }) => icon.purpose === 'maskable')).toBe(true);
  });

  test('the tab of the browser gets the cat, not a globe', async ({ request }) => {
    const ico = await request.get('/favicon.ico');
    expect(ico.status()).toBe(200);
    expect(ico.headers()['content-type']).toMatch(/^image\//);
    expect([...(await ico.body()).subarray(0, 4)]).toEqual([0, 0, 1, 0]);

    const svg = await request.get('/favicon.svg');
    expect(svg.headers()['content-type']).toMatch(/^image\/svg\+xml/);
    expect(await svg.text()).not.toMatch(/class="[^"]*"\s+class=/);
  });

  test('the app still opens with the network switched off', async ({ page, context }) => {
    await skipOnboarding(page);

    await page.waitForFunction(
      async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        return Boolean(registration?.active);
      },
      undefined,
      { timeout: 30_000 },
    );

    // Give the precache a moment to finish before cutting the network off.
    await page.waitForTimeout(1_000);
    await context.setOffline(true);
    await page.reload();

    await expect(page.getByRole('heading', { name: 'Обзор', level: 1 })).toBeVisible();

    await page.goto('/goals');
    await expect(page.getByRole('heading', { name: 'Цели', level: 1 })).toBeVisible();

    await context.setOffline(false);
  });
});
