/**
 * News feeds. This is the only place in the app that touches the network, and only
 * when the user has turned external sources on in the settings: the request goes to
 * the host they typed and that host sees their IP address.
 */

import { db } from '@/db/db';
import { RepositoryError } from '@/db/errors';
import { feedItemSchema, feedSchema, type Feed, type FeedAuth, type FeedItem } from '@/db/models';
import { getSettings } from '@/db/repositories/settings';
import { parseOrThrow } from '@/db/validate';
import { strings } from '@/i18n';
import { publishAppEvent } from '@/lib/broadcast';
import { parseFeed } from '@/lib/feed-parser';
import { hostOf } from '@/lib/feed-presets';
import { hashString } from '@/lib/hash';
import { stripSecrets } from '@/lib/secrets';

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

export interface FeedInput {
  title: string;
  url: string;
  auth?: FeedAuth;
  itemsPath?: string;
}

/**
 * Builds the request of a feed: the key the user typed goes either into the address,
 * into a header of their choosing, or into an Authorization: Bearer header.
 */
export function buildFeedRequest(feed: Feed): { url: string; headers: Record<string, string> } {
  const headers: Record<string, string> = {
    Accept: 'application/rss+xml, application/atom+xml, application/feed+json, application/json',
  };

  const auth = feed.auth ?? { kind: 'none' };
  if (auth.kind === 'header') headers[auth.headerName] = auth.key;
  if (auth.kind === 'bearer') headers.Authorization = `Bearer ${auth.key}`;

  if (auth.kind !== 'query') return { url: feed.url, headers };

  const url = new URL(feed.url);
  url.searchParams.set(auth.paramName, auth.key);
  return { url: url.toString(), headers };
}

/**
 * What a refusal usually means, in plain words. 426 is how the news APIs say
 * "not from a browser on this plan" — the answer never reaches the page anyway.
 */
function statusHint(status: number): string {
  if (status === 401 || status === 403) return ' Похоже, ключ не подошёл или у него нет доступа.';
  if (status === 426) {
    return (
      ' Источник не обслуживает запросы из браузера на этом тарифе.' +
      ' Ключ тут ни при чём: нужен либо другой источник, либо свой сервер-посредник.'
    );
  }
  if (status === 429) return ' Слишком много запросов — источник просит подождать.';
  return '';
}

/** Every secret of a feed, so that none of them leaks into a message. */
export function secretsOf(feed: Feed): string[] {
  const auth = feed.auth ?? { kind: 'none' };
  return auth.kind === 'none' ? [] : [auth.key];
}

export async function createFeed(input: FeedInput): Promise<Feed> {
  const feed = parseOrThrow(
    feedSchema,
    {
      id: crypto.randomUUID(),
      title: input.title,
      url: input.url,
      enabled: true,
      auth: input.auth ?? { kind: 'none' },
      itemsPath: input.itemsPath || undefined,
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

export async function updateFeed(id: string, patch: Partial<FeedInput>): Promise<Feed> {
  const current = await db.feeds.get(id);
  if (!current) throw new RepositoryError('Лента не найдена');

  const next = parseOrThrow(
    feedSchema,
    {
      ...current,
      ...patch,
      itemsPath: (patch.itemsPath ?? current.itemsPath) || undefined,
      id: current.id,
      // A new address or key deserves a fresh attempt, so the old error is dropped.
      lastError: null,
    },
    'Лента',
  );

  await db.feeds.put(next);
  publishAppEvent({ type: 'data-changed' });
  return next;
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

  const request = buildFeedRequest(feed);

  try {
    const response = await fetch(request.url, {
      // No cookies, no credentials: the request carries nothing but the key the user gave.
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      headers: request.headers,
    });

    if (!response.ok) {
      throw new Error(`Источник ответил ошибкой ${response.status}.${statusHint(response.status)}`);
    }

    const parsed = parseFeed(await response.text(), {
      contentType: response.headers.get('content-type') ?? '',
      itemsPath: feed.itemsPath,
    });
    const items = parsed.items.slice(0, MAX_ITEMS_PER_FEED).map((item) =>
      parseOrThrow(
        feedItemSchema,
        {
          // A short stable key: the same article keeps its place between reads.
          id: `${feed.id}:${hashString(item.url)}`,
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
    const raw =
      cause instanceof TypeError
        ? strings.sources.corsBlocked.replace('{host}', hostOf(feed.url))
        : cause instanceof Error
          ? cause.message
          : 'Не удалось получить ленту';

    // A key must never end up in a stored message or on the screen.
    const message = stripSecrets(raw, secretsOf(feed)).slice(0, 500);

    await db.feeds.put({ ...feed, lastError: message });
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
