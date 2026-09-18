/**
 * Draws the pictures and the walkthrough for the pilot announcement: a phone-shaped run through
 * the app, 1080×1920, plus the opening and closing cards.
 *
 *   npm run promo
 *
 * Nothing of a real person is used: the months are made up here and go in through a backup file,
 * as they would from a real household. The result lands in promo/ and is not committed.
 */

import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { spawnSync } from 'node:child_process';

import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'promo');
const SHOTS = resolve(OUT, 'screens');
const VIDEO = resolve(OUT, 'video');
const PROFILE = resolve(OUT, 'profile');
const PORT = Number(process.env.PROMO_PORT ?? 5311);

// The phone of the film: 720×1280 is still the narrow layout of the app (under 768) and it is a
// standard vertical size, so the video needs no stretching. Playwright films the viewport in CSS
// pixels, and a screenshot multiplies it by the scale factor: 720×1280 × 1,5 = 1080×1920.
const VIEW = { width: 720, height: 1280 };
const SCALE = 1.5;
const PIXELS = { width: VIEW.width * SCALE, height: VIEW.height * SCALE };
const RUB = 100;

// ── the household of the demo ────────────────────────────────────────────────

function account(id, patch) {
  return {
    id,
    currency: 'RUB',
    side: 'asset',
    type: 'debit',
    openingDate: '2026-06-01',
    isLiquid: true,
    archived: false,
    createdAt: 1,
    updatedAt: 1,
    ...patch,
  };
}

let created = 0;
function operation(date, kind, rubles, patch = {}) {
  created += 1;
  return {
    id: `op-${created}`,
    date,
    kind,
    amountMinor: Math.round(rubles * RUB),
    createdAt: created,
    ...patch,
  };
}

function goal(id, name, patch = {}) {
  return {
    id,
    name,
    priority: 1,
    kind: 'purchase',
    costAsOf: '2026-09',
    targetMonth: '2029-09',
    returnRate: 0.1,
    inflationRate: 0,
    status: 'active',
    createdAt: 1,
    updatedAt: 1,
    ...patch,
  };
}

/** Four months of a household: two incomes a month, the usual expenses, a loan and savings. */
function household(data) {
  data.accounts.push(
    account('card', { name: 'Карта', openingBalanceMinor: 38_000 * RUB }),
    account('savings', {
      name: 'Накопительный счёт',
      type: 'savings',
      rate: 0.16,
      openingBalanceMinor: 120_000 * RUB,
    }),
    account('cash', { name: 'Наличные', type: 'cash', openingBalanceMinor: 60_000 * RUB }),
    account('loan', {
      name: 'Потребкредит',
      side: 'liability',
      type: 'consumer',
      isLiquid: false,
      openingBalanceMinor: 180_000 * RUB,
      monthlyPaymentMinor: 9_800 * RUB,
      rate: 0.219,
    }),
  );

  const today = 18;
  for (const month of ['2026-06', '2026-07', '2026-08', '2026-09']) {
    const rows = [
      operation(`${month}-05`, 'expense', 28_000, { accountId: 'card', categoryId: 'housing' }),
      operation(`${month}-10`, 'income', 78_000, { accountId: 'card', categoryId: 'salary' }),
      operation(`${month}-11`, 'expense', 1_500, { accountId: 'card', categoryId: 'communication' }),
      operation(`${month}-12`, 'expense', 21_400, { accountId: 'card', categoryId: 'groceries' }),
      operation(`${month}-13`, 'expense', 6_200, { accountId: 'card', categoryId: 'transport' }),
      operation(`${month}-15`, 'expense', 3_300, { accountId: 'card', categoryId: 'loan-interest' }),
      operation(`${month}-16`, 'expense', 6_800, { accountId: 'cash', categoryId: 'cafe' }),
      operation(`${month}-17`, 'transfer', 6_500, { accountId: 'card', toAccountId: 'loan' }),
      operation(`${month}-20`, 'transfer', 12_000, { accountId: 'card', toAccountId: 'savings' }),
      operation(`${month}-22`, 'expense', 5_400, { accountId: 'card', categoryId: 'fun' }),
      operation(`${month}-25`, 'income', 42_000, { accountId: 'card', categoryId: 'advance' }),
      operation(`${month}-26`, 'expense', 4_900, { accountId: 'card', categoryId: 'clothes' }),
      operation(`${month}-27`, 'expense', 3_100, { accountId: 'card', categoryId: 'health' }),
    ];
    data.transactions.push(
      ...rows.filter((row) => month !== '2026-09' || Number(String(row.date).slice(8)) <= today),
    );
  }

  data.incomeSources.push({
    id: 'salary',
    name: 'Зарплата',
    schedule: { kind: 'semimonthly', dayOfMonth: 10, secondDayOfMonth: 25 },
    amountMinor: 60_000 * RUB,
    archived: false,
    sortOrder: 0,
    note: '',
    createdAt: 1,
  });

  const plan = [
    ['salary', 78_000],
    ['advance', 42_000],
    ['housing', 28_000],
    ['groceries', 22_000],
    ['transport', 6_500],
    ['communication', 1_500],
    ['loan-interest', 3_300],
    ['health', 3_000],
    ['cafe', 7_000],
    ['clothes', 5_000],
    ['fun', 6_000],
  ];
  for (const month of ['2026-08', '2026-09']) {
    for (const [categoryId, rubles] of plan) {
      data.budgetPlans.push({
        id: `plan-${month}-${categoryId}`,
        month,
        categoryId,
        amountMinor: rubles * RUB,
      });
    }
  }

  data.goals.push(
    goal('vacation', 'Отпуск', { costMinor: 150_000 * RUB, targetMonth: '2027-07', priority: 2 }),
    goal('flat', 'Первый взнос за квартиру', {
      costMinor: 1_000_000 * RUB,
      targetMonth: '2033-09',
      priority: 3,
    }),
  );
  data.envelopes.push(
    { id: 'env-vacation', goalId: 'vacation', accountId: 'savings', amountMinor: 74_000 * RUB },
    { id: 'env-flat', goalId: 'flat', accountId: 'savings', amountMinor: 46_000 * RUB },
  );
}

