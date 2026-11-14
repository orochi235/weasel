import { readFileSync } from 'node:fs';
import { basename, join, matchesGlob, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { workspaceEntries } from './lib/packageEntries.mjs';

const repoRoot = resolve(import.meta.dirname, '..');

/** Whether a bundler reading `sideEffects` keeps a bare import of `source` (relative to the package). */
function keeps(sideEffects: unknown, source: string): boolean {
  if (sideEffects === undefined || sideEffects === true) return true;
  if (!Array.isArray(sideEffects)) return false;
  return sideEffects.some((pattern: string) =>
    pattern.includes('/') ? matchesGlob(`./${source}`, pattern) : matchesGlob(basename(source), pattern),
  );
}

// A stylesheet export is imported bare. In the repo it resolves to its source file, and when that file is
// one `sideEffects` doesn't name, a production build drops the import and ships the app with no styles.
describe('stylesheet exports survive tree-shaking in the repo', () => {
  for (const { dir, name, entries } of workspaceEntries(repoRoot)) {
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    for (const entry of entries.filter((e) => e.key.endsWith('.css') && e.source)) {
      it(`${name}${entry.key.slice(1)} → ${entry.source}`, () => {
        expect(keeps(pkg.sideEffects, entry.source!)).toBe(true);
      });
    }
  }
});
