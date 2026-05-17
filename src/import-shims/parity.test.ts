import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Why: the publish gate (`tsup build`) and the demo build (vite via
// `@orochi235/weasel/<x>` aliases to `src/import-shims/<x>.ts`) resolve subpaths
// through different mechanisms. Drift between tsup entries, package.json
// `exports`, and the `src/import-shims/*.ts` shims has silently broken the demo
// build before — guard with an exact set-equality check across all three.

const REPO_ROOT = resolve(__dirname, '..', '..');

// tsup entries — parse the config as text so this test stays runtime-free of
// esbuild/jsdom interop. Each `entry` key appears as `name: 'path',` or
// `'kebab-name': 'path',` in tsup.config.ts.
const tsupSrc = readFileSync(resolve(REPO_ROOT, 'tsup.config.ts'), 'utf8');
const entryBlock = tsupSrc.match(/entry:\s*\{([\s\S]*?)\}/)?.[1] ?? '';
const tsupEntries = new Set(
  [...entryBlock.matchAll(/['"]?([\w-]+)['"]?\s*:/g)]
    .map((m) => m[1])
    .filter((k) => k !== 'index'),
);

// Shim files — `src/import-shims/<name>.ts`.
const shimFiles = new Set(
  readdirSync(resolve(REPO_ROOT, 'src', 'import-shims'))
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && !f.endsWith('.d.ts'))
    .map((f) => f.replace(/\.ts$/, '')),
);

// package.json `exports` — strip leading `./`, drop the root `.` and `./package.json`.
const pkg = JSON.parse(readFileSync(resolve(REPO_ROOT, 'package.json'), 'utf8')) as {
  exports: Record<string, unknown>;
};
const exportKeys = new Set(
  Object.keys(pkg.exports)
    .filter((k) => k !== '.' && k !== './package.json')
    .map((k) => k.replace(/^\.\//, '')),
);

describe('import-shims / tsup / exports parity', () => {
  it('every tsup entry has a matching src/import-shims shim and package.json export', () => {
    expect([...tsupEntries].sort()).toEqual([...shimFiles].sort());
    expect([...tsupEntries].sort()).toEqual([...exportKeys].sort());
  });
});
