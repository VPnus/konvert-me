import { expect, test } from '@playwright/test';

import { skipOnboarding } from './helpers';

const RSS = `<?xml version="1.0"?><rss version="2.0"><channel>
  <title>Тестовая лента</title>
  <item><title>Как считать финансовый резерв</title><link>https://example.com/reserve</link><pubDate>Mon, 15 Sep 2026 10:00:00 +0000</pubDate></item>
  <item><title>Вторая статья</title><link>https://example.com/second</link><pubDate>Mon, 15 Sep 2026 09:00:00 +0000</pubDate></item>
</channel></rss>`;

test.describe('pinned sources', () => {
  test('a link is added from the dashboard and survives a reload', async ({ page }) => {
    await skipOnboarding(page);

    await page.getByTestId('customize-dashboard').click();
    await page.getByTestId('add-widget').click();
    await page.getByTestId('catalog-add-links').click();
    await page.getByTestId('customize-dashboard').click();

    const widget = page.getByTestId('widget-links');
    await expect(widget).toContainText('Список пуст');

    await widget.getByTestId('link-add').click();
    await widget.getByTestId('link-title').fill('Курс по финансам');
    await widget.getByTestId('link-url').fill('https://example.com/course');
    await widget.getByTestId('link-save').click();

    const link = widget.getByRole('link', { name: /Курс по финансам/ });
    await expect(link).toHaveAttribute('href', 'https://example.com/course');
    await expect(link).toHaveAttribute('rel', /noopener/);

    await page.reload();
    await expect(page.getByTestId('widget-links')).toContainText('Курс по финансам');
  });

  test('an address that is not https is refused', async ({ page }) => {
    await skipOnboarding(page);

    await page.getByTestId('customize-dashboard').click();
    await page.getByTestId('add-widget').click();
    await page.getByTestId('catalog-add-links').click();
    await page.getByTestId('customize-dashboard').click();

    const widget = page.getByTestId('widget-links');
    await widget.getByTestId('link-add').click();
    await widget.getByTestId('link-title').fill('Плохая ссылка');
    // type=url keeps the browser from submitting anything that is not a URL at all,
    // so the check under test is the https rule of the storage layer.
    await widget.getByTestId('link-url').fill('http://example.com/insecure');
    await widget.getByTestId('link-save').click();

    await expect(widget.getByTestId('link-error')).toContainText('https');
  });
});

