import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearAllData } from '@/db/backup';
import { db } from '@/db/db';
import { ValidationError } from '@/db/errors';
import {
  buildFeedRequest,
  createFeed,
  deleteFeed,
  ExternalSourcesDisabledError,
  isFeedStale,
  listFeedItems,
  listFeeds,
  refreshEnabledFeeds,
  refreshFeed,
} from '@/db/repositories/feeds';
import { createLink, deleteLink, listLinks, reorderLinks, updateLink } from '@/db/repositories/links';
import { updateFeed } from '@/db/repositories/feeds';
import { updateSettings } from '@/db/repositories/settings';

const RSS = `<?xml version="1.0"?><rss version="2.0"><channel>
  <title>Лента</title>
  <item><title>Первая</title><link>https://example.com/1</link><pubDate>Mon, 15 Sep 2026 10:00:00 +0000</pubDate></item>
  <item><title>Вторая</title><link>https://example.com/2</link><pubDate>Mon, 15 Sep 2026 09:00:00 +0000</pubDate></item>
</channel></rss>`;

function mockFetch(body: string, init: { ok?: boolean; status?: number; contentType?: string } = {}) {
  const response = {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    headers: { get: () => init.contentType ?? 'application/rss+xml' },
    text: async () => body,
  };
  return vi.fn().mockResolvedValue(response);
}