// ── the cards that open and close the video ──────────────────────────────────

function card(lines, { catSvg }) {
  const [big, small, note] = lines;
  return `<!doctype html>
<html lang="ru"><body style="margin:0">
  <div style="
    width:${VIEW.width}px;height:${VIEW.height}px;box-sizing:border-box;padding:104px 72px;
    display:flex;flex-direction:column;justify-content:center;gap:38px;
    background:#000;color:#fff;font-family:'Noto Sans','DejaVu Sans',sans-serif;">
    ${catSvg}
    <div style="font-size:70px;font-weight:700;line-height:1.05;letter-spacing:-1.5px">${big}</div>
    <div style="font-size:38px;line-height:1.25;color:#e6e6e6">${small}</div>
    <div style="font-size:27px;line-height:1.35;color:#9a9a9a">${note}</div>
  </div>
</body></html>`;
}

/**
 * Playwright films in webm, and the editors of a phone want H.264 in mp4. The conversion needs
 * ffmpeg of the system: the one that comes with Playwright encodes VP8 only. Without ffmpeg the
 * webm stays and the run says so.
 */
function toMp4(webm) {
  const mp4 = webm.replace(/\.webm$/, '.mp4');
  const done = spawnSync(
    'ffmpeg',
    // faststart puts the index first, so the file starts playing before it is fully read
    [
      '-y',
      '-i',
      webm,
      '-c:v',
      'libx264',
      '-preset',
      'slow',
      '-crf',
      '20',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      mp4,
    ],
    { stdio: 'ignore' },
  );
  if (done.error?.code === 'ENOENT') return { mp4: null, missing: true };
  return { mp4: done.status === 0 ? mp4 : null, missing: false };
}

// ── the run ──────────────────────────────────────────────────────────────────

await rm(OUT, { recursive: true, force: true });
await mkdir(SHOTS, { recursive: true });
await mkdir(VIDEO, { recursive: true });
const clips = [];

// The browser profile and the video live under promo/: without this the watcher of the dev
// server would see every write of the profile and reload the page under the camera.
const vite = await createServer({
  root: ROOT,
  server: { port: PORT, strictPort: true, watch: { ignored: ['**/promo/**'] } },
});
await vite.listen();
const base = `http://127.0.0.1:${PORT}`;
const { catMarkSvg } = await vite.ssrLoadModule('/src/components/brand/cat-mark.ts');
const catSvg = catMarkSvg({ size: 148, cat: '#ffffff', card: '#000000', padding: 0 });

const common = {
  viewport: VIEW,
  deviceScaleFactor: SCALE,
  locale: 'ru-RU',
  timezoneId: 'Europe/Moscow',
};

// 1. An empty app: the landing and the first question, filmed as a newcomer sees them. The months
// go in at the end of the same run, so the second window opens on a household.
{
  const context = await chromium.launchPersistentContext(PROFILE, {
    ...common,
    recordVideo: { dir: VIDEO, size: VIEW },
  });
  const page = context.pages()[0] ?? (await context.newPage());

  await page.goto(`${base}/`);
  await page.waitForTimeout(2600);
  await page.screenshot({ path: resolve(SHOTS, '01-landing.png') });
  for (const y of [900, 1800, 2700]) {
    await page.evaluate((top) => globalThis.scrollTo({ top, behavior: 'smooth' }), y);
    await page.waitForTimeout(1500);
  }
  await page.evaluate(() => globalThis.scrollTo({ top: 0, behavior: 'smooth' }));
  await page.waitForTimeout(900);

  await page.goto(`${base}/welcome`);
  await page.waitForTimeout(2400);
  await page.screenshot({ path: resolve(SHOTS, '02-welcome.png') });
  await page.getByTestId('onboarding-skip').click();
  await page.waitForURL(/\/overview$/, { timeout: 30_000 });
  await page.waitForTimeout(1200);

  await page.goto(`${base}/settings`);
  const download = page.waitForEvent('download');
  await page.getByTestId('backup-export').click();
  const file = resolve(OUT, 'backup.json');
  await (await download).saveAs(file);
  const backup = JSON.parse(await readFile(file, 'utf8'));
  household(backup.data);
  await writeFile(file, JSON.stringify(backup));
  await page.getByTestId('backup-import').setInputFiles(file);
  await page.getByTestId('confirm-action').click();
  await page.getByTestId('backup-message').waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1500);

  // The two notices above the screens are true and both go away by doing what they ask: a copy
  // saved just now, and the warning about the storage put aside.
  const second = page.waitForEvent('download');
  await page.getByTestId('backup-export').click();
  await (await second).saveAs(resolve(OUT, 'backup-2.json'));
  await page.waitForTimeout(1200);
  await page.goto(`${base}/overview`);
  await page.waitForTimeout(1500);
  const dismiss = page.getByTestId('data-risk-dismiss');
  if (await dismiss.count()) {
    await dismiss.first().click();
    await page.waitForTimeout(800);
  }
  const clip = await page.video()?.path();
  await context.close();
  if (clip) {
    const named = resolve(VIDEO, 'clip-1-знакомство.webm');
    await rename(clip, named);
    clips.push(named);
  }
}

