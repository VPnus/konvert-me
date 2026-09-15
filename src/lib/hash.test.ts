import { describe, expect, it } from 'vitest';

import { hashString } from '@/lib/hash';

describe('hashString', () => {
  it('is stable for the same text', () => {
    expect(hashString('https://example.com/article')).toBe(hashString('https://example.com/article'));
  });

  it('differs for different text', () => {
    expect(hashString('https://example.com/a')).not.toBe(hashString('https://example.com/b'));
  });

  it('is always eight hex characters', () => {
    for (const value of ['', 'a', 'https://example.com/очень/длинный/адрес/статьи?x=1']) {
      expect(hashString(value)).toMatch(/^[0-9a-f]{8}$/);
    }
  });
});
