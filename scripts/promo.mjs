/**
 * Draws the pictures and the clips for the pilot announcement: a phone-shaped run through the app,
 * with the opening and the closing card.
 *
 *   npm run promo          the Russian app, roubles
 *   npm run promo -- en    the English app, dollars
 *
 * Nothing of a real person is used: the months are made up here and go in through a backup file, as
 * they would from a real household. Two rules keep the film clean: the tabs are opened by clicking
 * the rail, never by loading the address anew, and the cards are drawn over the page instead of
 * replacing it — a page that loads again shows the white of the browser for a frame, and that flash
 * is what a cut between scenes must never have. The seeding runs in a window of its own, unfilmed.
 *
 * The result lands in promo/<language>/ and is not committed.
 */

import { spawnSync } from 'node:child_process';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PROMO_PORT ?? 5311);

// The phone of the film: 720×1280 is still the narrow layout of the app (under 768) and it is a
// standard vertical size, so the video needs no stretching. Playwright films the viewport in CSS
// pixels, and a screenshot multiplies it by the scale factor: 720×1280 × 1,5 = 1080×1920.
const VIEW = { width: 720, height: 1280 };
const SCALE = 1.5;
const MINOR = 100;

const LANGUAGE = process.argv[2] ?? process.env.PROMO_LANG ?? 'ru';

// ── the two households ───────────────────────────────────────────────────────

const SETUPS = {
  ru: {
    country: 'ru',
    currency: 'RUB',
    locale: 'ru-RU',
    timezone: 'Europe/Moscow',
    lastTab: '/deductions',
    typed: '1450',
    accounts: ['Карта', 'Накопительный счёт', 'Наличные', 'Потребкредит'],
    goals: ['Отпуск', 'Первый взнос за квартиру'],
    payday: 'Зарплата',
    intro: [
      'Конверкот',
      'Бюджет, цели и конверты<br />в одном приложении',
      'Идёт пилот: ищем тех, кто попробует',
    ],
    outro: [
      'Попробуйте',
      'konverkot.gitverse.site',
      'Открывается в браузере, данные остаются на вашем устройстве. Напишите, что понравилось и чего не хватает',
    ],
    opening: 38_000,
    savings: 120_000,
    cash: 60_000,
    debt: { balance: 180_000, payment: 9_800, rate: 0.219 },
    month: [
      ['05', 'expense', 28_000, 'card', 'housing'],
      ['10', 'income', 78_000, 'card', 'salary'],
      ['11', 'expense', 1_500, 'card', 'communication'],
      ['12', 'expense', 21_400, 'card', 'groceries'],
      ['13', 'expense', 6_200, 'card', 'transport'],
      ['15', 'expense', 3_300, 'card', 'loan-interest'],
      ['16', 'expense', 6_800, 'cash', 'cafe'],
      ['17', 'transfer', 6_500, 'card', 'loan'],
      ['20', 'transfer', 12_000, 'card', 'savings'],
      ['22', 'expense', 5_400, 'card', 'fun'],
      ['25', 'income', 42_000, 'card', 'advance'],
      ['26', 'expense', 4_900, 'card', 'clothes'],
      ['27', 'expense', 3_100, 'card', 'health'],
    ],
    plan: [
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
    ],
    paydayAmount: 60_000,
    goalCosts: [150_000, 1_000_000],
    envelopes: [74_000, 46_000],
  },
  en: {
    country: 'us',
    currency: 'USD',
    locale: 'en-US',
    timezone: 'America/New_York',
    lastTab: '/tax-accounts',
    typed: '24.80',
    accounts: ['Checking', 'Savings', 'Cash', 'Car loan'],
    goals: ['Vacation', 'Down payment'],
    payday: 'Paycheck',
    intro: [
      'Konvercat',
      'Budget, goals and envelopes<br />in one app',
      'The pilot is running: looking for people to try it',
    ],
    outro: [
      'Give it a try',
      'konverkot.gitverse.site',
      'It opens in the browser and the data stays on your device. Tell us what worked and what is missing',
    ],
    opening: 2_400,
    savings: 9_800,
    cash: 900,
    debt: { balance: 7_400, payment: 310, rate: 0.079 },
    month: [
      ['05', 'expense', 1_450, 'card', 'housing'],
      ['10', 'income', 2_600, 'card', 'salary'],
      ['11', 'expense', 95, 'card', 'communication'],
      ['12', 'expense', 620, 'card', 'groceries'],
      ['13', 'expense', 260, 'card', 'transport'],
      ['15', 'expense', 48, 'card', 'loan-interest'],
      ['16', 'expense', 220, 'cash', 'cafe'],
      ['17', 'transfer', 262, 'card', 'loan'],
      ['20', 'transfer', 500, 'card', 'savings'],
      ['22', 'expense', 180, 'card', 'fun'],
      ['25', 'income', 2_600, 'card', 'salary'],
      ['26', 'expense', 140, 'card', 'clothes'],
      ['27', 'expense', 95, 'card', 'health'],
    ],
    plan: [
      ['salary', 5_200],
      ['housing', 1_450],
      ['groceries', 650],
      ['transport', 280],
      ['communication', 95],
      ['loan-interest', 48],
      ['health', 100],
      ['cafe', 240],
      ['clothes', 150],
      ['fun', 200],
    ],
    paydayAmount: 2_600,
    goalCosts: [4_500, 40_000],
    envelopes: [2_100, 1_600],
  },
};

