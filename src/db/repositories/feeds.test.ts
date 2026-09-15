import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearAllData } from '@/db/backup';
import { db } from '@/db/db';
import { ValidationError } from '@/db/errors';
import {
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
