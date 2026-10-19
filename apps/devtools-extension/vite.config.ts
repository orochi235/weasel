// One config, three builds, picked by `--mode`: `pages` (the devtools and panel pages), and
// `content` and `background`, which must each be one classic script with nothing loaded later.
// `scripts/build.ts` runs all three, then writes each browser's manifest.
import { defineConfig, type UserConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { weaselAliases } from '../../scripts/vite-aliases.ts';
import { weaselDefines } from '../../scripts/vite-build-info.ts';
import { weaselIcons } from '../../packages/icons-plugin/src/index.ts';

const here = import.meta.dirname;
const repoRoot = resolve(here, '../..');
const OUT = resolve(here, 'dist/chrome');

const SCRIPTS = { content: 'src/content/main.ts', background: 'src/background/main.ts' } as const;

export default defineConfig(({ mode }): UserConfig => {
  const shared: UserConfig = {
    root: here,
    base: './',
    cacheDir: resolve(repoRoot, 'node_modules/.vite-devtools-extension'),
    resolve: { alias: weaselAliases(repoRoot) },
    define: weaselDefines(repoRoot),
    publicDir: false,
  };
  if (mode === 'pages') {
    return {
      ...shared,
      plugins: [react(), weaselIcons.vite({ mode: 'app' })],
      publicDir: resolve(here, 'public'),
      build: {
        outDir: OUT,
        emptyOutDir: true,
        rolldownOptions: { input: { devtools: resolve(here, 'devtools.html'), panel: resolve(here, 'panel.html') } },
      },
    };
  }
  if (mode !== 'content' && mode !== 'background') {
    throw new Error(`devtools-extension: --mode must be pages, content or background, not ${mode}`);
  }
  return {
    ...shared,
    build: {
      outDir: OUT,
      emptyOutDir: false,
      lib: {
        entry: resolve(here, SCRIPTS[mode]),
        formats: ['iife'],
        name: `weaselDevtools_${mode}`,
        fileName: () => `${mode}.js`,
      },
    },
  };
});