const SETUP = SETUPS[LANGUAGE];
if (!SETUP) throw new Error(`Unknown language: ${LANGUAGE}. Use "ru" or "en".`);

const OUT = resolve(ROOT, 'promo', LANGUAGE);
const SHOTS = resolve(OUT, 'screens');
const VIDEO = resolve(OUT, 'video');
const PROFILE = resolve(OUT, 'profile');

// ── the data of the household ────────────────────────────────────────────────

function account(id, patch) {
  return {
    id,
    currency: SETUP.currency,
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
function operation(date, kind, amount, patch = {}) {
  created += 1;
  return {
    id: `op-${created}`,
    date,
    kind,
    amountMinor: Math.round(amount * MINOR),
    createdAt: created,
    ...patch,
  };
}

function goal(id, name, patch) {
  return {
    id,
    name,
    kind: 'purchase',
    costAsOf: '2026-09',
    returnRate: 0.1,
    inflationRate: 0,
    status: 'active',
    createdAt: 1,
    updatedAt: 1,
    ...patch,
  };
}

/** Four months of a household: two pay days a month, the usual expenses, a debt and savings. */
function household(data) {
  const [cardName, savingsName, cashName, debtName] = SETUP.accounts;
  data.accounts.push(
    account('card', { name: cardName, openingBalanceMinor: SETUP.opening * MINOR }),
    account('savings', {
      name: savingsName,
      type: 'savings',
      rate: SETUP.country === 'ru' ? 0.16 : 0.041,
      openingBalanceMinor: SETUP.savings * MINOR,
    }),
    account('cash', { name: cashName, type: 'cash', openingBalanceMinor: SETUP.cash * MINOR }),
    account('loan', {
      name: debtName,
      side: 'liability',
      type: SETUP.country === 'ru' ? 'consumer' : 'car',
      isLiquid: false,
      openingBalanceMinor: SETUP.debt.balance * MINOR,
      monthlyPaymentMinor: SETUP.debt.payment * MINOR,
      rate: SETUP.debt.rate,
    }),
  );

  const today = 18;
  for (const month of ['2026-06', '2026-07', '2026-08', '2026-09']) {
    const rows = SETUP.month.map(([day, kind, amount, from, target]) =>
      operation(
        `${month}-${day}`,
        kind,
        amount,
        kind === 'transfer'
          ? { accountId: from, toAccountId: target }
          : { accountId: from, categoryId: target },
      ),
    );
    data.transactions.push(
      ...rows.filter((row) => month !== '2026-09' || Number(String(row.date).slice(8)) <= today),
    );
  }

  data.incomeSources.push({
    id: 'payday',
    name: SETUP.payday,
    schedule: { kind: 'semimonthly', dayOfMonth: 10, secondDayOfMonth: 25 },
    amountMinor: SETUP.paydayAmount * MINOR,
    archived: false,
    sortOrder: 0,
    note: '',
    createdAt: 1,
  });

  for (const month of ['2026-08', '2026-09']) {
    for (const [categoryId, amount] of SETUP.plan) {
      data.budgetPlans.push({
        id: `plan-${month}-${categoryId}`,
        month,
        categoryId,
        amountMinor: amount * MINOR,
      });
    }
  }

  const [vacation, down] = SETUP.goals;
  data.goals.push(
    goal('vacation', vacation, {
      priority: 2,
      costMinor: SETUP.goalCosts[0] * MINOR,
      targetMonth: '2027-07',
    }),
    goal('down', down, {
      priority: 3,
      costMinor: SETUP.goalCosts[1] * MINOR,
      targetMonth: '2033-09',
    }),
  );
  data.envelopes.push(
    {
      id: 'env-vacation',
      goalId: 'vacation',
      accountId: 'savings',
      amountMinor: SETUP.envelopes[0] * MINOR,
    },
    { id: 'env-down', goalId: 'down', accountId: 'savings', amountMinor: SETUP.envelopes[1] * MINOR },
  );
}

// ── the card drawn over the page ─────────────────────────────────────────────

const CARD_FONT = "'Noto Sans','DejaVu Sans',sans-serif";

async function showCard(page, [big, small, note], catSvg) {
  await page.evaluate(
    ({ big: title, small: line, note: tail, cat, font, pad, gap }) => {
      const doc = globalThis.document;
      const box = doc.createElement('div');
      box.id = 'promo-card';
      box.style.cssText = `position:fixed;inset:0;z-index:2147483647;background:#000;color:#fff;box-sizing:border-box;padding:${pad};display:flex;flex-direction:column;justify-content:center;gap:${gap};font-family:${font};opacity:0;transition:opacity .45s ease`;
      box.innerHTML = `${cat}<div style="font-size:70px;font-weight:700;line-height:1.05;letter-spacing:-1.5px">${title}</div><div style="font-size:38px;line-height:1.25;color:#e6e6e6">${line}</div><div style="font-size:27px;line-height:1.35;color:#9a9a9a">${tail}</div>`;
      doc.body.append(box);
      globalThis.requestAnimationFrame(() => {
        box.style.opacity = '1';
      });
    },
    { big, small, note, cat: catSvg, font: CARD_FONT, pad: '104px 72px', gap: '38px' },
  );
  await page.waitForTimeout(700);
}

async function hideCard(page) {
  await page.evaluate(() => {
    const box = globalThis.document.getElementById('promo-card');
    if (box) box.style.opacity = '0';
  });
  await page.waitForTimeout(600);
  await page.evaluate(() => globalThis.document.getElementById('promo-card')?.remove());
}

// ── mp4 ──────────────────────────────────────────────────────────────────────

/**
 * The camera starts before the first address opens, and the browser paints its own white ground
 * while that first page loads. The flash lasts under a second and only at the head of a clip, so
 * the conversion looks for the last bright frame of the first three seconds and starts after it.
 */
function flashEnd(webm) {
  const probe = spawnSync(
    'ffmpeg',
    [
      '-v',
      'info',
      '-t',
      '3',
      '-i',
      webm,
      '-vf',
      'signalstats,metadata=print:key=lavfi.signalstats.YAVG',
      '-f',
      'null',
      '-',
    ],
    { encoding: 'utf8' },
  );
  if (probe.error) return 0;
  let at = 0;
  let last = -1;
  for (const line of (probe.stderr ?? '').split('\n')) {
    const time = line.match(/pts_time:([0-9.]+)/);
    if (time) at = Number(time[1]);
    const bright = line.match(/YAVG=([0-9.]+)/);
    if (bright && Number(bright[1]) > 150) last = at;
  }
  return last < 0 ? 0 : Math.round((last + 0.08) * 100) / 100;
}

/**
 * Playwright films in webm, and the editors of a phone want H.264 in mp4. The conversion needs the
 * ffmpeg of the system: the one Playwright carries encodes VP8 only.
 */
function toMp4(webm) {
  const mp4 = webm.replace(/\.webm$/, '.mp4');
  const start = flashEnd(webm);
  const done = spawnSync(
    'ffmpeg',
    // faststart puts the index first, so the file starts playing before it is fully read
    [
      '-y',
      ...(start ? ['-ss', String(start)] : []),
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

// The browser profile and the video live under promo/: without this the watcher of the dev server
// would see every write of the profile and reload the page under the camera.
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
  locale: SETUP.locale,
  timezoneId: SETUP.timezone,
};

/** The language of the page and a black ground under it, both before a single script of the app. */
async function prepare(context) {
  await context.addInitScript((language) => {
    try {
      globalThis.localStorage.setItem('konvert-me.language', language);
    } catch {
      // a window that refuses storage still gets the language of the browser
    }
    globalThis.document.documentElement.style.background = '#000';
  }, LANGUAGE);
}

/**
 * The camera starts before the first address is opened, and an empty tab of the browser is white.
 * A blank page painted black gives the clip a dark first second instead of a flash.
 */
async function blackout(page) {
  await page.goto('about:blank');
  await page.evaluate(() => {
    const doc = globalThis.document;
    doc.documentElement.style.background = '#000';
    if (doc.body) doc.body.style.background = '#000';
  });
  await page.waitForTimeout(600);
}

const clips = [];
const shot = async (page, name) => {
  await page.screenshot({ path: resolve(SHOTS, `${name}.png`) });
  console.warn(`  ${LANGUAGE}/screens/${name}.png`);
};
const scrollTo = async (page, top, ms = 1400) => {
  await page.evaluate((y) => globalThis.scrollTo({ top: y, behavior: 'smooth' }), top);
  await page.waitForTimeout(ms);
};

// 1. What a newcomer sees: the landing and the first question. Filmed.
{
  const context = await chromium.launchPersistentContext(PROFILE, {
    ...common,
    recordVideo: { dir: VIDEO, size: VIEW },
  });
  await prepare(context);
  const page = context.pages()[0] ?? (await context.newPage());
  await blackout(page);

  await page.goto(`${base}/`);
  await page.waitForTimeout(800);
  await showCard(page, SETUP.intro, catSvg);
  await page.screenshot({ path: resolve(SHOTS, '00-intro.png') });
  await page.waitForTimeout(2400);
  await hideCard(page);

  await page.waitForTimeout(1200);
  await shot(page, '01-landing');
  for (const y of [900, 1800, 2700]) await scrollTo(page, y, 1500);
  await scrollTo(page, 0, 900);

  // the link of the landing, not a new load: the router changes the screen without a white frame
  await page.getByTestId('landing-start').click();
  await page.waitForURL(/\/welcome$/, { timeout: 30_000 });
  await page.waitForTimeout(2200);
  await shot(page, '02-welcome');
  if (SETUP.country === 'us') {
    await page.getByTestId('onboarding-country-us').click();
    await page.waitForTimeout(1400);
  }
  await page.getByTestId('onboarding-skip').click();
  await page.waitForURL(/\/overview$/, { timeout: 30_000 });
  await page.waitForTimeout(1800);

  const clip = await page.video()?.path();
  await context.close();
  if (clip) {
    const named = resolve(VIDEO, 'clip-1.webm');
    await rename(clip, named);
    clips.push(named);
  }
}

// 2. The months go in through a backup file, in a window that is not filmed.
{
  const context = await chromium.launchPersistentContext(PROFILE, common);
  await prepare(context);
  const page = context.pages()[0] ?? (await context.newPage());

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
  await page.waitForTimeout(1000);
  await page.goto(`${base}/overview`);
  await page.waitForTimeout(1500);
  const dismiss = page.getByTestId('data-risk-dismiss');
  if (await dismiss.count()) {
    await dismiss.first().click();
    await page.waitForTimeout(800);
  }
  await context.close();
}

// 3. The household, tab by tab. Filmed, and every tab is a click on the rail.
{
  const context = await chromium.launchPersistentContext(PROFILE, {
    ...common,
    recordVideo: { dir: VIDEO, size: VIEW },
  });
  await prepare(context);
  const page = context.pages()[0] ?? (await context.newPage());
  await blackout(page);

  const tab = async (path, wait = 2200) => {
    await page.locator(`[data-testid="tab-rail"] a[href="${path}"]`).click();
    await page.waitForURL(new RegExp(`${path}$`), { timeout: 30_000 });
    await page.waitForTimeout(wait);
  };
  const hold = (ms) => page.waitForTimeout(ms);

  await page.goto(`${base}/overview`);
  await hold(2400);
  await shot(page, '03-overview');
  await scrollTo(page, 700);
  await hold(800);
  await scrollTo(page, 1400);
  await shot(page, '04-overview-more');
  await scrollTo(page, 0, 900);

  await tab('/budget');
  await shot(page, '05-budget');
  await scrollTo(page, 800);
  await hold(1200);
  await shot(page, '06-budget-table');
  await scrollTo(page, 0, 800);

  // an operation typed on camera
  await page.getByTestId('add-transaction').click();
  await hold(900);
  await page.getByTestId('transaction-amount').pressSequentially(SETUP.typed, { delay: 110 });
  await hold(500);
  await page.getByTestId('transaction-category').selectOption('groceries');
  await hold(800);
  await shot(page, '07-add-operation');
  await page.getByTestId('transaction-save').click();
  await hold(2000);
  await shot(page, '08-added');

  await tab('/goals');
  await shot(page, '09-goals');
  await scrollTo(page, 700);
  await hold(1400);
  await shot(page, '10-goals-allocation');
  await scrollTo(page, 0, 800);
  await page.getByTestId(`goal-open-${SETUP.goals[0]}`).click();
  await hold(2600);
  await shot(page, '11-goal-chart');
  // the details of a goal open as a dialog: its backdrop covers the rail until it closes
  await page.keyboard.press('Escape');
  await hold(1000);

  await tab('/balance', 2600);
  await shot(page, '12-capital-chart');
  await scrollTo(page, 800);
  await hold(1600);
  await shot(page, '13-accounts');

  await tab('/plan', 2600);
  await shot(page, '14-plan');
  await scrollTo(page, 900);
  await hold(1400);
  await shot(page, '15-plan-steps');

  await tab(SETUP.lastTab);
  await shot(page, '16-taxes');

  await tab('/settings');
  await shot(page, '17-settings');
  await scrollTo(page, 900);
  await hold(1200);
  await shot(page, '18-settings-data');
  await scrollTo(page, 0, 700);

  await showCard(page, SETUP.outro, catSvg);
  await page.screenshot({ path: resolve(SHOTS, '99-outro.png') });
  await hold(3000);

  const clip = await page.video()?.path();
  await context.close();
  if (clip) {
    const named = resolve(VIDEO, 'clip-2.webm');
    await rename(clip, named);
    clips.push(named);
  }
}

let missingFfmpeg = false;
for (const webm of clips) {
  const { mp4, missing } = toMp4(webm);
  missingFfmpeg ||= missing;
  if (mp4) {
    await rm(webm, { force: true });
    console.warn(`  ${LANGUAGE}/video/${basename(mp4)}`);
  } else {
    console.warn(`  ${LANGUAGE}/video/${basename(webm)}`);
  }
}
if (missingFfmpeg) {
  console.warn('  mp4 не собран: нет ffmpeg. Поставьте его (sudo apt install ffmpeg) и запустите снова.');
}

await vite.close();
await rm(PROFILE, { recursive: true, force: true });
console.warn(
  `✓ promo/${LANGUAGE}: кадры ${VIEW.width * SCALE}×${VIEW.height * SCALE}, видео ${VIEW.width}×${VIEW.height}`,
);
