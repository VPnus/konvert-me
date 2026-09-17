import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

// The tests run from the root of the project, where the icons and the page live.
const file = (path: string) => readFileSync(resolve(process.cwd(), path));

/**
 * The icons of the browser tab are generated (npm run icons) and never seen by the build, so a broken
 * one would go out unnoticed: the tab would simply show a globe.
 */
describe('the icon of the browser tab', () => {
  it('is an SVG the browser can read as XML, with one class a shape', () => {
    const text = file('public/favicon.svg').toString('utf8');
    const svg = new DOMParser().parseFromString(text, 'image/svg+xml');

    expect(svg.getElementsByTagName('parsererror')).toHaveLength(0);
    expect(svg.documentElement.tagName).toBe('svg');
    expect(text).not.toMatch(/class="[^"]*"\s+class=/);
  });

  it('has an .ico of PNG pictures for the places that ask for it by name', () => {
    const ico = file('public/favicon.ico');
    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1);

    const sizes = Array.from({ length: ico.readUInt16LE(4) }, (_, index) => {
      const entry = 6 + 16 * index;
      const offset = ico.readUInt32LE(entry + 12);
      // every picture inside is a whole PNG
      expect(ico.subarray(offset + 1, offset + 4).toString('latin1')).toBe('PNG');
      expect(offset + ico.readUInt32LE(entry + 8)).toBeLessThanOrEqual(ico.length);
      return ico.readUInt8(entry);
    });
    expect(sizes).toEqual([16, 32, 48]);
  });

  it('is named by the page: the .ico with its sizes, the SVG, the PNG and the icon of a home screen', () => {
    const html = file('index.html').toString('utf8');
    expect(html).toContain('<link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48" />');
    expect(html).toContain('<link rel="icon" type="image/svg+xml" href="/favicon.svg" />');
    expect(html).toContain('href="/favicon-64.png"');
    expect(html).toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.png" />');
  });
});
