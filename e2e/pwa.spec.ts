import { readFileSync } from 'node:fs';

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
    // Two loads, a worker to install and a precache to fill: more than the usual half minute.
    test.setTimeout(90_000);
    await skipOnboarding(page);

    await page.waitForFunction(
      async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        return Boolean(registration?.active);
      },
      undefined,
      { timeout: 30_000 },
    );

    // The precache has to finish before the network goes away. Its size grew with the charts, and
    // a second of waiting turned out to be short of it on a loaded machine.
    await page.waitForTimeout(5_000);

    await context.setOffline(true);
    await page.reload();

    await expect(page.getByRole('heading', { name: 'Обзор', level: 1 })).toBeVisible();

    await page.goto('/goals');
    await expect(page.getByRole('heading', { name: 'Цели', level: 1 })).toBeVisible();

    await context.setOffline(false);
  });

  test('the site says which version it has and what that version brings', async ({ request }) => {
    const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
    const response = await request.get('/version.json');
    expect(response.status()).toBe(200);
    const release = (await response.json()) as { version: string; notes: string[] };
    expect(release.version).toBe(version);
    expect(release.notes.length).toBeGreaterThan(0);
  });

  test('after an update the app says once what is new, and a newcomer is not told', async ({ page }) => {
    const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };

    // someone new: nothing to compare with, the version is only remembered
    await skipOnboarding(page);
    await expect(page.getByTestId('updated-notice')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => localStorage.getItem('konvert-me.version'))).toBe(version);

    // the same person a version earlier
    await page.evaluate(() => localStorage.setItem('konvert-me.version', '0.0.1'));
    await page.reload();
    const notice = page.getByTestId('updated-notice');
    await expect(notice).toContainText(`Конверкот обновлён до версии ${version}`);
    await expect(notice.getByRole('listitem').first()).toBeVisible();

    await page.getByTestId('updated-notice-dismiss').click();
    await expect(notice).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Обзор', level: 1 })).toBeVisible();
    await expect(notice).toHaveCount(0);
  });
});
