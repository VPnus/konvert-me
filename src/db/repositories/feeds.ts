/**
 * News feeds. This is the only place in the app that touches the network, and only
 * when the user has turned external sources on in the settings: the request goes to
 * the host they typed and that host sees their IP address.
 */

import { db } from '@/db/db';
import { RepositoryError } from '@/db/errors';
import { feedItemSchema, feedSchema, type Feed, type FeedItem } from '@/db/models';
import { getSettings } from '@/db/repositories/settings';
import { parseOrThrow } from '@/db/validate';
import { publishAppEvent } from '@/lib/broadcast';
import { parseFeed } from '@/lib/feed-parser';

export const FEED_REFRESH_INTERVAL_MS = 30 * 60 * 1000;
const MAX_ITEMS_PER_FEED = 30;

export class ExternalSourcesDisabledError extends RepositoryError {
  constructor() {
    super('Внешние источники выключены. Включите их в настройках, если хотите получать новости.');
    this.name = 'ExternalSourcesDisabledError';
  }
}

export async function listFeeds(): Promise<Feed[]> {
  return (await db.feeds.toArray()).sort((a, b) => a.createdAt - b.createdAt);
}

export async function createFeed(input: { title: string; url: string }): Promise<Feed> {
  const feed = parseOrThrow(
    feedSchema,
    {
      id: crypto.randomUUID(),
      title: input.title,
      url: input.url,
      enabled: true,
      lastFetchedAt: null,
      lastError: null,
      createdAt: Date.now(),
    },
    'Лента',
  );

  await db.feeds.add(feed);
  publishAppEvent({ type: 'data-changed' });
  return feed;
}

export async function setFeedEnabled(id: string, enabled: boolean): Promise<Feed> {
  const current = await db.feeds.get(id);
  if (!current) throw new RepositoryError('Лента не найдена');

  const next = { ...current, enabled };
  await db.feeds.put(next);
  publishAppEvent({ type: 'data-changed' });
  return next;
}

export async function deleteFeed(id: string): Promise<void> {
  await db.transaction('rw', [db.feeds, db.feedItems], async () => {
    await db.feedItems.where('feedId').equals(id).delete();
    await db.feeds.delete(id);
  });
  publishAppEvent({ type: 'data-changed' });
}

export async function listFeedItems(limit = 20): Promise<FeedItem[]> {
  const items = await db.feedItems.toArray();
  return items
    .sort((a, b) => (b.publishedAt ?? b.fetchedAt) - (a.publishedAt ?? a.fetchedAt))
    .slice(0, limit);
}

/** Reads one feed over the network and replaces the stored records of that feed. */
export async function refreshFeed(feed: Feed, now: number = Date.now()): Promise<number> {
  const settings = await getSettings();
  if (!settings.externalFeedsEnabled) throw new ExternalSourcesDisabledError();

  try {
    const response = await fetch(feed.url, {
      // No cookies, no credentials: the request carries nothing about the user.
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      headers: {
        Accept: 'application/rss+xml, application/atom+xml, application/feed+json, application/json',
      },
    });

    if (!response.ok) throw new Error(`Источник ответил ошибкой ${response.status}`);

    const parsed = parseFeed(await response.text(), response.headers.get('content-type') ?? '');
    const items = parsed.items.slice(0, MAX_ITEMS_PER_FEED).map((item) =>
      parseOrThrow(
        feedItemSchema,
        {
          id: `${feed.id}:${item.url}`,
          feedId: feed.id,
          title: item.title.slice(0, 500),
          url: item.url,
          publishedAt: item.publishedAt,
          fetchedAt: now,
        },
        'Новость',
      ),
    );

    await db.transaction('rw', [db.feeds, db.feedItems], async () => {
      await db.feedItems.where('feedId').equals(feed.id).delete();
      if (items.length > 0) await db.feedItems.bulkPut(items);
      await db.feeds.put({ ...feed, lastFetchedAt: now, lastError: null });
    });

    publishAppEvent({ type: 'data-changed' });
    return items.length;
  } catch (cause) {
    const message =
      cause instanceof TypeError
        ? 'Источник не разрешает читать себя из браузера (нет заголовков CORS). Попробуйте другой адрес ленты.'
        : cause instanceof Error
          ? cause.message
          : 'Не удалось получить ленту';

    await db.feeds.put({ ...feed, lastError: message.slice(0, 500) });
    publishAppEvent({ type: 'data-changed' });
    throw new RepositoryError(message);
  }
}

export async function refreshEnabledFeeds(now: number = Date.now()): Promise<number> {
  const settings = await getSettings();
  if (!settings.externalFeedsEnabled) return 0;

  const feeds = (await listFeeds()).filter((feed) => feed.enabled);
  let refreshed = 0;

  for (const feed of feeds) {
    try {
      await refreshFeed(feed, now);
      refreshed += 1;
    } catch {
      // the error is already stored on the feed and shown in the widget
    }
  }

  return refreshed;
}

export function isFeedStale(feed: Feed, now: number = Date.now()): boolean {
  return feed.lastFetchedAt === null || now - feed.lastFetchedAt > FEED_REFRESH_INTERVAL_MS;
}
