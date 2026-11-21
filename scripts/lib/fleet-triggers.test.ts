import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, matchesGlob, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runsEverything } from './fleet-tree.mjs';
import { isTestFile, LOADED, SCOPED, TRIGGERS } from './fleet-triggers.mjs';

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

/** What vitest loads: its config, the run's launcher (`.onto/tests`), and the setup files the config names. */
const ENTRIES = ['vitest.config.ts', 'scripts/vitest-overlap.mjs'];

// Package and app source is imported by the tests that cover it, so `related` reaches those by import.
const IMPORTED_BY_TESTS = ['packages/**', 'apps/*/src/**', 'apps/shared/**'];

describe('the fleet triggers', () => {
  it('cover every file vitest.config.ts loads that no test reaches by import', () => {
    const uncovered = ENTRIES.flatMap(reached).filter(
      (path) => ![...TRIGGERS, ...IMPORTED_BY_TESTS].some((glob) => matchesGlob(path, glob)),
    );
    expect(uncovered).toEqual([]);
  });

  it('cover nothing vitest does not load', () => {
    const loaded = new Set(ENTRIES.flatMap(reached));
    const tracked = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
    const unloaded = tracked.filter((path) => !isTestFile(path) && !loaded.has(path) && LOADED.some((glob) => matchesGlob(path, glob)));
    expect(unloaded).toEqual([]);
  });

  it('leave a dev-server-only plugin and a test file to the tests that import them', () => {
    const run = (path: string) => runsEverything([path], { triggers: TRIGGERS, scoped: SCOPED });
    expect(run('scripts/vite-site-proxy.ts')).toBe(false);
    expect(run('apps/draw/vite-plugin-trait-schemas/extract.test.ts')).toBe(false);
    expect(run('scripts/vite-css-modules.ts')).toBe(false);
    expect(run('apps/draw/vite-plugin-trait-schemas/extract.ts')).toBe(true);
    expect(run('scripts/vitest-overlap.mjs')).toBe(true);
    expect(run('vitest.setup.ts')).toBe(true);
    expect(run('package.json')).toBe(true);
    expect(run('apps/draw/package.json')).toBe(false);
  });

  it('keep each scoped trigger inside one workspace or app', () => {
    for (const glob of SCOPED) expect(glob).toMatch(/^(\{packages,apps\}|packages|apps)\/\*\//);
  });
});