// 2. The same profile, now filmed.
const context = await chromium.launchPersistentContext(PROFILE, {
  ...common,
  recordVideo: { dir: VIDEO, size: VIEW },
});
const page = context.pages()[0] ?? (await context.newPage());

const hold = (ms) => page.waitForTimeout(ms);
const shot = async (name) => {
  await page.screenshot({ path: resolve(SHOTS, `${name}.png`) });
  console.warn(`  screens/${name}.png`);
};
const scroll = async (to, ms = 1400) => {
  await page.evaluate((y) => globalThis.scrollTo({ top: y, behavior: 'smooth' }), to);
  await hold(ms);
};
const open = async (path, wait = 1800) => {
  await page.goto(`${base}${path}`);
  await hold(wait);
};

// the opening card
await page.setContent(
  card(
    ['Конверкот', 'Бюджет, цели и конверты<br />в одном приложении', 'Идёт пилот: ищем тех, кто попробует'],
    { catSvg },
  ),
  { waitUntil: 'load' },
);
await hold(2600);
await page.screenshot({ path: resolve(SHOTS, '00-intro.png') });

await open('/overview', 2400);
await shot('03-overview');
await scroll(700);
await hold(900);
await scroll(1400);
await shot('03b-overview-more');
await scroll(0, 900);

await open('/budget', 2400);
await shot('04-budget');
await scroll(800);
await hold(1200);
await shot('05-budget-table');

// an operation typed on camera
await scroll(0, 800);
await page.getByTestId('add-transaction').click();
await hold(900);
await page.getByTestId('transaction-amount').pressSequentially('1450', { delay: 110 });
await hold(500);
await page.getByTestId('transaction-category').selectOption({ label: 'Продукты' });
await hold(800);
await shot('06-add-operation');
await page.getByTestId('transaction-save').click();
await hold(2000);
await shot('07-added');

await open('/goals', 2400);
await shot('08-goals');
await scroll(700);
await hold(1400);
await shot('09-goals-allocation');
await scroll(0, 800);
await page.getByTestId('goal-open-Отпуск').click();
await hold(2600);
await shot('10-goal-chart');

await open('/balance', 2600);
await shot('11-capital-chart');
await scroll(800);
await hold(1600);
await shot('12-accounts');

await open('/plan', 2600);
await shot('13-plan');
await scroll(900);
await hold(1400);
await shot('14-plan-steps');

await open('/deductions', 2400);
await shot('15-deductions');

await open('/settings', 2400);
await shot('16-settings');
await scroll(900);
await hold(1200);
await shot('17-settings-data');

// the closing card
await page.setContent(
  card(
    [
      'Попробуйте',
      'konverkot.gitverse.site',
      'Открывается в браузере, данные остаются на вашем устройстве. Напишите, что понравилось и чего не хватает',
    ],
    { catSvg },
  ),
  { waitUntil: 'load' },
);
await hold(3200);
await page.screenshot({ path: resolve(SHOTS, '99-outro.png') });

const clip = await page.video()?.path();
await context.close();
if (clip) {
  const named = resolve(VIDEO, 'clip-2-приложение.webm');
  await rename(clip, named);
  clips.push(named);
}

let missingFfmpeg = false;
for (const webm of clips) {
  const { mp4, missing } = toMp4(webm);
  missingFfmpeg ||= missing;
  if (mp4) {
    await rm(webm, { force: true });
    console.warn(`  video/${basename(mp4)}`);
  } else {
    console.warn(`  video/${basename(webm)}`);
  }
}
if (missingFfmpeg) {
  console.warn('  mp4 не собран: нет ffmpeg. Поставьте его (sudo apt install ffmpeg) и запустите снова.');
}
await vite.close();
await rm(PROFILE, { recursive: true, force: true });
console.warn(`✓ promo/screens (${PIXELS.width}×${PIXELS.height}) и promo/video`);
