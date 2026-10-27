/**
 * Vite/vitest alias entries for every workspace under `packages/`, generated
 * from each package's `exports` map at config-load time: one alias per entry,
 * pointing at the source file that entry is built from.
 *
 * A subpath no `exports` map publishes gets no alias, so it fails to resolve in
 * a dev server and a test the way it would for a consumer. The exception is
 * `@weasel-js/<pkg>/testing/*`, the in-repo test helpers under a package's
 * `src/testing/`.
 *
 * An entry only a build produces (`@weasel-js/ui/style.css`) gets no alias
 * either, and resolves to the package's `dist`.
 */

import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { APP_SOURCES, TESTING, workspaceEntries } from './lib/packageEntries.mjs';

export interface ViteAlias {
  find: string | RegExp;
  replacement: string;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** An alias matching `specifier` exactly; its `*`, if any, matches one path segment. */
function exact(specifier: string, target: string): ViteAlias {
  const pattern = escapeRegex(specifier).replace('\\*', '([^/]+)');
  return { find: new RegExp(`^${pattern}$`), replacement: target.replace('*', '$1') };
}

function packageAliases(repoRoot: string): ViteAlias[] {
  const out: ViteAlias[] = [];
  for (const { dir, name, entries } of workspaceEntries(repoRoot)) {
    for (const entry of entries) {
      if (entry.source) out.push(exact(entry.specifier, join(dir, entry.source)));
    }
    const testing = join(dir, 'src', TESTING);
    if (existsSync(testing)) {
      out.push({ find: new RegExp(`^${escapeRegex(name)}/${TESTING}/(.*)$`), replacement: join(testing, '$1') });
    }
  }
  return out;
}

/** Full alias list. `repoRoot` is the directory containing `packages/`; `overrides` win over the generated entries. */
export function weaselAliases(repoRoot: string, overrides: ViteAlias[] = []): ViteAlias[] {
  return [
    ...overrides,
    ...packageAliases(repoRoot),
    // Bare top-level kit paths — mirror core's tsconfig path mappings.
    { find: /^core\/(.*)$/, replacement: resolve(repoRoot, 'packages/core/src/core/$1') },
    { find: /^domains\/(.*)$/, replacement: resolve(repoRoot, 'packages/core/src/domains/$1') },
    { find: /^affordances\/(.*)$/, replacement: resolve(repoRoot, 'packages/core/src/affordances/$1') },
    { find: /^interactions\/(.*)$/, replacement: resolve(repoRoot, 'packages/core/src/interactions/$1') },
    { find: /^tools\/(.*)$/, replacement: resolve(repoRoot, 'packages/core/src/tools/$1') },
    { find: /^canvas\/(.*)$/, replacement: resolve(repoRoot, 'packages/core/src/canvas/$1') },
    { find: /^debug\/(.*)$/, replacement: resolve(repoRoot, 'packages/core/src/debug/$1') },
    ...Object.entries(APP_SOURCES).map(([alias, dir]) => ({
      find: new RegExp(`^${escapeRegex(alias)}/(.*)$`),
      replacement: resolve(repoRoot, dir, '$1'),
    })),
  ];
}