test.describe('news', () => {
  test('nothing is requested until external sources are allowed', async ({ page }) => {
    let requests = 0;
    await page.route('https://example.com/rss', async (route) => {
      requests += 1;
      await route.fulfill({ status: 200, contentType: 'application/rss+xml', body: RSS });
    });

    await skipOnboarding(page);
    await page.getByTestId('customize-dashboard').click();
    await page.getByTestId('add-widget').click();
    await page.getByTestId('catalog-add-news').click();
    await page.getByTestId('customize-dashboard').click();

    await expect(page.getByTestId('widget-news')).toContainText('Внешние источники выключены');

    // a feed can be added while the switch is off, and it is still not read
    await page.goto('/settings');
    await page.getByTestId('feed-title').fill('Тестовая лента');
    await page.getByTestId('feed-url').fill('https://example.com/rss');
    await page.getByTestId('feed-add').click();
    await expect(page.getByTestId('feed-refresh')).toBeDisabled();
    expect(requests).toBe(0);
  });

  test('once allowed, the feed is read and the articles appear on the dashboard', async ({ page }) => {
    await page.route('https://example.com/rss', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/rss+xml', body: RSS });
    });

    await skipOnboarding(page);
    await page.goto('/settings');
    await page.getByTestId('external-sources-toggle').check();
    await page.getByTestId('feed-title').fill('Тестовая лента');
    await page.getByTestId('feed-url').fill('https://example.com/rss');
    await page.getByTestId('feed-add').click();
    await page.getByTestId('feed-refresh').click();
    // Wait for the read to finish before leaving the screen.
    await expect(page.getByTestId('feed-updated')).not.toContainText('ещё не обновлялось');

    await page.goto('/overview');
    await page.getByTestId('customize-dashboard').click();
    await page.getByTestId('add-widget').click();
    await page.getByTestId('catalog-add-news').click();
    await page.getByTestId('customize-dashboard').click();

    const widget = page.getByTestId('widget-news');
    await expect(widget.getByTestId('news-items')).toContainText('Как считать финансовый резерв');
    await expect(widget.getByRole('link', { name: 'Как считать финансовый резерв' })).toHaveAttribute(
      'href',
      'https://example.com/reserve',
    );

    await page.reload();
    await expect(page.getByTestId('widget-news')).toContainText('Как считать финансовый резерв');
  });

  test('an API with a key is read, and the key is never shown in full', async ({ page }) => {
    const seen: string[] = [];
    await page.route('https://api.example.com/**', async (route) => {
      seen.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          articles: [
            {
              title: 'Статья из платного API',
              url: 'https://example.com/paid-article',
              publishedAt: '2026-09-15T08:00:00Z',
            },
          ],
        }),
      });
    });

    await skipOnboarding(page);
    await page.goto('/settings');
    await page.getByTestId('external-sources-toggle').check();

    await page.getByTestId('feed-title').fill('Платный API');
    await page.getByTestId('feed-url').fill('https://api.example.com/v2/top-headlines?country=ru');
    await page.getByTestId('feed-auth-kind').selectOption('query');
    await page.getByTestId('feed-param-name').fill('apiKey');
    await page.getByTestId('feed-key').fill('super-secret-value');
    await page.getByTestId('feed-add').click();

    // the stored key is shown masked, never in full
    await expect(page.getByTestId('feed-auth')).toContainText('apiKey=');
    await expect(page.getByTestId('feed-auth')).toContainText('alue');
    await expect(page.getByTestId('feed-auth')).not.toContainText('super-secret-value');

    await page.getByTestId('feed-refresh').click();
    await expect(page.getByTestId('feed-updated')).not.toContainText('ещё не обновлялось');

    expect(seen.some((url) => url.includes('apiKey=super-secret-value'))).toBe(true);
    expect(seen.some((url) => url.includes('country=ru'))).toBe(true);

    await page.goto('/overview');
    await page.getByTestId('customize-dashboard').click();
    await page.getByTestId('add-widget').click();
    await page.getByTestId('catalog-add-news').click();
    await page.getByTestId('customize-dashboard').click();

    await expect(page.getByTestId('widget-news')).toContainText('Статья из платного API');
  });

  test('a key can be changed later without retyping the address', async ({ page }) => {
    const seen: string[] = [];
    await page.route('https://api.example.com/**', async (route) => {
      seen.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ articles: [{ title: 'Статья', url: 'https://example.com/a' }] }),
      });
    });

    await skipOnboarding(page);
    await page.goto('/settings');
    await page.getByTestId('external-sources-toggle').check();
    await page.getByTestId('feed-title').fill('API');
    await page.getByTestId('feed-url').fill('https://api.example.com/news');
    await page.getByTestId('feed-auth-kind').selectOption('bearer');
    await page.getByTestId('feed-key').fill('old-key-value');
    await page.getByTestId('feed-add').click();

    await page.getByTestId('feed-edit-API').click();
    await page.getByTestId('feed-key').last().fill('new-key-value');
    await page.getByTestId('feed-save').click();

    await page.getByTestId('feed-refresh').click();
    await expect(page.getByTestId('feed-updated')).not.toContainText('ещё не обновлялось');
    expect(seen.length).toBeGreaterThan(0);
  });

  test('a key with cyrillic letters is refused for a header, with a plain reason', async ({ page }) => {
    await skipOnboarding(page);
    await page.goto('/settings');
    await page.getByTestId('feed-title').fill('API');
    await page.getByTestId('feed-url').fill('https://api.example.com/news');
    await page.getByTestId('feed-auth-kind').selectOption('bearer');
    await page.getByTestId('feed-key').fill('ключ-по-русски');
    await page.getByTestId('feed-add').click();

    await expect(page.getByTestId('feed-error')).toContainText('латиниц');
  });

  test('a source that refuses the browser shows a plain explanation', async ({ page }) => {
    await page.route('https://example.com/rss', (route) => route.abort('failed'));

    await skipOnboarding(page);
    await page.goto('/settings');
    await page.getByTestId('external-sources-toggle').check();
    await page.getByTestId('feed-title').fill('Недоступная лента');
    await page.getByTestId('feed-url').fill('https://example.com/rss');
    await page.getByTestId('feed-add').click();
    await page.getByTestId('feed-refresh').click();

    // the same explanation appears twice: next to the feed and under the form
    await expect(page.getByTestId('feed-last-error')).toContainText('CORS');
    await expect(page.getByTestId('feed-check')).toContainText('CORS');
  });
});
