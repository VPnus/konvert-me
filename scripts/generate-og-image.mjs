/**
 * Renders the picture of the link preview (public/og-image.png, 1200×630): what a messenger shows
 * when someone sends the address of the site.
 *
 *   npm run og-image
 *
 * The cat comes from src/components/brand/cat-mark.ts, like every icon (scripts/generate-icons.mjs),
 * and Playwright, already a dev dependency, draws the picture.
 */

import { writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const vite = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom' });
const { catMarkSvg } = await vite.ssrLoadModule('/src/components/brand/cat-mark.ts');
await vite.close();

const WIDTH = 1200;
const HEIGHT = 630;

const html = `<!doctype html>
<html lang="ru">
  <body style="margin:0">
    <div id="card" style="
      width:${WIDTH}px;height:${HEIGHT}px;box-sizing:border-box;padding:0 96px;
      display:flex;align-items:center;gap:72px;background:#000;color:#fff;
      font-family:'Noto Sans','DejaVu Sans',sans-serif;">
      ${catMarkSvg({ size: 300, cat: '#ffffff', card: '#000000', padding: 0 })}
      <div style="display:flex;flex-direction:column;gap:22px">
        <div style="font-size:88px;font-weight:700;letter-spacing:-1px;line-height:1">Конверкот</div>
        <div style="font-size:46px;line-height:1.15">Бюджет, цели и конверты</div>
        <div style="font-size:30px;line-height:1.3;color:#b3b3b3">Данные остаются<br />на вашем устройстве</div>
      </div>
    </div>
  </body>
</html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
await page.setContent(html, { waitUntil: 'load' });
const png = await page.locator('#card').screenshot();
await browser.close();

const target = resolve(ROOT, 'public/og-image.png');
await writeFile(target, png);
console.warn(`✓ public/og-image.png (${WIDTH}×${HEIGHT})`);
