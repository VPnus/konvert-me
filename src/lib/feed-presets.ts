/**
 * Ready-made sources for the news widget.
 *
 * A browser may only read an answer the site explicitly allows it to read (CORS).
 * Most news APIs and almost every classic RSS feed send no such permission, so the
 * list below is split honestly: the sources that work from a browser, and the ones
 * that need a server of your own. Every address was checked by hand.
 */

export type FeedPresetAuth = 'none' | 'query' | 'header' | 'bearer';

export interface FeedPreset {
  readonly id: string;
  readonly url: string;
  readonly auth: FeedPresetAuth;
  readonly paramName?: string;
  readonly headerName?: string;
  readonly itemsPath?: string;
  /** Where the key is issued, when the source needs one. */
  readonly keyUrl?: string;
  /** The site answers without CORS headers: no browser can read it, key or no key. */
  readonly browserBlocked?: boolean;
}

export const FEED_PRESETS: readonly FeedPreset[] = [
  {
    id: 'rss2json',
    url: 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Flenta.ru%2Frss%2Fnews',
    auth: 'none',
  },
  {
    id: 'newsdata',
    url: 'https://newsdata.io/api/1/latest?language=ru',
    auth: 'query',
    paramName: 'apikey',
    keyUrl: 'https://newsdata.io/register',
  },
  {
    id: 'gnews',
    url: 'https://gnews.io/api/v4/top-headlines?lang=ru&category=business',
    auth: 'query',
    paramName: 'apikey',
    keyUrl: 'https://gnews.io/register',
  },
  {
    id: 'currents',
    url: 'https://api.currentsapi.services/v1/latest-news?language=ru',
    auth: 'query',
    paramName: 'apiKey',
    itemsPath: 'news',
    keyUrl: 'https://currentsapi.services/en/register',
  },
  {
    id: 'newsapi',
    url: 'https://newsapi.org/v2/top-headlines?country=us&pageSize=20',
    auth: 'query',
    paramName: 'apiKey',
    keyUrl: 'https://newsapi.org/register',
    browserBlocked: true,
  },
] as const;

export function findFeedPreset(id: string): FeedPreset | undefined {
  return FEED_PRESETS.find((preset) => preset.id === id);
}

/** The host of an address, for a message that says which site refused. */
export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
