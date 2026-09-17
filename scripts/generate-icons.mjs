/**
 * Renders the app icons from the single source of truth in src/components/brand/cat-mark.ts.
 *
 *   node --experimental-strip-types scripts/generate-icons.ts
 *
 * Playwright (already a dev dependency for e2e) rasterises the SVG, so no extra
 * image library is needed.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Vite loads the TypeScript source of the mark, so the geometry has one home.
const vite = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom' });
const { CAT_FAVICON_SHAPES, catMarkSvg } = await vite.ssrLoadModule('/src/components/brand/cat-mark.ts');
await vite.close();

/** Black tile of the installed app, with the white cat on it. */
const TILE_BACKGROUND = '#000000';
const TILE_CAT = '#ffffff';
const TILE_CARD = '#000000';

/** Light theme ink for the favicon, and its dark theme counterpart. */
const LIGHT_CAT = '#000000';
const LIGHT_CARD = '#ffffff';
const DARK_CAT = '#ffffff';
const DARK_CARD = '#000000';

const jobs = [
  {
    file: 'public/pwa-192x192.png',
    size: 192,
    svg: catMarkSvg({ size: 192, cat: TILE_CAT, card: TILE_CARD, background: TILE_BACKGROUND, padding: 8 }),
  },
  {
    file: 'public/pwa-512x512.png',
    size: 512,
    svg: catMarkSvg({ size: 512, cat: TILE_CAT, card: TILE_CARD, background: TILE_BACKGROUND, padding: 8 }),
  },
  {
    // A maskable icon may be cropped to a circle, so the mark sits in the safe zone.
    file: 'public/pwa-maskable-512x512.png',
    size: 512,
    svg: catMarkSvg({ size: 512, cat: TILE_CAT, card: TILE_CARD, background: TILE_BACKGROUND, padding: 13 }),
  },
  {
    file: 'public/apple-touch-icon.png',
    size: 180,
    svg: catMarkSvg({ size: 180, cat: TILE_CAT, card: TILE_CARD, background: TILE_BACKGROUND, padding: 9 }),
  },
  {
    // A picture cannot follow the colour scheme, so the raster favicon is the tile of the app:
    // a black cat on a light tab strip would vanish on a dark one, the tile shows on both.
    file: 'public/favicon-64.png',
    size: 64,
    svg: catMarkSvg({
      size: 64,
      cat: TILE_CAT,
      card: TILE_CARD,
      background: TILE_BACKGROUND,
      padding: 5,
      shapes: CAT_FAVICON_SHAPES,
    }),
  },
];

/** The sizes packed into favicon.ico, for the places that ask for it by that name: bookmarks, tiles, old tabs. */
const ICO_SIZES = [16, 32, 48];

/**
 * The favicon follows the colour scheme of the browser, the app follows its own theme. It is the
 * cat for a tab (CAT_FAVICON_SHAPES): the whole mark would be a grey speck at 16 pixels.
 */
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <style>
    .cat { fill: ${LIGHT_CAT}; }
    .cat-stroke { stroke: ${LIGHT_CAT}; }
    .card { fill: ${LIGHT_CARD}; }
    @media (prefers-color-scheme: dark) {
      .cat { fill: ${DARK_CAT}; }
      .cat-stroke { stroke: ${DARK_CAT}; }
      .card { fill: ${DARK_CARD}; }
    }
  </style>
  ${catMarkSvg({ size: 64, cat: 'CAT', card: 'CARD', shapes: CAT_FAVICON_SHAPES })
    .replace(/^<svg[^>]*>/, '')
    .replace(/<\/svg>$/, '')
    // One class attribute per shape: an SVG picture is read as XML, and a second attribute of the
    // same name makes the whole file unreadable, so the browser shows its globe instead of the cat.
    .replace(/fill="(CAT|CARD|none)"( stroke="(CAT|CARD)")?/g, (_, fill, _stroke, stroke) => {
      const classes = [
        fill === 'none' ? null : fill.toLowerCase(),
        stroke ? `${stroke.toLowerCase()}-stroke` : null,
      ]
        .filter(Boolean)
        .join(' ');
      return `${fill === 'none' ? 'fill="none" ' : ''}class="${classes}"`;
    })}
</svg>`;

/** An .ico file of PNG images, as every browser since Windows Vista reads it: a directory, then the pictures. */
function icoOf(images) {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, png }, index) => {
    const entry = 6 + 16 * index;
    header.writeUInt8(size >= 256 ? 0 : size, entry);
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1);
    header.writeUInt8(0, entry + 2);
    header.writeUInt8(0, entry + 3);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...images.map(({ png }) => png)]);
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const render = async (size, svg) => {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<body style="margin:0;background:transparent">${svg}</body>`, {
      waitUntil: 'load',
    });
    return page.locator('svg').screenshot({ omitBackground: true });
  };

  for (const job of jobs) {
    const png = await render(job.size, job.svg);
    const target = resolve(ROOT, job.file);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, png);
    console.warn(`✓ ${job.file} (${job.size}px)`);
  }

  const icons = [];
  for (const size of ICO_SIZES) {
    // the smaller the icon, the less of the tile goes to the margin
    const padding = size <= 16 ? 3 : 5;
    icons.push({
      size,
      png: await render(
        size,
        catMarkSvg({
          size,
          cat: TILE_CAT,
          card: TILE_CARD,
          background: TILE_BACKGROUND,
          padding,
          shapes: CAT_FAVICON_SHAPES,
        }),
      ),
    });
  }
  await writeFile(resolve(ROOT, 'public/favicon.ico'), icoOf(icons));
  console.warn(`✓ public/favicon.ico (${ICO_SIZES.join(', ')}px)`);

  await browser.close();

  await writeFile(resolve(ROOT, 'public/favicon.svg'), `${faviconSvg}\n`, 'utf8');
  console.warn('✓ public/favicon.svg');
}

await main();
