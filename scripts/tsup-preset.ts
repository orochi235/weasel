/**
 * Shared tsup configuration for the pure-TypeScript weasel packages.
 *
 * Packages that ship assets — raw CSS, CSS Modules, `?url` font imports — do
 * NOT use this: esbuild can't handle Vite's `?url` suffix and treats CSS
 * Modules awkwardly, so those build with Vite library mode instead.
 *
 * Nothing here sets `noExternal`. Every `@weasel-js/*` dependency is declared
 * in the consuming package's `dependencies`, and tsup externalizes deps +
 * peerDeps by default for both the JS bundle and the .d.ts.
 */
import type { Options } from 'tsup';
// From source, so a preset build needs no built @weasel-js/icons.
import { weaselIcons } from '../packages/icons-plugin/src/index';

export interface PackagePresetOptions {
  /** tsup entry map, relative to the package root. */
  readonly entry: Options['entry'];
  /** Extra externals beyond deps/peerDeps and React. */
  readonly external?: readonly (string | RegExp)[];
}

// Never inlined, declared or not: a package that bundles its own React calls
// hooks on a copy the consumer's renderer never drives.
const ALWAYS_EXTERNAL = ['react', 'react-dom'];

export function packagePreset({ entry, external = [] }: PackagePresetOptions): Options {
  return {
    entry,
    format: ['esm'],
    dts: true,
    clean: true,
    treeshake: true,
    sourcemap: true,
    target: 'es2022',
    // With splitting off, a module-level registry reachable from two entries
    // becomes two distinct instances.
    splitting: true,
    external: [...ALWAYS_EXTERNAL, ...external],
    esbuildPlugins: [weaselIcons.esbuild({ mode: 'library' })],
  };
}
