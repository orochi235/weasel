#!/usr/bin/env node

// labkit consumer-bundle smoke test.
//
// labkit's entire premise is a SELF-CONTAINED `dist`: tsup bundles every
// transitively-used `@weasel-js/*` package into the output (`noExternal:
// [/^@weasel-js\//]` in tsup.config.ts) and the dts pipeline inlines their types
// (scripts/build-dts.mts). A downstream consumer therefore installs only the
// third-party deps (react*, zustand, earcut, …) — never any `@weasel-js`
// runtime/type package. This guards that promise.
//
// Two independent checks, because they catch different regressions:
//
//   1. Bundle resolves. Relocate the built `dist` OUTSIDE the repo into a temp
//      `node_modules/@weasel-js/labkit`, then esbuild-bundle a consumer that
//      imports every package entry. Outside the monorepo, neither the repo
//      tsconfig `paths` nor the workspace-linked sub-packages are discoverable —
//      exactly a third party's situation. If a `@weasel-js/*` specifier leaked
//      into the emitted JS, esbuild fails to resolve it and this exits non-zero.
//      (Mirrors the core's scripts/smoke-consumer-bundle.mjs.)
//
//   2. No `@weasel-js` specifier survives in dist — in `.js` OR `.d.ts`. The
//      bundle check (1) only exercises runtime JS; labkit also promises
//      self-contained TYPES, so we statically grep every dist file for a leaked
//      import/export/require/import() targeting `@weasel-js`. This is the
//      automation of the manual "grep for leaked imports" done during absorption.
//
// Genuine third-party deps/peers are marked external (a real consumer installs
// them); we only care that no path-alias / bare-workspace specifier leaks.

import { access, cp, mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = join(pkgRoot, 'dist');
const distEntry = join(distDir, 'index.js');

const pkg = JSON.parse(await readFile(join(pkgRoot, 'package.json'), 'utf8'));

try {
  await access(distEntry);
} catch {
  console.error(
    `[smoke] ${distEntry} not found — run \`npm run build -w @weasel-js/labkit\` before the smoke test.`,
  );
  process.exit(1);
}

// --- Check 2: no leaked @weasel-js specifier in any dist file (js + d.ts) ---
// Matches `from '@weasel-js/…'`, `require('@weasel-js/…')`, `import('@weasel-js/…')`.
const LEAK_RE = /(?:from|require\(|import\()\s*['"]@weasel-js\/[^'"]+['"]/;
async function walk(dir) {
  const out = [];
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) out.push(...(await walk(full)));
    else if (/\.(js|d\.ts)$/.test(ent.name)) out.push(full);
  }
  return out;
}
const leaks = [];
for (const file of await walk(distDir)) {
  const text = await readFile(file, 'utf8');
  text.split('\n').forEach((line, i) => {
    if (LEAK_RE.test(line))
      leaks.push(`${file.slice(pkgRoot.length + 1)}:${i + 1}: ${line.trim()}`);
  });
}
if (leaks.length) {
  console.error('[smoke] dist leaks @weasel-js specifiers (dist is NOT self-contained):\n');
  console.error(leaks.join('\n'));
  console.error(
    '\n[smoke] Check `noExternal` in tsup.config.ts and the alias table in scripts/build-dts.mts.',
  );
  process.exit(1);
}

// --- Check 1: consumer bundle resolves with dist relocated outside the repo ---
// Every package entry whose target is JS (skip the *.css exports).
const jsEntries = Object.entries(pkg.exports)
  .map(([subpath, target]) => {
    const file = typeof target === 'string' ? target : target.import;
    return file && file.endsWith('.js') ? subpath : null;
  })
  .filter(Boolean);

const workDir = await mkdtemp(join(tmpdir(), 'labkit-smoke-'));
const installedDir = join(workDir, 'node_modules', '@weasel-js', 'labkit');
await mkdir(installedDir, { recursive: true });
await cp(distDir, join(installedDir, 'dist'), { recursive: true });
await writeFile(
  join(installedDir, 'package.json'),
  JSON.stringify(
    { name: '@weasel-js/labkit', version: '0.0.0-smoke', type: 'module', exports: pkg.exports },
    null,
    2,
  ),
);

const consumerEntry = join(workDir, 'consumer.mjs');
await writeFile(
  consumerEntry,
  jsEntries
    .map(
      (sub, i) => `import * as e${i} from '@weasel-js/labkit${sub === '.' ? '' : sub.slice(1)}';`,
    )
    .join('\n') +
    `\n const all = [${jsEntries.map((_, i) => `e${i}`).join(', ')}];\n` +
    `if (all.some((m) => !m || typeof m !== 'object')) throw new Error('empty namespace');\n`,
);

try {
  await build({
    entryPoints: [consumerEntry],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    absWorkingDir: workDir,
    logLevel: 'silent',
    // A real consumer installs labkit's deps/peers; they are irrelevant here.
    external: [
      'react',
      'react/*',
      'react-dom',
      'react-dom/*',
      'react-aria-components',
      'earcut',
      'polygon-clipping',
      'zustand',
      'zustand/*',
    ],
  });
} catch (err) {
  console.error('[smoke] consumer bundle FAILED — dist emits unresolved specifiers:\n');
  console.error(err.message ?? err);
  console.error(
    '\n[smoke] A @weasel-js/* package likely leaked into dist as a bare import.\n' +
      'Check `noExternal` in tsup.config.ts.',
  );
  process.exit(1);
}

console.log(
  `[smoke] OK — ${jsEntries.length} labkit entries bundle self-contained; no @weasel-js specifiers in dist (js+dts).`,
);
