/**
 * Library build for `@weasel-js/ui`.
 *
 * Vite rather than tsup because of this package's `*.module.css` files:
 * esbuild — tsup's bundler — has no stable scoped-name contract and no way to
 * emit one merged stylesheet alongside a multi-entry JS build.
 *
 * Declarations come from `tsc --emitDeclarationOnly` (see the `build` script),
 * not a bundler plugin. That keeps the emitted types identical to what
 * `npm run typecheck` validates.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { stableScopedName } from '../../scripts/vite-css-modules.ts';
import { weaselIcons } from '../icons-plugin/src/index.ts';

/**
 * One entry per component directory, plus the barrel, backing the
 * `./components/*` subpath in `exports`. The keys are written to mirror the
 * source tree, which is also where `tsc --emitDeclarationOnly` puts the
 * matching `index.d.ts` — so one `*` wildcard in `exports` lines up the JS
 * and the types by construction, and a component added later is reachable
 * with no change here or in package.json.
 *
 * A directory with no `index.ts` (Foundations) is not a component entry point
 * and is skipped; it still reaches consumers through whatever imports it.
 */
const componentsDir = resolve(import.meta.dirname, 'src/components');
const entries: Record<string, string> = {
  index: resolve(import.meta.dirname, 'src/index.ts'),
  'icons.table': resolve(import.meta.dirname, 'src/icons.table.ts'),
  kitIcons: resolve(import.meta.dirname, 'src/kitIcons.ts'),
  'components/paintValue': resolve(import.meta.dirname, 'src/components/paintValue.ts'),
  'components/appearance': resolve(import.meta.dirname, 'src/components/appearance.ts'),
  'overlays/portalHost': resolve(import.meta.dirname, 'src/overlays/portalHost.tsx'),
  'color/index': resolve(import.meta.dirname, 'src/color/index.ts'),
  paintGradientTrack: resolve(import.meta.dirname, 'src/paintGradientTrack.tsx'),
  kitSettings: resolve(import.meta.dirname, 'src/kitSettings.ts'),
  'floating/index': resolve(import.meta.dirname, 'src/floating/index.ts'),
};
for (const dirent of readdirSync(componentsDir, { withFileTypes: true })) {
  if (!dirent.isDirectory()) continue;
  const dir = resolve(componentsDir, dirent.name);
  if (!readdirSync(dir).includes('index.ts')) continue;
  entries[`components/${dirent.name}/index`] = resolve(dir, 'index.ts');
}

const manifest = JSON.parse(readFileSync(resolve(import.meta.dirname, 'package.json'), 'utf8')) as {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};
const installed = [...Object.keys(manifest.dependencies ?? {}), ...Object.keys(manifest.peerDependencies ?? {})];

export default defineConfig({
  plugins: [react(), weaselIcons.vite({ mode: 'library' })],
  css: { modules: { generateScopedName: stableScopedName } },
  build: {
    lib: {
      entry: entries,
      formats: ['es'],
      // Without this Vite derives the stylesheet name from the package name
      // ("ui.css"), which would not match the `./style.css` exports entry.
      cssFileName: 'style',
    },
    // One stylesheet for the whole package. With code splitting on, Vite emits
    // a stylesheet per chunk and consumers would have to know which to import.
    cssCodeSplit: false,
    // A consumer's bundler minifies. Either pass here would strip the `@icon` annotations.
    minify: false,
    sourcemap: true,
    emptyOutDir: true,
    rollupOptions: {
      // Everything the consumer installs stays external, deep imports included. A bundled
      // copy splits a context from its readers: React's hooks, RAC's components, react-aria's
      // PortalProvider. `npm run check:bundled-deps` fails a build that inlines one.
      external: (id) => installed.some((name) => id === name || id.startsWith(`${name}/`)),
      output: {
        minify: false,
        // Entry keys already carry the path (`components/Toast/index`), so emit
        // them verbatim to mirror the source tree — and the declaration tree.
        entryFileNames: '[name].js',
        // Code shared between entries is hoisted here rather than duplicated
        // into each. This is what keeps module-level state single: importing
        // the barrel AND a subpath must not yield two copies of Toast's queue.
        chunkFileNames: 'chunks/[name]-[hash].js',
      },
    },
  },
});
