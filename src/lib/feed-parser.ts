/**
 * Parsing of RSS 2.0, Atom and JSON Feed without a library: the browser already has
 * a XML parser, and one less dependency is one less thing that can phone home.
 */

export interface ParsedItem {
  readonly title: string;
  readonly url: string;
  readonly publishedAt: number | null;
}

export interface ParsedFeed {
  readonly title: string;
  readonly items: ParsedItem[];
}

export class FeedParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FeedParseError';
  }
}

function toTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function textOf(parent: Element | Document, tag: string): string {
  return parent.getElementsByTagName(tag)[0]?.textContent?.trim() ?? '';
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function parseJsonFeed(raw: unknown): ParsedFeed {
  const feed = raw as { title?: string; items?: { title?: string; url?: string; date_published?: string }[] };
  if (!Array.isArray(feed.items)) throw new FeedParseError('В JSON-ленте нет списка записей');

  return {
    title: feed.title?.trim() ?? '',
    items: feed.items
      .filter((item) => item.url && isHttpUrl(item.url))
      .map((item) => ({
        title: item.title?.trim() || (item.url as string),
        url: item.url as string,
        publishedAt: toTimestamp(item.date_published),
      })),
  };
}

function parseXmlFeed(text: string): ParsedFeed {
  const document = new DOMParser().parseFromString(text, 'application/xml');
  if (document.getElementsByTagName('parsererror').length > 0) {
    throw new FeedParseError('Не удалось разобрать ленту: это не похоже на RSS или Atom');
  }

  const rssItems = [...document.getElementsByTagName('item')];
  if (rssItems.length > 0) {
    const channel = document.getElementsByTagName('channel')[0];
    return {
      title: channel ? textOf(channel, 'title') : '',
      items: rssItems
        .map((item) => ({
          title: textOf(item, 'title'),
          url: textOf(item, 'link'),
          publishedAt: toTimestamp(textOf(item, 'pubDate') || textOf(item, 'date')),
        }))
        .filter((item) => isHttpUrl(item.url))
        .map((item) => ({ ...item, title: item.title || item.url })),
    };
  }

  const entries = [...document.getElementsByTagName('entry')];
  if (entries.length > 0) {
    return {
      title: textOf(document, 'title'),
      items: entries
        .map((entry) => {
          const links = [...entry.getElementsByTagName('link')];
          const alternate =
            links.find((link) => (link.getAttribute('rel') ?? 'alternate') === 'alternate') ?? links[0];
          return {
            title: textOf(entry, 'title'),
            url: alternate?.getAttribute('href')?.trim() ?? '',
            publishedAt: toTimestamp(textOf(entry, 'published') || textOf(entry, 'updated')),
          };
        })
        .filter((item) => isHttpUrl(item.url))
        .map((item) => ({ ...item, title: item.title || item.url })),
    };
  }

  throw new FeedParseError('В ленте нет ни одной записи');
}

export function parseFeed(text: string, contentType = ''): ParsedFeed {
  const trimmed = text.trim();
  if (!trimmed) throw new FeedParseError('Лента пришла пустой');

  const looksJson = contentType.includes('json') || trimmed.startsWith('{');
  if (looksJson) {
    try {
      return parseJsonFeed(JSON.parse(trimmed));
    } catch (error) {
      if (error instanceof FeedParseError) throw error;
      throw new FeedParseError('Не удалось разобрать JSON-ленту');
    }
  }

  return parseXmlFeed(trimmed);
}
