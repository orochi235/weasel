import { readFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

// Bake this package's own version into `src/version.ts` so consumers can ask
// what kit they're running (`import { VERSION } from '@weasel-js/core'`).
// Reading package.json here means changesets' release bump is the only edit —
// there's no generated file to keep in sync. In-repo builds resolve core's
// source instead of this bundle and get the same define from
// `scripts/vite-build-info.ts`.
const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string };

export default defineConfig({
  define: {
    __WEASEL_CORE_VERSION__: JSON.stringify(version),
  },
  entry: {
    index: 'src/index.ts',
    move: 'src/import-shims/move.ts',
    resize: 'src/import-shims/resize.ts',
    insert: 'src/import-shims/insert.ts',
    clipboard: 'src/import-shims/clipboard.ts',
    clone: 'src/import-shims/clone.ts',
    'patterns-builtin': 'src/import-shims/patterns-builtin.ts',
    renderer: 'src/import-shims/renderer.ts',
    routing: 'src/tools/routing/index.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  treeshake: true,
  sourcemap: true,
  // splitting:true collapses modules shared across entry points (e.g. the
  // text font-registry Map in features/text/atlas/registerFont.ts) into ONE
  // shared chunk, so `dist/index.js` (Canvas/WeaselRenderer) and
  // `dist/renderer.js` (registerFont) reference the SAME registry instance.
  // With splitting:false each entry inlined its own copy → registerFont (only
  // exported from /renderer) populated a different Map than the renderer read,
  // silently dropping every glyph. See eric font-rendering fix 2026-06-14.
  splitting: true,
  target: 'es2022',
  external: ['react', 'react-dom'],
  // No `noExternal`. The @weasel-js/* sub-packages used to be inlined here —
  // both JS and .d.ts — because they reached into this package's src/core and
  // src/debug via shared tsconfig aliases and so weren't independently
  // buildable. That stopped being true once Op moved into history (56f5193f)
  // and SVG ingestion into svg (ea0df120): geom, gestures, history, and modes
  // now have zero reach-back. They are real `dependencies` and real published
  // packages, so tsup externalizes them by default for the bundle AND the
  // declarations (its dts external list is derived from deps + peerDeps).
  //
  // Inlining is not a safe default to fall back to: a consumer holding both
  // core and, say, @weasel-js/geom would get two copies of it — the same
  // duplicate-module-identity failure documented above for the font registry.
  // scripts/smoke-consumer-bundle.mjs asserts single-copy resolution.
});
