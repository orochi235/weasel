#!/usr/bin/env node
// Consumer-bundle smoke test.
//
// Reproduces a downstream app (vite/esbuild, no weasel tsconfig) importing the
// published `@weasel-js/core` entry. The in-repo apps/ and the vitest `smoke`
// project can NOT catch this class of bug: they run inside the monorepo and so
// inherit the tsconfig `baseUrl`/`paths` that resolve aliases like
// `core/ops/registry` and `debug/flag`. A real consumer has no such config.
//
// The failure this guards against: tsup externalizes everything in
// `dependencies` by default, so without `noExternal` the built dist/index.js
// emits bare `import ... from '@weasel-js/history'` specifiers pointing
// at raw, un-built sub-package source that in turn imports parent internals via
// baseUrl. A downstream bundler dies resolving those. See tsup.config.ts.
//
// Strategy: copy the *built* dist into a temp `node_modules/@weasel-js/core`
// OUTSIDE the repo tree, then bundle a consumer that imports the bare package
// specifier. Because the package files now physically live outside the repo,
// esbuild's automatic tsconfig discovery and node_modules walk find neither the
// repo `tsconfig` paths nor the workspace-linked sub-packages — exactly a third
// party's situation. Genuine third-party deps (react, earcut, polygon-clipping)
// are marked external; we only care that no path-alias / bare-workspace
// specifier survives into dist. If the fix regresses, esbuild fails to resolve
// the leaked sub-package imports and this exits non-zero.

import { build } from 'esbuild';
import { mkdtemp, writeFile, access, cp, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = join(repoRoot, 'dist');
const distEntry = join(distDir, 'index.js');

try {
  await access(distEntry);
} catch {
  console.error(
    `[smoke] ${distEntry} not found — run \`npm run build\` before the smoke test.`,
  );
  process.exit(1);
}

// Relocate dist outside the monorepo so neither the repo tsconfig nor the
// workspace-linked node_modules are discoverable during resolution.
const workDir = await mkdtemp(join(tmpdir(), 'weasel-smoke-'));
const pkgDir = join(workDir, 'node_modules', '@weasel-js', 'core');
await mkdir(pkgDir, { recursive: true });
await cp(distDir, join(pkgDir, 'dist'), { recursive: true });
await writeFile(
  join(pkgDir, 'package.json'),
  JSON.stringify(
    {
      name: '@weasel-js/core',
      version: '0.0.0-smoke',
      type: 'module',
      exports: { '.': { import: './dist/index.js' } },
    },
    null,
    2,
  ),
);

const consumerEntry = join(workDir, 'consumer.mjs');
await writeFile(
  consumerEntry,
  `import * as weasel from '@weasel-js/core';\n` +
    `if (!weasel || typeof weasel !== 'object') throw new Error('empty namespace');\n`,
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
    // A real consumer installs these; they are irrelevant to the alias bug.
    external: ['react', 'react-dom', 'earcut', 'polygon-clipping'],
  });
} catch (err) {
  console.error('[smoke] consumer bundle FAILED — dist emits unresolved specifiers:\n');
  console.error(err.message ?? err);
  console.error(
    '\n[smoke] This usually means a @weasel-js/* sub-package leaked into dist as a\n' +
      'bare import. Check `noExternal` in tsup.config.ts.',
  );
  process.exit(1);
}

console.log('[smoke] consumer bundle OK — @weasel-js/core resolves with no path-alias errors.');
