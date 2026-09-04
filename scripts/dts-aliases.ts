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

/**
 * Every weasel specifier paired with its built declarations. `exclude` drops
 * packages by name — the package doing the emitting must reach its own modules
 * through source, not through the `.d.ts` this build is producing.
 */
export function weaselTypeEntries(
  repoRoot: string,
  exclude: readonly string[] = [],
): TypeEntry[] {
  const packagesDir = join(repoRoot, 'packages');
  const out: TypeEntry[] = [];
  for (const name of readdirSync(packagesDir)) {
    const dir = join(packagesDir, name);
    if (!statSync(dir).isDirectory()) continue;
    let pkg: { name?: string; exports?: Record<string, ExportTarget | string> };
    try {
      pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    } catch {
      continue;
    }
    if (!pkg.name || !pkg.exports || exclude.includes(pkg.name)) continue;
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
): ViteAlias[] {
  const out: ViteAlias[] = [];
  for (const { specifier, types } of weaselTypeEntries(repoRoot, exclude)) {
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
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const { specifier, types } of weaselTypeEntries(repoRoot, exclude)) {
    out[specifier] = [types];
  }
  return out;
}
