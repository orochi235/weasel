import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, matchesGlob, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SCOPED, TRIGGERS } from './fleet-triggers.mjs';

const ROOT = join(import.meta.dirname, '../..');
const EXTENSIONS = ['', '.ts', '.tsx', '.mts', '.mjs', '.js', '/index.ts'];

/** Every repo file `entry` reaches through a quoted relative path: its imports, and setup files named as strings. */
const reached = (entry: string) => {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const [, spec] of readFileSync(join(ROOT, file), 'utf8').matchAll(/['"](\.{1,2}\/[^'"\s]+)['"]/g)) {
      const base = relative(ROOT, join(ROOT, dirname(file), spec));
      const hit = EXTENSIONS.map((ext) => base + ext).find((path) => existsSync(join(ROOT, path)) && statSync(join(ROOT, path)).isFile());
      if (hit && /\.m?[jt]sx?$/.test(hit) && !hit.startsWith('..')) queue.push(hit);
    }
  }
  return [...seen];
};

// Package and app source is imported by the tests that cover it, so `related` reaches those by import.
const IMPORTED_BY_TESTS = ['packages/**', 'apps/*/src/**', 'apps/shared/**'];

describe('the fleet triggers', () => {
  it('cover every file vitest.config.ts loads that no test reaches by import', () => {
    const uncovered = reached('vitest.config.ts').filter(
      (path) => ![...TRIGGERS, ...IMPORTED_BY_TESTS].some((glob) => matchesGlob(path, glob)),
    );
    expect(uncovered).toEqual([]);
  });

  it('keep each scoped trigger inside one workspace or app', () => {
    for (const glob of SCOPED) expect(glob).toMatch(/^(\{packages,apps\}|packages|apps)\/\*\//);
  });
});
