/**
 * Library build for `@weasel-js/ui`.
 *
 * Vite rather than tsup because this package has 41 `*.module.css` files.
 * esbuild — tsup's bundler — handles CSS Modules only awkwardly: it has no
 * stable scoped-name contract and no way to emit one merged stylesheet
 * alongside a multi-entry JS build. Vite's CSS pipeline does both.
 *
 * Declarations come from `tsc --emitDeclarationOnly` (see the `build` script),
 * not a bundler plugin. That keeps the emitted types identical to what
 * `npm run typecheck` validates, and avoids taking on a dts plugin dependency
 * whose resolution rules differ from tsc's.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * One entry per component directory, plus the barrel.
 *
 * These back the `./components/*` subpath in `exports`, so a consumer can
 * `import { Toast } from '@weasel-js/ui/components/Toast'` and pull in that
 * component instead of the whole library. A single-entry build cannot offer
 * that: there would be exactly one `dist/index.js` for every subpath to point
 * at. The keys are written to mirror the source tree, which is also where
 * `tsc --emitDeclarationOnly` puts the matching `index.d.ts` — so one `*`
 * wildcard in `exports` lines up the JS and the types by construction, and a
 * component added later is reachable with no change here or in package.json.
 *
 * Discovered by directory listing rather than hand-listed for that last reason.
 * A directory with no `index.ts` (Foundations) is not a component entry point
 * and is skipped; it still reaches consumers through whatever imports it.
 */
const componentsDir = resolve(__dirname, 'src/components');
const entries: Record<string, string> = { index: resolve(__dirname, 'src/index.ts') };
for (const dirent of readdirSync(componentsDir, { withFileTypes: true })) {
  if (!dirent.isDirectory()) continue;
  const dir = resolve(componentsDir, dirent.name);
  if (!readdirSync(dir).includes('index.ts')) continue;
  entries[`components/${dirent.name}/index`] = resolve(dir, 'index.ts');
}

export default defineConfig({
  plugins: [react()],
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
    sourcemap: true,
    emptyOutDir: true,
    rollupOptions: {
      // Everything the consumer installs stays external. Bundling React or
      // react-aria-components in would give consumers a second copy of each —
      // fatal for React (hooks) and for RAC's context-based components.
      external: [
        'react',
        'react/jsx-runtime',
        'react-dom',
        'react-aria-components',
        /^@weasel-js\//,
      ],
      output: {
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
