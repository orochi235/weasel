import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, type AliasOptions } from 'vite';

const example = process.env.LABKIT_EXAMPLE ?? 'minimal';
const here = fileURLToPath(new URL('.', import.meta.url));

// labkit is a workspace package; the weasel monorepo root is two levels up.
const weaselRoot = fileURLToPath(new URL('../../', import.meta.url)).replace(/\/$/, '');

const labkitAlias = { '@weasel-js/labkit': fileURLToPath(new URL('./src/index.ts', import.meta.url)) };

// The examples consume @weasel-js/core from the monorepo, whose runtime
// resolves bare specifiers (`core/...`, `@weasel-js/core-*`) via the shared
// alias map. Reuse it so the examples resolve against source.
async function weaselAlias(): Promise<AliasOptions> {
  const aliasesUrl = new URL(`file://${weaselRoot}/scripts/vite-aliases.ts`);
  const { weaselAliases } = (await import(/* @vite-ignore */ aliasesUrl.href)) as {
    weaselAliases: (root: string) => AliasOptions;
  };
  return weaselAliases(weaselRoot);
}

export default defineConfig(async () => ({
  plugins: [react()],
  root: `examples/${example}`,
  resolve: {
    alias: [
      { find: '@weasel-js/labkit', replacement: labkitAlias['@weasel-js/labkit'] },
      ...(await weaselAlias()),
    ],
  },
  server: {
    fs: { allow: [here, weaselRoot] },
  },
}));
