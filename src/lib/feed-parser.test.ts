import { describe, expect, it } from 'vitest';

import { FeedParseError, parseFeed } from '@/lib/feed-parser';

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>Hacker News: Front Page</title>
  <item>
    <title>Новость про финансы</title>
    <link>https://example.com/one</link>
    <pubDate>Mon, 15 Sep 2026 10:00:00 +0000</pubDate>
  </item>
  <item>
    <title>Вторая новость</title>
    <link>https://example.com/two</link>
    <pubDate>Mon, 15 Sep 2026 09:00:00 +0000</pubDate>
  </item>
</channel></rss>`;

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Лента Atom</title>
  <entry>
    <title>Запись Atom</title>
    <link rel="alternate" href="https://example.com/atom-one" />
    <updated>2026-09-15T10:00:00Z</updated>
  </entry>
</feed>`;

const JSON_FEED = JSON.stringify({
  version: 'https://jsonfeed.org/version/1.1',
  title: 'JSON лента',
  items: [
    { title: 'Запись JSON', url: 'https://example.com/json-one', date_published: '2026-09-15T10:00:00Z' },
    { title: 'Без адреса' },
  ],
});

describe('feed parser', () => {
  it('reads an RSS 2.0 feed', () => {
    const feed = parseFeed(RSS);
    expect(feed.title).toBe('Hacker News: Front Page');
    expect(feed.items).toHaveLength(2);
    expect(feed.items[0]).toEqual({
      title: 'Новость про финансы',
      url: 'https://example.com/one',
      publishedAt: Date.parse('Mon, 15 Sep 2026 10:00:00 +0000'),
    });
  });

  it('reads an Atom feed', () => {
    const feed = parseFeed(ATOM);
    expect(feed.title).toBe('Лента Atom');
    expect(feed.items[0].url).toBe('https://example.com/atom-one');
    expect(feed.items[0].publishedAt).toBe(Date.parse('2026-09-15T10:00:00Z'));
  });

  it('reads a JSON feed and drops records without an address', () => {
    const feed = parseFeed(JSON_FEED, 'application/feed+json');
    expect(feed.title).toBe('JSON лента');
    expect(feed.items).toHaveLength(1);
    expect(feed.items[0].title).toBe('Запись JSON');
  });

  it('falls back to the address when a record has no title', () => {
    const feed = parseFeed(RSS.replace('<title>Новость про финансы</title>', '<title></title>'));
    expect(feed.items[0].title).toBe('https://example.com/one');
  });

  it('survives a record without a date', () => {
    const feed = parseFeed(RSS.replace(/<pubDate>[^<]*<\/pubDate>/, ''));
    expect(feed.items[0].publishedAt).toBeNull();
  });

  it('refuses what is not a feed', () => {
    expect(() => parseFeed('')).toThrow(FeedParseError);
    expect(() => parseFeed('<html><body>привет</body></html>')).toThrow(FeedParseError);
    expect(() => parseFeed('{"items": "нет"}', 'application/json')).toThrow(FeedParseError);
    expect(() => parseFeed('не xml <<<')).toThrow(FeedParseError);
  });
});
