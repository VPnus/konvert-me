import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ['dist', '.deploy', 'dev-dist', 'coverage', 'playwright-report', 'test-results', 'node_modules'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Build scripts run in Node.
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // shadcn/ui components and the theme provider export helpers next to components on purpose.
    files: ['src/components/ui/**/*.tsx', 'src/components/theme/theme-provider.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    // The financial core stays pure: no React, no storage, no UI.
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['react', 'react-dom', 'react-*'], message: 'src/core не должен зависеть от React.' },
            { group: ['dexie', 'dexie-*'], message: 'src/core не должен зависеть от хранилища.' },
            {
              group: ['@/db', '@/db/*', '../db/*', '@/features', '@/features/*', '../features/*'],
              message: 'src/core не должен зависеть от src/db и src/features.',
            },
          ],
        },
      ],
    },
  },
  prettier,
);