beforeEach(async () => {
  await clearAllData();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('pinned sources', () => {
  it('keeps the links in order and lets them be edited', async () => {
    const first = await createLink({ title: 'Курс', url: 'https://example.com/course' });
    const second = await createLink({ title: 'Блог', url: 'https://example.com/blog' });

    expect((await listLinks()).map((link) => link.title)).toEqual(['Курс', 'Блог']);

    await reorderLinks([second.id, first.id]);
    expect((await listLinks()).map((link) => link.title)).toEqual(['Блог', 'Курс']);

    await updateLink(first.id, { title: 'Курс по финансам' });
    expect((await listLinks())[1].title).toBe('Курс по финансам');

    await deleteLink(second.id);
    expect(await listLinks()).toHaveLength(1);
  });

  it('refuses an address that is not https', async () => {
    await expect(createLink({ title: 'Плохая', url: 'javascript:alert(1)' })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(createLink({ title: 'Плохая', url: 'http://example.com' })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(createLink({ title: 'Плохая', url: 'не адрес' })).rejects.toBeInstanceOf(ValidationError);
  });
});

const NEWS_API = JSON.stringify({
  articles: [
    { title: 'Статья из API', url: 'https://example.com/api-article', publishedAt: '2026-09-15T08:00:00Z' },
  ],
});

describe('the key of a source', () => {
  it('puts a key into the address when that is what the source wants', async () => {
    const feed = await createFeed({
      title: 'API',
      url: 'https://api.example.com/news?q=finance',
      auth: { kind: 'query', paramName: 'apiKey', key: 'super-secret-value' },
    });

    const request = buildFeedRequest(feed);
    expect(request.url).toBe('https://api.example.com/news?q=finance&apiKey=super-secret-value');
    expect(request.headers.Authorization).toBeUndefined();
  });

  it('puts a key into a header of the chosen name', async () => {
    const feed = await createFeed({
      title: 'API',
      url: 'https://api.example.com/news',
      auth: { kind: 'header', headerName: 'X-Api-Key', key: 'super-secret-value' },
    });

    const request = buildFeedRequest(feed);
    expect(request.url).toBe('https://api.example.com/news');
    expect(request.headers['X-Api-Key']).toBe('super-secret-value');
  });

  it('sends a bearer token', async () => {
    const feed = await createFeed({
      title: 'API',
      url: 'https://api.example.com/news',
      auth: { kind: 'bearer', key: 'super-secret-value' },
    });

    expect(buildFeedRequest(feed).headers.Authorization).toBe('Bearer super-secret-value');
  });

  it('refuses a key that cannot travel in a header', async () => {
    await expect(
      createFeed({
        title: 'API',
        url: 'https://api.example.com/news',
        auth: { kind: 'bearer', key: 'ключ-по-русски' },
      }),
    ).rejects.toThrow(/латиниц/i);

    // the same key is fine in the address, where it is percent-encoded
    const feed = await createFeed({
      title: 'API',
      url: 'https://api.example.com/news',
      auth: { kind: 'query', paramName: 'key', key: 'ключ-по-русски' },
    });
    expect(buildFeedRequest(feed).url).toContain(encodeURIComponent('ключ-по-русски'));
  });

  it('refuses a header name with spaces and an empty key', async () => {
    await expect(
      createFeed({
        title: 'API',
        url: 'https://api.example.com/news',
        auth: { kind: 'header', headerName: 'Плохой заголовок', key: 'value' },
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    await expect(
      createFeed({
        title: 'API',
        url: 'https://api.example.com/news',
        auth: { kind: 'bearer', key: '' },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('reads an API answer with a key and never stores the key in an error', async () => {
    await updateSettings({ externalFeedsEnabled: true });
    const feed = await createFeed({
      title: 'API',
      url: 'https://api.example.com/news',
      auth: { kind: 'query', paramName: 'apiKey', key: 'super-secret-value' },
    });

    const fetchMock = mockFetch(NEWS_API, { contentType: 'application/json' });
    vi.stubGlobal('fetch', fetchMock);
    expect(await refreshFeed(feed)).toBe(1);
    expect(fetchMock.mock.calls[0][0]).toContain('apiKey=super-secret-value');
    expect((await listFeedItems())[0].title).toBe('Статья из API');

    // now the source starts refusing, and the message must not carry the key
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('403 for https://api.example.com/news?apiKey=super-secret-value')),
    );
    await expect(refreshFeed((await listFeeds())[0])).rejects.toThrow();

    const stored = (await listFeeds())[0];
    expect(stored.lastError).not.toContain('super-secret-value');
    expect(stored.lastError).toContain('•');
  });

  it('explains a 401 as a key problem', async () => {
    await updateSettings({ externalFeedsEnabled: true });
    const feed = await createFeed({
      title: 'API',
      url: 'https://api.example.com/news',
      auth: { kind: 'bearer', key: 'wrong-key' },
    });
    vi.stubGlobal('fetch', mockFetch('', { ok: false, status: 401 }));

    await expect(refreshFeed(feed)).rejects.toThrow(/ключ/i);
  });

  it('keeps the stored key when only the address is changed', async () => {
    const feed = await createFeed({
      title: 'API',
      url: 'https://api.example.com/news',
      auth: { kind: 'query', paramName: 'apiKey', key: 'super-secret-value' },
    });

    const updated = await updateFeed(feed.id, { url: 'https://api.example.com/v2/news' });

    expect(updated.url).toBe('https://api.example.com/v2/news');
    expect(updated.auth).toEqual({ kind: 'query', paramName: 'apiKey', key: 'super-secret-value' });
  });

  it('follows the path to the records when the answer is unusual', async () => {
    await updateSettings({ externalFeedsEnabled: true });
    const feed = await createFeed({
      title: 'API',
      url: 'https://api.example.com/news',
      itemsPath: 'payload.list',
    });

    vi.stubGlobal(
      'fetch',
      mockFetch(
        JSON.stringify({ payload: { list: [{ title: 'Из глубины', url: 'https://example.com/deep' }] } }),
        { contentType: 'application/json' },
      ),
    );

    expect(await refreshFeed(feed)).toBe(1);
    expect((await listFeedItems())[0].title).toBe('Из глубины');
  });
});

describe('news feeds', () => {
  it('reads nothing while external sources are switched off', async () => {
    const feed = await createFeed({ title: 'Лента', url: 'https://example.com/rss' });
    const fetchMock = mockFetch(RSS);
    vi.stubGlobal('fetch', fetchMock);

    await expect(refreshFeed(feed)).rejects.toBeInstanceOf(ExternalSourcesDisabledError);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await refreshEnabledFeeds()).toBe(0);
  });

  it('stores the records of a feed once it is allowed', async () => {
    await updateSettings({ externalFeedsEnabled: true });
    const feed = await createFeed({ title: 'Лента', url: 'https://example.com/rss' });
    const fetchMock = mockFetch(RSS);
    vi.stubGlobal('fetch', fetchMock);

    expect(await refreshFeed(feed, 1_700_000_000_000)).toBe(2);

    const [request, options] = fetchMock.mock.calls[0];
    expect(request).toBe('https://example.com/rss');
    expect(options.credentials).toBe('omit');
    expect(options.referrerPolicy).toBe('no-referrer');

    const items = await listFeedItems();
    expect(items.map((item) => item.title)).toEqual(['Первая', 'Вторая']);
    expect((await listFeeds())[0].lastFetchedAt).toBe(1_700_000_000_000);
    expect((await listFeeds())[0].lastError).toBeNull();
  });

  it('replaces the records on the next read instead of piling them up', async () => {
    await updateSettings({ externalFeedsEnabled: true });
    const feed = await createFeed({ title: 'Лента', url: 'https://example.com/rss' });
    vi.stubGlobal('fetch', mockFetch(RSS));

    await refreshFeed(feed);
    await refreshFeed(feed);

    expect(await db.feedItems.count()).toBe(2);
  });

  it('remembers a readable error when the source refuses', async () => {
    await updateSettings({ externalFeedsEnabled: true });
    const feed = await createFeed({ title: 'Лента', url: 'https://example.com/rss' });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(refreshFeed(feed)).rejects.toThrow(/CORS/);
    expect((await listFeeds())[0].lastError).toMatch(/CORS/);
  });

  it('reports the status code of a failed request', async () => {
    await updateSettings({ externalFeedsEnabled: true });
    const feed = await createFeed({ title: 'Лента', url: 'https://example.com/rss' });
    vi.stubGlobal('fetch', mockFetch('', { ok: false, status: 404 }));

    await expect(refreshFeed(feed)).rejects.toThrow(/404/);
  });

  it('removes the records of a deleted feed', async () => {
    await updateSettings({ externalFeedsEnabled: true });
    const feed = await createFeed({ title: 'Лента', url: 'https://example.com/rss' });
    vi.stubGlobal('fetch', mockFetch(RSS));
    await refreshFeed(feed);

    await deleteFeed(feed.id);

    expect(await db.feeds.count()).toBe(0);
    expect(await db.feedItems.count()).toBe(0);
  });

  it('knows when a feed is stale', async () => {
    const feed = await createFeed({ title: 'Лента', url: 'https://example.com/rss' });
    expect(isFeedStale(feed)).toBe(true);
    expect(isFeedStale({ ...feed, lastFetchedAt: Date.now() })).toBe(false);
    expect(isFeedStale({ ...feed, lastFetchedAt: Date.now() - 31 * 60 * 1000 })).toBe(true);
  });
});
