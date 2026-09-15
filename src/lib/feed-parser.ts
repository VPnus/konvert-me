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

type JsonRecord = Record<string, unknown>;

/** Field names the common news APIs use, in the order they are tried. */
const URL_FIELDS = ['url', 'link', 'webUrl', 'web_url', 'canonical_url', 'permalink'];
const TITLE_FIELDS = ['title', 'headline', 'name', 'webTitle'];
const DATE_FIELDS = [
  'date_published',
  'publishedAt',
  'published_at',
  'published',
  'pubDate',
  'created_at',
  'webPublicationDate',
  'date',
  'updated',
];
/** Where a list of records usually hides in a JSON answer. */
const ITEM_CONTAINERS = [
  'items',
  'articles',
  'results',
  'data',
  'posts',
  'entries',
  'stories',
  'hits',
  'news',
];

function readPath(raw: unknown, path: string): unknown {
  return path
    .split('.')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce<unknown>((value, part) => {
      if (value === null || typeof value !== 'object') return undefined;
      return (value as JsonRecord)[part];
    }, raw);
}

function firstString(record: JsonRecord, fields: readonly string[]): string {
  for (const field of fields) {
    const value = record[field];
    if (typeof value === 'string' && value.trim()) return value.trim();
    // A few APIs nest the address, e.g. { link: { href: "…" } }.
    if (value && typeof value === 'object') {
      const nested = (value as JsonRecord).href ?? (value as JsonRecord).url;
      if (typeof nested === 'string' && nested.trim()) return nested.trim();
    }
  }
  return '';
}

function findItems(raw: unknown, itemsPath?: string): unknown[] {
  if (itemsPath) {
    const explicit = readPath(raw, itemsPath);
    if (!Array.isArray(explicit)) {
      throw new FeedParseError(`По пути «${itemsPath}» в ответе нет списка записей`);
    }
    return explicit;
  }

  if (Array.isArray(raw)) return raw;

  if (raw && typeof raw === 'object') {
    for (const container of ITEM_CONTAINERS) {
      const value = (raw as JsonRecord)[container];
      if (Array.isArray(value)) return value;
    }
    // One level deeper: { data: { articles: [...] } }
    for (const value of Object.values(raw as JsonRecord)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        for (const container of ITEM_CONTAINERS) {
          const nested = (value as JsonRecord)[container];
          if (Array.isArray(nested)) return nested;
        }
      }
    }
  }

  throw new FeedParseError(
    'В ответе не нашёлся список записей. Укажите путь к нему, например «data.articles».',
  );
}

function parseJsonFeed(raw: unknown, itemsPath?: string): ParsedFeed {
  const records = findItems(raw, itemsPath);
  const title =
    raw && typeof raw === 'object' && typeof (raw as JsonRecord).title === 'string'
      ? ((raw as JsonRecord).title as string).trim()
      : '';

  const items = records
    .filter((record): record is JsonRecord => Boolean(record) && typeof record === 'object')
    .map((record) => ({
      title: firstString(record, TITLE_FIELDS),
      url: firstString(record, URL_FIELDS),
      publishedAt: toTimestamp(firstString(record, DATE_FIELDS)),
    }))
    .filter((item) => isHttpUrl(item.url))
    .map((item) => ({ ...item, title: item.title || item.url }));

  if (items.length === 0) {
    throw new FeedParseError('В ответе нет ни одной записи с адресом статьи');
  }

  return { title, items };
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

export interface ParseFeedOptions {
  readonly contentType?: string;
  /** Path to the list of records in a JSON answer, e.g. "data.articles". */
  readonly itemsPath?: string;
}

export function parseFeed(text: string, options: ParseFeedOptions | string = {}): ParsedFeed {
  const { contentType = '', itemsPath } = typeof options === 'string' ? { contentType: options } : options;

  const trimmed = text.trim();
  if (!trimmed) throw new FeedParseError('Лента пришла пустой');

  const looksJson = contentType.includes('json') || trimmed.startsWith('{') || trimmed.startsWith('[');
  if (looksJson) {
    let raw: unknown;
    try {
      raw = JSON.parse(trimmed);
    } catch {
      throw new FeedParseError('Не удалось разобрать JSON-ответ');
    }
    return parseJsonFeed(raw, itemsPath);
  }

  return parseXmlFeed(trimmed);
}
