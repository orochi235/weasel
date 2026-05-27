import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, type AliasOptions } from 'vite';

const example = process.env.LABKIT_EXAMPLE ?? 'minimal';
const here = fileURLToPath(new URL('.', import.meta.url));

const labkitAlias = { '@labkit/react': fileURLToPath(new URL('./src/index.ts', import.meta.url)) };

// The weasel-lab example consumes @orochi235/weasel from a sibling monorepo
// whose runtime resolves bare specifiers (`core/...`, `@orochi235/weasel-*`)
// via vite aliases at the weasel side. Replicate them only for that example.
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
  root: `examples/${example}`,
  resolve: {
    alias: [
      { find: '@labkit/react', replacement: labkitAlias['@labkit/react'] },
      ...(await weaselAlias()),
    ],
  },
  server: {
    fs: { allow: [here, fileURLToPath(new URL('./node_modules/@orochi235/weasel/', import.meta.url))] },
  },
}));
