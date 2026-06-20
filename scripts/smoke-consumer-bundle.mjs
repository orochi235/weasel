#!/usr/bin/env node
// Consumer-bundle smoke test — guards BOTH the JS bundle and the .d.ts types.
//
// Reproduces a downstream app (vite/esbuild + tsc, no weasel tsconfig) importing
// the published `@weasel-js/core` entry. The in-repo apps/ and the vitest `smoke`
// project can NOT catch this class of bug: they run inside the monorepo and so
// inherit the tsconfig `baseUrl`/`paths` that resolve aliases like
// `core/ops/registry` and `debug/flag`. A real consumer has no such config.
//
// Two failure classes are guarded, both rooted in the @weasel-js/* sub-packages
// (history, gestures, modes) being raw, un-built source reached via the repo's
// shared tsconfig aliases — NOT public, independently-buildable packages:
//
//   1. JS bundle: tsup externalizes `dependencies` by default, so without
//      `noExternal` the built dist/index.js emits bare
//      `import ... from '@weasel-js/history'` specifiers pointing at source that
//      in turn imports parent internals via baseUrl. A downstream bundler dies.
//
//   2. .d.ts types: tsup builds its declaration `external` list from
//      deps+peerDeps, so a sub-package listed there is force-externalized in the
//      emitted .d.ts even when the JS is inlined — leaking bare `@weasel-js/*`
//      and `core/ops/*` type imports (consumer TS2307). The fix keeps them OUT
//      of `dependencies` (devDeps) AND tsconfig-`paths`-aliases them so
//      rollup-plugin-dts inlines their declarations. SEPARATELY, a cross-module
//      `declare module './depRegistry'` augmentation does NOT survive .d.ts
//      bundling, which silently empties `DepSchema` — so its fields must live in
//      a plain `export interface`. esbuild strips types and is blind to all of
//      this; only a real `tsc` pass over the built .d.ts catches it.
//
// Strategy: copy the *built* dist into a temp `node_modules/@weasel-js/core`
// OUTSIDE the repo tree, then (a) bundle a consumer that imports the bare
// package specifier with esbuild, and (b) typecheck a consumer that exercises
// `DepSchema` + previously-leaked types with `tsc`. Because the package files
// now physically live outside the repo, neither the repo `tsconfig` paths nor
// the workspace-linked sub-packages are discoverable — exactly a third party's
// situation. If either fix regresses, the matching phase exits non-zero.

import { build } from 'esbuild';
import { mkdtemp, writeFile, access, cp, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

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
      types: './dist/index.d.ts',
      exports: { '.': { import: './dist/index.js', types: './dist/index.d.ts' } },
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

// ── Phase 2: consumer typecheck over the built .d.ts ───────────────────────
// esbuild (phase 1) strips types, so it can't see leaked `@weasel-js/*` /
// `core/ops/*` type imports or an empty `DepSchema`. A real `tsc` pass against
// the relocated dist — with bundler resolution and no weasel tsconfig — does.
const typeConsumer = join(workDir, 'consumer.ts');
await writeFile(
  typeConsumer,
  // Exercises the two regression classes: (a) DepSchema must be the populated,
  // merged interface (not the empty base) — every field below must resolve;
  // (b) types that used to leak from un-inlined sub-packages must resolve.
  `import type { DepSchema, History, GestureSpec, SelectionApi } from '@weasel-js/core';\n` +
    `type _Sel = DepSchema['selection'];\n` +
    `type _View = DepSchema['view'];\n` +
    `type _Scene = DepSchema['scene'];\n` +
    `type _Hist = DepSchema['history'];\n` +
    `type _Ptr = DepSchema['pointer'];\n` +
    `const _k: keyof DepSchema = 'selection';\n` +
    `type _H = History;\n` +
    `type _G = GestureSpec;\n` +
    `type _S = SelectionApi;\n` +
    `export type { _Sel, _View, _Scene, _Hist, _Ptr, _H, _G, _S };\n` +
    `export const _key = _k;\n`,
);
await writeFile(
  join(workDir, 'tsconfig.json'),
  JSON.stringify(
    {
      compilerOptions: {
        strict: true,
        noEmit: true,
        // skipLibCheck mirrors a typical consumer: it suppresses errors WITHIN
        // dependency .d.ts files, but NOT errors in the consumer's own code
        // (the DepSchema field accesses + type refs above).
        skipLibCheck: true,
        module: 'esnext',
        moduleResolution: 'bundler',
        target: 'es2022',
        jsx: 'react-jsx',
        types: [],
      },
      files: ['consumer.ts'],
    },
    null,
    2,
  ),
);

const tscBin = join(repoRoot, 'node_modules', '.bin', 'tsc');
try {
  execFileSync(tscBin, ['-p', 'tsconfig.json'], { cwd: workDir, stdio: 'pipe' });
} catch (err) {
  console.error('[smoke] consumer TYPECHECK FAILED — built .d.ts is not self-contained:\n');
  console.error(String(err.stdout ?? '') + String(err.stderr ?? ''));
  console.error(
    '\n[smoke] Likely causes:\n' +
      '  • a @weasel-js/* sub-package leaked into the .d.ts as a bare import\n' +
      '    (it must be a devDependency AND tsconfig-paths-aliased — see tsup.config.ts)\n' +
      "  • DepSchema came back empty (its fields must be a plain `export interface`\n" +
      "    in depSchema.ts, not a `declare module './depRegistry'` augmentation).",
  );
  process.exit(1);
}

console.log('[smoke] consumer typecheck OK — .d.ts self-contained, DepSchema populated.');
