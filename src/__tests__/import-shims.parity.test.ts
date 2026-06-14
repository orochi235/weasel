import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Structural parity test for kit import shims (one shim per published subpath).
 *
 * Three sources must agree on the set of named subpaths the kit ships:
 *
 *   1. `tsup.config.ts`     `entry` keys  — drives the published `dist/<name>.js`
 *   2. `package.json`       `exports`     — declares them to consumers
 *   3. `src/import-shims/*.ts`  shim files    — what vite's wildcard alias
 *                                           (`@weasel-js/core/<x>` →
 *                                           `src/import-shims/<x>.ts`) resolves to;
 *                                           required for the demo build and
 *                                           any consumer using vite/vitest
 *                                           with `weaselAliases`.
 *
 * The `.` / `index` / `./package.json` entries are special-cased: the kit
 * barrel lives at `src/index.ts` (not under `import-shims/`), and
 * `./package.json` is a JSON re-export, not a code subpath.
 *
 * If you add a new subpath to one source and forget the others, this test
 * fails with a useful diff. (We were bitten 2026-05-14 when
 * `src/import-shims/routing.ts` was missing: tsup happily built `dist/routing.js`
 * but the demo's vite build couldn't resolve the import.)
 */

const REPO_ROOT = resolve(__dirname, '../..');

function readTsupEntries(): string[] {
  const src = readFileSync(resolve(REPO_ROOT, 'tsup.config.ts'), 'utf8');
  // Pull the `entry: { ... }` block, then collect every key. The config is
  // small and stable enough that a regex parse is simpler than spinning up
  // a TS loader here.
  const block = src.match(/entry:\s*\{([^}]*)\}/);
  if (!block) throw new Error('tsup.config.ts: could not locate `entry: { ... }` block');
  const keys: string[] = [];
  // Match either bareword or quoted keys followed by `:`.
  const keyRe = /(?:^|[\s,{])(?:'([^']+)'|"([^"]+)"|([A-Za-z_$][\w$-]*))\s*:/g;
  let m: RegExpExecArray | null;
  while ((m = keyRe.exec(block[1])) !== null) {
    keys.push(m[1] ?? m[2] ?? m[3]);
  }
  return keys;
}

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

describe('subpath parity: tsup.config.ts ↔ package.json exports ↔ src/import-shims/', () => {
  const tsupKeys = readTsupEntries();
  const exportKeys = readPackageExports();
  const shimFiles = readSubpathFiles();

  // Strip the special "main" entries from each source so we can compare on a
  // common namespace of named subpaths.
  const tsupSubpaths = new Set(tsupKeys.filter((k) => k !== 'index'));
  const exportSubpaths = new Set(
    exportKeys
      .filter((k) => k !== '.' && k !== './package.json')
      .map((k) => k.replace(/^\.\//, '')),
  );
  const shimSubpaths = new Set(shimFiles);

  it('tsup.config.ts has an `index` entry for the main barrel', () => {
    expect(tsupKeys).toContain('index');
  });

  it('package.json exports the main entry `.`', () => {
    expect(exportKeys).toContain('.');
  });

  it('tsup entries match package.json exports', () => {
    expect([...tsupSubpaths].sort()).toEqual([...exportSubpaths].sort());
  });

  it('tsup entries match src/import-shims/ shim files', () => {
    expect([...tsupSubpaths].sort()).toEqual([...shimSubpaths].sort());
  });

  it('package.json exports match src/import-shims/ shim files', () => {
    expect([...exportSubpaths].sort()).toEqual([...shimSubpaths].sort());
  });
});
