/**
 * Map every weasel specifier to the `.d.ts` its package's `exports` map
 * declares, for a build that bundles declarations instead of re-deriving them
 * from source.
 *
 * The counterpart to `weaselAliases()` in `vite-aliases.ts`, which maps the
 * same specifiers to SOURCE — right for vite and vitest, where the dev server
 * must see an edit without a rebuild, and wrong for `.d.ts` emission, where it
 * pulls some 1,900 files into one TypeScript program to re-derive declarations
 * the earlier build tiers have already emitted.
 *
 * The `types` condition in `exports` is each package's own statement of where
 * its public declarations live, so nothing here needs editing when a package
 * gains or loses an entry point.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { ViteAlias } from './vite-aliases.ts';

interface ExportTarget {
  types?: string;
}

export interface TypeEntry {
  /** The published specifier, `*` intact for a wildcard subpath. */
  specifier: string;
  /** Absolute path to the declarations it resolves to, `*` intact. */
  types: string;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface Manifest {
  name?: string;
  exports?: Record<string, ExportTarget | string>;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

function readManifests(repoRoot: string): { dir: string; pkg: Manifest }[] {
  const packagesDir = join(repoRoot, 'packages');
  const out: { dir: string; pkg: Manifest }[] = [];
  for (const name of readdirSync(packagesDir)) {
    const dir = join(packagesDir, name);
    if (!statSync(dir).isDirectory()) continue;
    try {
      out.push({ dir, pkg: JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) });
    } catch {}
  }
  return out;
}

/**
 * Workspace packages `name` reaches through `dependencies` and
 * `peerDependencies`, transitively — the set whose declarations its own
 * declaration build can touch. `devDependencies` never reach a consumer's types.
 */
export function workspaceDependencyClosure(repoRoot: string, name: string): string[] {
  const byName = new Map(
    readManifests(repoRoot).flatMap(({ pkg }) => (pkg.name ? [[pkg.name, pkg] as const] : [])),
  );
  const seen = new Set<string>();
  const visit = (current: string): void => {
    const pkg = byName.get(current);
    if (!pkg) return;
    for (const dep of Object.keys({ ...pkg.dependencies, ...pkg.peerDependencies })) {
      if (!byName.has(dep) || seen.has(dep) || dep === name) continue;
      seen.add(dep);
      visit(dep);
    }
  };
  visit(name);
  return [...seen].sort();
}

/**
 * Every weasel specifier paired with its built declarations. `exclude` drops
 * packages by name — the package doing the emitting must reach its own modules
 * through source, not through the `.d.ts` this build is producing. `include`,
 * when given, keeps only the named packages.
 */
export function weaselTypeEntries(
  repoRoot: string,
  exclude: readonly string[] = [],
  include?: readonly string[],
): TypeEntry[] {
  const out: TypeEntry[] = [];
  for (const { dir, pkg } of readManifests(repoRoot)) {
    if (!pkg.name || !pkg.exports || exclude.includes(pkg.name)) continue;
    if (include && !include.includes(pkg.name)) continue;
    for (const [sub, target] of Object.entries(pkg.exports)) {
      const types = typeof target === 'string' ? undefined : target.types;
      if (!types?.endsWith('.d.ts')) continue;
      const specifier = sub === '.' ? pkg.name : `${pkg.name}/${sub.slice(2)}`;
      out.push({ specifier, types: resolve(dir, types) });
    }
  }
  return out;
}

/** Rollup alias entries: what the emitted bundle inlines. */
export function weaselDtsAliases(
  repoRoot: string,
  exclude: readonly string[] = [],
  include?: readonly string[],
): ViteAlias[] {
  const out: ViteAlias[] = [];
  for (const { specifier, types } of weaselTypeEntries(repoRoot, exclude, include)) {
    if (specifier.includes('*')) {
      const prefix = specifier.slice(0, specifier.indexOf('*'));
      out.push({
        find: new RegExp(`^${escapeRegex(prefix)}(.*)$`),
        replacement: types.replace('*', '$1'),
      });
    } else {
      out.push({ find: new RegExp(`^${escapeRegex(specifier)}$`), replacement: types });
    }
  }
  return out;
}

/**
 * The same table as TypeScript `paths`. rollup-plugin-dts ignores `paths`, so
 * this is not a second copy of the aliases above — it decides what the emitting
 * program treats as an EXTERNAL LIBRARY. Reached through node_modules, a
 * dependency's declarations are external, and the plugin answers that by
 * standing up a fresh TypeScript program per file. Mapped here they land in the
 * one program instead, which is most of the heap this build used to spend.
 */
export function weaselDtsPaths(
  repoRoot: string,
  exclude: readonly string[] = [],
  include?: readonly string[],
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const { specifier, types } of weaselTypeEntries(repoRoot, exclude, include)) {
    out[specifier] = [types];
  }
  return out;
}
