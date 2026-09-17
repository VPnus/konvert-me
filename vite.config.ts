import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

import releaseNotes from './src/app/release-notes.json' with { type: 'json' };
import site from './src/app/site.json' with { type: 'json' };

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

/**
 * Messengers build a link preview from the meta tags alone, without running the app, and want
 * whole addresses in them: the address of the site is written into index.html at build time.
 */
function siteAddress(): Plugin {
  return {
    name: 'konverkot-site-address',
    transformIndexHtml: (html) => html.replaceAll('__SITE_ORIGIN__', site.origin),
  };
}

/**
 * The version of the build and what it brings, for an open app of an older version: it reads the file
 * when its service worker finds an update, to say what the update is. Not part of the offline copy.
 */
function releaseFile(): Plugin {
  return {
    name: 'konverkot-release-file',
    apply: 'build',
    generateBundle() {
      const notes = (releaseNotes as Record<string, string[]>)[version] ?? [];
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version, notes }) });
    },
  };
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [
    react(),
    tailwindcss(),
    siteAddress(),
    releaseFile(),
    VitePWA({
      // The user confirms the update: a reload must never interrupt data entry.
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'favicon.svg', 'favicon-64.png', 'apple-touch-icon.png'],
      manifest: {
        // The identity of the installed app, kept apart from where it starts: the start may move,
        // the identity may not, or browsers would take it for another app.
        id: '/',
        name: 'Конверкот',
        short_name: 'Конверкот',
        description: 'Личные финансы офлайн: бюджет, цели и конверты. Данные остаются на вашем устройстве.',
        lang: 'ru-RU',
        dir: 'ltr',
        // The installed app opens on the app, not on the landing that the root shows to newcomers.
        start_url: '/overview',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait-primary',
        background_color: '#000000',
        theme_color: '#000000',
        categories: ['finance', 'productivity'],
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // The pictures of the landing and of the link preview are for visitors, who are online:
        // the offline copy of the app does not need them.
        globIgnores: ['**/node_modules/**/*', 'landing/**', 'og-image.png'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
  },
});
