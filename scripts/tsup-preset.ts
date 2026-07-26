/**
 * Shared tsup configuration for the pure-TypeScript weasel packages
 * (Tier A leaves: geom, gestures, history, modes; Tier B: svg, d3).
 *
 * Packages that ship assets — theme (raw CSS), ui (41 CSS Modules), hud
 * (`?url` font imports) — deliberately do NOT use this. esbuild can't handle
 * Vite's `?url` suffix and treats CSS Modules awkwardly, so those build with
 * Vite library mode instead. The split runs along "ships assets / doesn't".
 *
 * Nothing here sets `noExternal`. Every `@weasel-js/*` dependency is declared
 * in the consuming package's `dependencies`, and tsup externalizes deps +
 * peerDeps by default for both the JS bundle and the .d.ts — which is the
 * whole point of the packaging change. See
 * docs/superpowers/specs/2026-07-26-subpackage-publishing-design.md.
 */
import type { Options } from 'tsup';

export interface PackagePresetOptions {
  /** tsup entry map, relative to the package root. */
  readonly entry: Options['entry'];
  /** Extra externals beyond deps/peerDeps (e.g. 'react' for React packages). */
  readonly external?: readonly string[];
}

export function packagePreset({ entry, external = [] }: PackagePresetOptions): Options {
  return {
    entry,
    format: ['esm'],
    dts: true,
    clean: true,
    treeshake: true,
    sourcemap: true,
    target: 'es2022',
    // Shared modules collapse into one chunk rather than being duplicated per
    // entry point. Core learned this the hard way: with splitting off, a
    // module-level registry reachable from two entries becomes two distinct
    // instances. Same hazard applies to any multi-entry package here.
    splitting: true,
    external: [...external],
  };
}
