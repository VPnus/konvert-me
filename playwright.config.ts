import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const PERFORMANCE = /performance\.spec\.ts/;
const ACCESSIBILITY = /accessibility\.spec\.ts/;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: BASE_URL,
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'desktop',
      testIgnore: [PERFORMANCE, ACCESSIBILITY],
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
    {
      name: 'mobile',
      testIgnore: [PERFORMANCE, ACCESSIBILITY],
      use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 720 } },
    },
    // Heavy: it reads the colours and the accessibility tree of every screen and walks each with
    // Tab. Run next to the scenarios it starved them; it takes both widths itself.
    {
      name: 'accessibility',
      testMatch: ACCESSIBILITY,
      dependencies: ['desktop', 'mobile'],
      use: { ...devices['Desktop Chrome'] },
    },
    // Timed on a laptop screen and only after the rest: next to a busy suite it would
    // measure the suite, not the app.
    {
      name: 'performance',
      testMatch: PERFORMANCE,
      dependencies: ['desktop', 'mobile', 'accessibility'],
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    // The service worker only exists in a real build, so e2e runs against the preview.
    // The host is pinned: on a CI runner plain "localhost" can resolve to IPv6 only.
    command: `npm run build && npx vite preview --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
