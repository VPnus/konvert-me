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
const { catMarkSvg } = await vite.ssrLoadModule('/src/components/brand/cat-mark.ts');
await vite.close();

/** Dark green tile of the installed app, with the light cat on it. */
const TILE_BACKGROUND = '#0b1f17';
const TILE_CAT = '#5ae0a8';
const TILE_CARD = '#0b1f17';

/** Light theme ink for the favicon, and its dark theme counterpart. */
const LIGHT_CAT = '#14532d';
const LIGHT_CARD = '#ffffff';
const DARK_CAT = '#5ae0a8';
const DARK_CARD = '#0b1f17';

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
    file: 'public/favicon-64.png',
    size: 64,
    svg: catMarkSvg({ size: 64, cat: LIGHT_CAT, card: LIGHT_CARD, padding: 2 }),
  },
];

/** The favicon follows the colour scheme of the browser, the app follows its own theme. */
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
  ${catMarkSvg({ size: 64, cat: 'CAT', card: 'CARD', padding: 2 })
    .replace(/^<svg[^>]*>/, '')
    .replace(/<\/svg>$/, '')
    .replace(/fill="CAT"/g, 'class="cat"')
    .replace(/fill="CARD"/g, 'class="card"')
    .replace(/stroke="CAT"/g, 'class="cat-stroke"')}
</svg>`;

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  for (const job of jobs) {
    await page.setViewportSize({ width: job.size, height: job.size });
    await page.setContent(`<body style="margin:0;background:transparent">${job.svg}</body>`, {
      waitUntil: 'load',
    });
    const png = await page.locator('svg').screenshot({ omitBackground: true });
    const target = resolve(ROOT, job.file);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, png);
    console.warn(`✓ ${job.file} (${job.size}px)`);
  }

  await browser.close();

  await writeFile(resolve(ROOT, 'public/favicon.svg'), `${faviconSvg}\n`, 'utf8');
  console.warn('✓ public/favicon.svg');
}

await main();
