/**
 * Generate vite/vitest alias entries for every workspace under `packages/`
 * plus the kit itself. Reads the directory at config-load time so adding a
 * new `packages/<name>/` workspace is one mkdir; no further config edits.
 *
 * Each package emits two entries (specific first, since vite matches in
 * order):
 *   1. A wildcard alias    `@orochi235/<name>/(.*)` → `packages/<name>/src/$1`
 *   2. A bare-package alias `@orochi235/<name>`     → `packages/<name>/src/index.ts`
 *
 * Plus the kit's own aliases:
 *   - `@orochi235/weasel/(.*)`  → `src/import-shims/$1.ts` (subpath convention)
 *   - `@orochi235/weasel`       → `src/index.ts`
 *   - Bare top-level kit paths  (`core/...`, `features/...`, etc.) to match
 *     the kit's tsconfig `baseUrl: src` setup.
 *
 * Workspaces that need to override a specific subpath (e.g.
 * `@orochi235/weasel-theme/tokens.css`) prepend their overrides — vite
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
    // Default to @orochi235/<dirname> if package.json missing/invalid.
    if (!pkgName) pkgName = `@orochi235/${name}`;
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
 * (the directory containing `packages/` and `src/`) and an optional list of
 * extra aliases that should win over the auto-generated entries.
 */
export function weaselAliases(repoRoot: string, overrides: ViteAlias[] = []): ViteAlias[] {
  return [
    // Caller-supplied overrides win (e.g., `@orochi235/weasel-theme/tokens.css`).
    ...overrides,
    // Auto-generated package aliases (wildcard + bare for each workspace).
    ...packageAliases(repoRoot),
    // Kit subpath + bare entries — these aren't in `packages/`, they're the
    // main kit source under `src/`.
    {
      find: /^@orochi235\/weasel\/(.*)$/,
      replacement: join(repoRoot, 'src/import-shims/$1.ts'),
    },
    {
      find: '@orochi235/weasel',
      replacement: join(repoRoot, 'src/index.ts'),
    },
    // Bare top-level kit paths — match the kit's tsconfig `baseUrl: src`.
    { find: /^core\/(.*)$/, replacement: resolve(repoRoot, 'src/core/$1') },
    { find: /^features\/(.*)$/, replacement: resolve(repoRoot, 'src/features/$1') },
    { find: /^affordances\/(.*)$/, replacement: resolve(repoRoot, 'src/affordances/$1') },
    { find: /^interactions\/(.*)$/, replacement: resolve(repoRoot, 'src/interactions/$1') },
    { find: /^tools\/(.*)$/, replacement: resolve(repoRoot, 'src/tools/$1') },
    { find: /^canvas\/(.*)$/, replacement: resolve(repoRoot, 'src/canvas/$1') },
  ];
}
