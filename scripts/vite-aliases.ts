/**
 * Generate vite/vitest alias entries for every workspace under `packages/`.
 * Reads the directory at config-load time so adding a new
 * `packages/<name>/` workspace is one mkdir; no further config edits.
 *
 * Each package emits two entries (specific first, since vite matches in
 * order):
 *   1. A wildcard alias    `@weasel-js/<name>/(.*)` → `packages/<name>/src/$1`
 *   2. A bare-package alias `@weasel-js/<name>`     → `packages/<name>/src/index.ts`
 *
 * `core` is the one workspace excluded from that generic treatment, because
 * its published subpaths don't map 1:1 onto its source tree — they resolve
 * through `src/import-shims/` (`@weasel-js/core/move` →
 * `src/import-shims/move.ts`). It gets an explicit block instead:
 *   - `@weasel-js/core/(.*)`  → `packages/core/src/import-shims/$1.ts`
 *   - `@weasel-js/core`       → `packages/core/src/index.ts`
 *   - Bare top-level kit paths  (`core/...`, `features/...`, etc.) matching
 *     core's tsconfig path mappings.
 *
 * Workspaces that need to override a specific subpath (e.g.
 * `@weasel-js/theme/tokens.css`) prepend their overrides — vite
 * resolves in array order, so a more-specific entry first wins.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

export interface ViteAlias {
  find: string | RegExp;
  replacement: string;
}

/**
 * Read `packages/` and emit the matched alias pair for each package's
 * `package.json` name. Falls back to the directory name when package.json
 * can't be parsed.
 */
function packageAliases(repoRoot: string): ViteAlias[] {
  const packagesDir = join(repoRoot, 'packages');
  const out: ViteAlias[] = [];
  let entries: string[];
  try {
    entries = readdirSync(packagesDir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const dir = join(packagesDir, name);
    // `core` is aliased explicitly in weaselAliases() — its subpaths route
    // through src/import-shims/, which the generic `src/$1` rule would break.
    if (name === 'core') continue;
    try {
      if (!statSync(dir).isDirectory()) continue;
    } catch {
      continue;
    }
    const pkgJsonPath = join(dir, 'package.json');
    let pkgName: string | null = null;
    try {
      const raw = readFileSync(pkgJsonPath, 'utf8');
      const parsed = JSON.parse(raw) as { name?: string };
      if (typeof parsed.name === 'string') pkgName = parsed.name;
    } catch {
      // ignore — fall through to directory-name-based default
    }
    // Default to @weasel-js/<dirname> if package.json missing/invalid.
    if (!pkgName) pkgName = `@weasel-js/${name}`;
    const srcDir = join(dir, 'src');
    // Wildcard first (more specific), then bare.
    out.push({
      find: new RegExp(`^${escapeRegex(pkgName)}/(.*)$`),
      replacement: join(srcDir, '$1'),
    });
    out.push({
      find: pkgName,
      replacement: join(srcDir, 'index.ts'),
    });
  }
  return out;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Full alias list for any consumer of the weasel monorepo. Pass `repoRoot`
 * (the directory containing `packages/`) and an optional list of extra
 * aliases that should win over the auto-generated entries.
 */
export function weaselAliases(repoRoot: string, overrides: ViteAlias[] = []): ViteAlias[] {
  return [
    // Caller-supplied overrides win (e.g., `@weasel-js/theme/tokens.css`).
    ...overrides,
    // Auto-generated package aliases (wildcard + bare for each workspace).
    ...packageAliases(repoRoot),
    // Core's subpath + bare entries. Skipped by packageAliases() above because
    // `@weasel-js/core/<name>` resolves through the import-shim layer rather
    // than mirroring the source tree.
    {
      find: /^@weasel-js\/core\/(.*)$/,
      replacement: join(repoRoot, 'packages/core/src/import-shims/$1.ts'),
    },
    {
      find: '@weasel-js/core',
      replacement: join(repoRoot, 'packages/core/src/index.ts'),
    },
    // Bare top-level kit paths — mirror core's tsconfig path mappings.
    { find: /^core\/(.*)$/, replacement: resolve(repoRoot, 'packages/core/src/core/$1') },
    { find: /^features\/(.*)$/, replacement: resolve(repoRoot, 'packages/core/src/features/$1') },
    { find: /^affordances\/(.*)$/, replacement: resolve(repoRoot, 'packages/core/src/affordances/$1') },
    { find: /^interactions\/(.*)$/, replacement: resolve(repoRoot, 'packages/core/src/interactions/$1') },
    { find: /^tools\/(.*)$/, replacement: resolve(repoRoot, 'packages/core/src/tools/$1') },
    { find: /^canvas\/(.*)$/, replacement: resolve(repoRoot, 'packages/core/src/canvas/$1') },
    { find: /^debug\/(.*)$/, replacement: resolve(repoRoot, 'packages/core/src/debug/$1') },
  ];
}
