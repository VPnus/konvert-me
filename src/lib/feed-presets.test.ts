import { describe, expect, it } from 'vitest';

import { ru } from '@/i18n/ru';
import { FEED_PRESETS, findFeedPreset, hostOf } from '@/lib/feed-presets';

describe('feed presets', () => {
  it('describes every ready-made source in Russian', () => {
    for (const preset of FEED_PRESETS) {
      const text = ru.sources.presets[preset.id as keyof typeof ru.sources.presets];
      expect(text, preset.id).toBeDefined();
      expect(text.name.length).toBeGreaterThan(0);
      expect(text.label.length).toBeGreaterThan(0);
      expect(text.note.length).toBeGreaterThan(0);
    }
  });

  it('keeps every address on https and never ships a key of its own', () => {
    for (const preset of FEED_PRESETS) {
      expect(preset.url.startsWith('https://'), preset.id).toBe(true);
      expect(preset.url).not.toMatch(/(apikey|api_key|token)=[^&]+/i);
      if (preset.auth === 'query') expect(preset.paramName).toBeTruthy();
      if (preset.auth === 'header') expect(preset.headerName).toBeTruthy();
    }
  });

  it('warns about the sources a browser cannot read', () => {
    const newsapi = findFeedPreset('newsapi');
    expect(newsapi?.browserBlocked).toBe(true);
    expect(findFeedPreset('rss2json')?.browserBlocked).toBeUndefined();
    expect(findFeedPreset('нет такого')).toBeUndefined();
  });

  it('names the host of an address, and survives a broken one', () => {
    expect(hostOf('https://newsapi.org/v2/top-headlines?country=us')).toBe('newsapi.org');
    expect(hostOf('не адрес')).toBe('не адрес');
  });
});
