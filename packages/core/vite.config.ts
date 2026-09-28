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
import { rolldown } from 'rolldown';
import { defineConfig, type Plugin } from 'vite';
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

// Dynamic-import targets of the paint-kind registry, rebuilt in dist/ as one
// self-contained file each. esbuild with code splitting makes an entry import
// every module a dynamic import's chunk shares with the barrel's graph, used or
// not, so a lazy kind importing core's color math would load with any import
// of core. The copy duplicates only stateless code, and must stay that way:
// a second copy of a registry would register into nothing.
const LAZY_KINDS = ['features/meshPaint/lazyKind'];
const REGISTRY_STATE = /packages\/registry\/|core\/paintKinds\.|shaders\/registerProgram\./;

function selfContainedLazyKinds(): Plugin {
  return {
    name: 'self-contained-lazy-kinds',
    apply: 'build',
    async writeBundle({ dir }) {
      for (const name of LAZY_KINDS) {
        const bundle = await rolldown({
          input: resolve(import.meta.dirname, 'src', `${name}.ts`),
          logLevel: 'silent',
        });
        const { output } = await bundle.write({
          file: resolve(dir!, `${name}.js`),
          format: 'es',
          sourcemap: true,
          codeSplitting: false,
        });
        await bundle.close();
        const chunk = output[0];
        const stateful = chunk.moduleIds.filter((id) => REGISTRY_STATE.test(id));
        if (stateful.length || chunk.imports.length || chunk.dynamicImports.length) {
          throw new Error(
            `${name}.js must be self-contained and hold no registry state; it bundles ` +
              `${stateful.join(', ') || '(none)'} and imports ` +
              `${[...chunk.imports, ...chunk.dynamicImports].join(', ') || '(nothing)'}.`,
          );
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), selfContainedLazyKinds()],
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
