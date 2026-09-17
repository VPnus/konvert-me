import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { CAT_FAVICON_SHAPES, type Shape } from '@/components/brand/cat-mark';

// The tests run from the root of the project, where the icons and the page live.
const file = (path: string) => readFileSync(resolve(process.cwd(), path));

/** The box of the outer shapes on the 64 grid; a group is inside them (the card on the head). */
function boundsOf(shapes: readonly Shape[]) {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const shape of shapes) {
    if (shape.kind === 'rect') {
      xs.push(shape.x, shape.x + shape.w);
      ys.push(shape.y, shape.y + shape.h);
    }
    if (shape.kind === 'circle') {
      xs.push(shape.cx - shape.r, shape.cx + shape.r);
      ys.push(shape.cy - shape.r, shape.cy + shape.r);
    }
    if (shape.kind === 'path') {
      const numbers = (shape.d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
      numbers.forEach((value, index) => (index % 2 === 0 ? xs : ys).push(value));
    }
  }
  return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
}

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

  it('fills its square like the icons next to it: the whole cat was a grey speck in a tab', () => {
    const box = boundsOf(CAT_FAVICON_SHAPES);
    expect(box.left).toBeLessThanOrEqual(2);
    expect(box.top).toBeLessThanOrEqual(2);
    expect(box.right).toBeGreaterThanOrEqual(62);
    expect(box.bottom).toBeGreaterThanOrEqual(62);

    // and the SVG of the tab draws it without a margin
    expect(file('public/favicon.svg').toString('utf8')).toContain('transform="translate(0 0) scale(1)"');
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
