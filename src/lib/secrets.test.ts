import { describe, expect, it } from 'vitest';

import { maskSecret, maskUrl, stripSecrets } from '@/lib/secrets';

describe('secrets', () => {
  it('shows only the tail of a key', () => {
    expect(maskSecret('abcd1234efgh5678')).toBe('••••••••5678');
    expect(maskSecret('abc')).toBe('•••');
    expect(maskSecret('')).toBe('');
  });

  it('hides key-like query parameters of an address', () => {
    expect(maskUrl('https://api.example.com/news?apiKey=super-secret-value&q=finance')).toBe(
      'https://api.example.com/news?apiKey=%E2%80%A2%E2%80%A2%E2%80%A2%E2%80%A2%E2%80%A2%E2%80%A2%E2%80%A2%E2%80%A2alue&q=finance',
    );
    expect(maskUrl('https://api.example.com/news?token=abcdef123456')).toContain('3456');
    expect(maskUrl('https://api.example.com/news?token=abcdef123456')).not.toContain('abcdef');
  });

  it('leaves an ordinary address alone', () => {
    expect(maskUrl('https://hnrss.org/frontpage')).toBe('https://hnrss.org/frontpage');
    expect(maskUrl('не адрес')).toBe('не адрес');
  });

  it('removes a secret from any text', () => {
    const message = 'Ошибка запроса https://api.example.com?apiKey=super-secret-value';
    expect(stripSecrets(message, ['super-secret-value'])).not.toContain('super-secret-value');
    expect(stripSecrets(message, [])).toBe(message);
  });
});
