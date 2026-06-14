import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, type AliasOptions } from 'vitest/config';

const here = fileURLToPath(new URL('.', import.meta.url));

// Replicate weasel aliases for tests (same as vite.config.ts)
async function weaselAlias(): Promise<AliasOptions> {
  const weaselRoot = fileURLToPath(
    new URL('./node_modules/@orochi235/weasel/', import.meta.url),
  ).replace(/\/$/, '');
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
      { find: '@lab-kit/react', replacement: fileURLToPath(new URL('./src/index.ts', import.meta.url)) },
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
