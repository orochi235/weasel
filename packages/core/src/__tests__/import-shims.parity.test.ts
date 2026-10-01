import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { entries } from '../../entries';

/**
 * Three sources must agree on the set of named subpaths the kit ships:
 *
 *   1. `entries.ts` keys           — both build configs emit `dist/<key>.js` from it
 *   2. `package.json` `exports`    — declares them to consumers
 *   3. `src/import-shims/*.ts`     — what vite's wildcard alias
 *                                    (`@weasel-js/core/<x>` → `src/import-shims/<x>.ts`)
 *                                    resolves for the demo build
 *
 * We were bitten 2026-05-14 when `src/import-shims/routing.ts` was missing: the
 * publish build emitted `dist/routing.js` but the demo's vite build could not
 * resolve the import.
 */

const REPO_ROOT = resolve(__dirname, '../..');

function readPackageExports(): string[] {
  const raw = readFileSync(resolve(REPO_ROOT, 'package.json'), 'utf8');
  const pkg = JSON.parse(raw) as { exports?: Record<string, unknown> };
  if (!pkg.exports) throw new Error('package.json: missing `exports` field');
  return Object.keys(pkg.exports);
}

function readSubpathFiles(): string[] {
  const dir = resolve(REPO_ROOT, 'src/import-shims');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts') && !f.endsWith('.test.ts'))
    .map((f) => f.replace(/\.ts$/, ''));
}

describe('subpath parity: entries.ts ↔ package.json exports ↔ src/import-shims/', () => {
  const entryKeys = Object.keys(entries);
  const exportKeys = readPackageExports();
  const shimFiles = readSubpathFiles();

  // Strip the special "main" entries from each source so we can compare on a
  // common namespace of named subpaths.
  const entrySubpaths = new Set(entryKeys.filter((k) => k !== 'index'));
  const exportSubpaths = new Set(
    exportKeys
      // A stylesheet is a file, not a module: it has no entry and no shim.
      .filter((k) => k !== '.' && k !== './package.json' && !k.endsWith('.css'))
      .map((k) => k.replace(/^\.\//, '')),
  );
  const shimSubpaths = new Set(shimFiles);

  it('entries.ts has an `index` entry for the main barrel', () => {
    expect(entryKeys).toContain('index');
  });

  it('package.json exports the main entry `.`', () => {
    expect(exportKeys).toContain('.');
  });

  it('entries match package.json exports', () => {
    expect([...entrySubpaths].sort()).toEqual([...exportSubpaths].sort());
  });

  it('entries match src/import-shims/ shim files', () => {
    expect([...entrySubpaths].sort()).toEqual([...shimSubpaths].sort());
  });

  it('package.json exports match src/import-shims/ shim files', () => {
    expect([...exportSubpaths].sort()).toEqual([...shimSubpaths].sort());
  });
});
