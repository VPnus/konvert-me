import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: [
        'src/core/**/*.ts',
        'src/db/**/*.ts',
        'src/lib/crypto.ts',
        'src/lib/platform.ts',
        'src/lib/usage.ts',
      ],
      exclude: ['**/*.test.ts', 'src/core/index.ts', 'src/core/types.ts', 'src/db/models.ts'],
      thresholds: {
        // The financial core is the one place where the plan demands 95 %.
        'src/core/**/*.ts': { statements: 95, branches: 95, functions: 95, lines: 95 },
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
