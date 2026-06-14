import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { type AliasOptions, defineConfig } from 'vitest/config';

// labkit is a workspace package; the weasel monorepo root is two levels up.
const weaselRoot = fileURLToPath(new URL('../../', import.meta.url)).replace(/\/$/, '');

// Reuse the monorepo's canonical alias map so tests resolve @weasel-js/core*
// (and weasel's bare core/ features/ imports) against source — same as the
// root vite/vitest configs.
async function weaselAlias(): Promise<AliasOptions> {
  const aliasesUrl = new URL(`file://${weaselRoot}/scripts/vite-aliases.ts`);
  const { weaselAliases } = (await import(/* @vite-ignore */ aliasesUrl.href)) as {
    weaselAliases: (root: string) => AliasOptions;
  };
  return weaselAliases(weaselRoot);
}

export default defineConfig(async () => ({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: '@weasel-js/labkit',
        replacement: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      },
      ...(await weaselAlias()),
    ],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    css: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
}));
