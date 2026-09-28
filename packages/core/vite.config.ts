/**
 * JavaScript build for `@weasel-js/core`; declarations come from `tsup.config.ts`.
 *
 * `preserveModules` emits one file per source module, so a consumer's bundler
 * can drop whole modules under package.json's `sideEffects`. A chunked build
 * hands it one file holding every module, where a single top-level
 * registration call keeps all of it alive: importing `asNodeId` shipped
 * ~620 kB. `npm run check:treeshake` guards this.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { entries } from './entries.ts';

const pkg = JSON.parse(readFileSync(resolve(import.meta.dirname, 'package.json'), 'utf8')) as {
  version: string;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

// Everything a consumer installs stays external, subpaths included, so each
// resolves to one copy. Every @weasel-js specifier does too, declared or not:
// an undeclared one then reaches the smoke test's audit instead of being
// silently inlined through the tsconfig paths.
const installed = [
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.peerDependencies ?? {}),
  'react-dom',
];
const external = (id: string) =>
  id.startsWith('@weasel-js/') || installed.some((d) => id === d || id.startsWith(`${d}/`));

export default defineConfig({
  plugins: [react()],
  // In-repo builds that resolve core's source get the same define from
  // `scripts/vite-build-info.ts`.
  define: { __WEASEL_CORE_VERSION__: JSON.stringify(pkg.version) },
  resolve: { tsconfigPaths: true },
  build: {
    lib: {
      entry: Object.fromEntries(
        Object.entries(entries).map(([name, path]) => [name, resolve(import.meta.dirname, path)]),
      ),
      formats: ['es'],
      cssFileName: 'index',
    },
    target: 'es2022',
    cssCodeSplit: false,
    sourcemap: true,
    emptyOutDir: true,
    rolldownOptions: {
      external,
      // A constant inlined across modules leaves only a bare `import './x.js'`
      // behind, which `"sideEffects"` lets a consumer drop — taking any
      // registration in that module with it (composite.ts registers a shader program).
      optimization: { inlineConst: false },
      output: {
        preserveModules: true,
        preserveModulesRoot: resolve(import.meta.dirname, 'src'),
        entryFileNames: '[name].js',
      },
    },
  },
});
