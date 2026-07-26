#!/usr/bin/env node
// Consumer smoke test — guards BOTH the JS bundles and the .d.ts types of the
// published @weasel-js packages, from outside the monorepo.
//
// This test used to assert the OPPOSITE of what it asserts now. While the
// sub-packages were inlined into core via tsup `noExternal`, its job was to
// prove that NO bare `@weasel-js/*` specifier survived into `dist` — because
// those packages were raw, un-built source reachable only through the repo's
// shared tsconfig `baseUrl`/`paths`, which no downstream consumer has.
//
// They are now real, independently-built, published packages. Bare
// `@weasel-js/*` specifiers in core's dist are the desired outcome, and the
// failure mode has inverted with them:
//
//   1. An UNDECLARED specifier — core emitting `@weasel-js/foo` without
//      `foo` in its `dependencies` — is unresolvable for a consumer.
//   2. A repo-internal path alias (`core/ops/registry`, `features/…`,
//      `debug/flag`) leaking into dist is still fatal, for the original reason.
//   3. An INLINED sub-package is now a defect, not the fix: a consumer holding
//      both core and, say, @weasel-js/geom would get two copies — the
//      duplicate-module-identity hazard documented in core's tsup.config.ts.
//
// Strategy: `npm pack` every published package (so `files`/`exports` are
// exercised exactly as npm would), extract them into a node_modules tree in a
// temp dir OUTSIDE the repo, then (a) bundle a consumer with esbuild and
// (b) typecheck one with tsc. Because the packages physically live outside the
// repo, neither the repo tsconfig paths nor the workspace symlinks are
// discoverable — exactly a third party's situation.

import { build } from 'esbuild';
import { mkdtemp, writeFile, readFile, mkdir, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Published packages, in dependency order. */
const PACKAGES = ['geom', 'gestures', 'history', 'modes', 'theme', 'core', 'svg', 'd3', 'ui', 'hud', 'weasel-js'];

const fail = (msg, detail) => {
  console.error(`[smoke] ${msg}\n`);
  if (detail) console.error(detail);
  process.exit(1);
};

// ── Phase 1: static audit of core's dist ───────────────────────────────────
// Cheap, and it localizes the two failure classes precisely instead of leaving
// them to surface as a confusing bundler error later.
const corePkg = JSON.parse(
  await readFile(join(repoRoot, 'packages', 'core', 'package.json'), 'utf8'),
);
const declared = new Set(
  Object.keys({ ...corePkg.dependencies, ...corePkg.peerDependencies })
    .filter((d) => d.startsWith('@weasel-js/')),
);

const coreDist = join(repoRoot, 'packages', 'core', 'dist');
let distFiles;
try {
  distFiles = (await readdir(coreDist)).filter((f) => f.endsWith('.js') || f.endsWith('.d.ts'));
} catch {
  fail(`${coreDist} not found — run \`npm run build\` before the smoke test.`);
}

// Only real import/export statements. A bare grep would also match the
// `import { unpackSvgFiles } from '@weasel-js/svg'` sample inside a JSDoc
// block, which is documentation, not a dependency.
const STMT = /^\s*(?:import|export)\b[^;'"]*?from\s*['"]([^'"]+)['"]/gm;
const REPO_ALIASES = /^(core|features|affordances|interactions|tools|canvas|debug)\//;

// JS and .d.ts are tracked SEPARATELY and deliberately. tsup derives the
// declaration bundler's external list from deps+peerDeps, which `noExternal`
// does not override — so a `noExternal` regression inlines the JS while the
// .d.ts still emits clean external specifiers. Merging the two sets hides
// exactly that state: duplicated at runtime, correct-looking types. It is the
// worst failure mode, and an earlier version of this script was blind to it.
const seenJs = new Set();
const seenDts = new Set();
const undeclared = new Set();
const aliasLeaks = new Set();
for (const file of distFiles) {
  const text = await readFile(join(coreDist, file), 'utf8');
  const bucket = file.endsWith('.d.ts') ? seenDts : seenJs;
  for (const [, spec] of text.matchAll(STMT)) {
    if (REPO_ALIASES.test(spec)) aliasLeaks.add(`${spec}  (in ${file})`);
    if (!spec.startsWith('@weasel-js/')) continue;
    bucket.add(spec);
    if (!declared.has(spec)) undeclared.add(`${spec}  (in ${file})`);
  }
}
const seen = new Set([...seenJs, ...seenDts]);

if (aliasLeaks.size) {
  fail(
    'repo-internal path aliases leaked into core dist — a consumer has no baseUrl to resolve them:',
    [...aliasLeaks].join('\n'),
  );
}
if (undeclared.size) {
  fail(
    'core dist imports @weasel-js packages that are NOT in its dependencies:',
    [...undeclared].join('\n') +
      `\n\ndeclared: ${[...declared].join(', ') || '(none)'}`,
  );
}

// The inverted assertion. A dependency core imports at RUNTIME must appear as
// an external specifier in the JS bundle; if it doesn't, it was inlined and
// consumers get duplicate module instances. A type-only dependency legitimately
// appears in the .d.ts alone, so runtime-vs-type-only is read off core's
// source rather than guessed from the output.
const coreSrc = join(repoRoot, 'packages', 'core', 'src');
const srcFiles = [];
const walk = async (dir) => {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) await walk(p);
    else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) srcFiles.push(p);
  }
};
await walk(coreSrc);

const IMPORT_STMT = /^\s*(import|export)\b([\s\S]*?)from\s*['"](@weasel-js\/[^'"]+)['"]/gm;
const runtimeDeps = new Set();
for (const file of srcFiles) {
  const text = await readFile(file, 'utf8');
  for (const [, , clause, spec] of text.matchAll(IMPORT_STMT)) {
    const trimmed = clause.trim();
    // `import type { … }` / `export type { … }` — no runtime binding.
    if (/^type\b/.test(trimmed)) continue;
    // Every named specifier individually marked `type` — also no binding.
    const named = trimmed.match(/^\{([\s\S]*)\}$/);
    if (named && named[1].split(',').every((s) => !s.trim() || /^type\s/.test(s.trim()))) continue;
    runtimeDeps.add(spec.split('/').slice(0, 2).join('/'));
  }
}

const inlined = [...declared].filter((d) => runtimeDeps.has(d) && !seenJs.has(d));
if (inlined.length) {
  fail(
    'core imports these @weasel-js packages at runtime, but its dist JS contains no\n' +
      'external specifier for them — they were INLINED, so a consumer holding both\n' +
      'core and the package gets two copies:',
    inlined.join('\n') +
      '\n\nCheck for a `noExternal` in packages/core/tsup.config.ts. Note the .d.ts can\n' +
      'still look correct in this state: tsup derives the declaration external list\n' +
      'from dependencies, which `noExternal` does not override.',
  );
}
const missingTypes = [...declared].filter((d) => !seen.has(d));
if (missingTypes.length) {
  fail(
    'core declares these @weasel-js dependencies but never references them in dist at all:',
    missingTypes.join('\n') + '\n\nStale entry in packages/core/package.json dependencies?',
  );
}
console.log(
  `[smoke] dist audit OK — core externalizes ${seenJs.size} package(s) at runtime, ` +
    `${seenDts.size} in types; no alias leaks.`,
);

// The `weasel-js` alias must stay a thin re-export of core, never a second
// bundled copy of the kit — two copies means two React hook instances and two
// font registries for anyone holding both names. Checked statically: esbuild
// runs with write:false below and never executes the bundle, so a runtime
// identity assertion would silently never fire.
const aliasDist = join(repoRoot, 'packages', 'weasel-js', 'dist');
try {
  const aliasFiles = (await readdir(aliasDist)).filter((f) => f.endsWith('.js'));
  const fat = [];
  for (const file of aliasFiles) {
    const text = await readFile(join(aliasDist, file), 'utf8');
    const reexports = /from\s*['"]@weasel-js\/core(?:\/[\w-]+)?['"]/.test(text);
    // A re-export shim is a few hundred bytes; an inlined copy is orders more.
    if (!reexports || text.length > 4096) {
      fat.push(`${file}  (${text.length} bytes, re-exports core: ${reexports})`);
    }
  }
  if (fat.length) {
    fail(
      'the weasel-js alias is not a thin re-export of @weasel-js/core — it looks\n' +
        'like it INLINED the kit, which gives anyone holding both names two copies:',
      fat.join('\n'),
    );
  }
  console.log(`[smoke] alias audit OK — weasel-js re-exports core across ${aliasFiles.length} entries.`);
} catch (err) {
  if (err?.code === 'ENOENT') fail(`${aliasDist} not found — run \`npm run build\` first.`);
  throw err;
}

// ── Phase 2: pack + extract into a node_modules tree outside the repo ──────
const workDir = await mkdtemp(join(tmpdir(), 'weasel-smoke-'));
const tarballDir = join(workDir, 'tarballs');
const nodeModules = join(workDir, 'node_modules');
await mkdir(tarballDir, { recursive: true });
await mkdir(nodeModules, { recursive: true });

for (const name of PACKAGES) {
  const pkgDir = join(repoRoot, 'packages', name);
  const out = execFileSync(
    'npm',
    ['pack', '--silent', '--pack-destination', tarballDir],
    { cwd: pkgDir, encoding: 'utf8' },
  );
  const tarball = out.trim().split('\n').pop();
  // Install under the package's REAL name, which is not always
  // `@weasel-js/<dir>` — the `weasel-js` alias is unscoped.
  const realName = JSON.parse(await readFile(join(pkgDir, 'package.json'), 'utf8')).name;
  const dest = join(nodeModules, ...realName.split('/'));
  await mkdir(dest, { recursive: true });
  // --strip-components=1 drops npm's `package/` wrapper directory.
  execFileSync('tar', ['-xzf', join(tarballDir, tarball), '-C', dest, '--strip-components=1']);
}
console.log(`[smoke] packed + extracted ${PACKAGES.length} packages into a clean tree.`);

// ── Phase 3: consumer bundle ───────────────────────────────────────────────
// Imports across the package boundary in both directions: core (which now
// imports geom/gestures/history), a leaf directly, and svg (which imports core).
const consumerEntry = join(workDir, 'consumer.mjs');
await writeFile(
  consumerEntry,
  `import * as weasel from '@weasel-js/core';\n` +
    `import * as geom from '@weasel-js/geom';\n` +
    `import * as booleans from '@weasel-js/geom/booleans';\n` +
    `import * as history from '@weasel-js/history';\n` +
    `import * as svg from '@weasel-js/svg';\n` +
    `import * as theme from '@weasel-js/theme';\n` +
    // Tier C — built with Vite library mode rather than tsup because they ship
    // assets. ui pulls in its bundled stylesheet and hud its data-URI font
    // atlas, so these two lines are what prove the asset pipeline published
    // something a consumer can actually load.
    `import * as ui from '@weasel-js/ui';\n` +
    `import '@weasel-js/ui/style.css';\n` +
    `import * as hud from '@weasel-js/hud';\n` +
    `import '@weasel-js/theme/tokens.css';\n` +
    // The unscoped alias resolves through the same specifiers as core. Note
    // these imports prove RESOLUTION only — esbuild runs with write:false and
    // never executes the bundle, so a runtime `!==` assertion here would be
    // dead code. The no-second-copy property is checked statically below.
    `import * as alias from 'weasel-js';\n` +
    `import { SceneCanvas as AliasCanvas } from 'weasel-js';\n` +
    `import { SceneCanvas as CoreCanvas } from '@weasel-js/core';\n` +
    `import { registerFont as aliasFont } from 'weasel-js/renderer';\n` +
    `import { registerFont as coreFont } from '@weasel-js/core/renderer';\n` +
    `void AliasCanvas; void CoreCanvas; void aliasFont; void coreFont;\n` +
    `const mods = { weasel, geom, booleans, history, svg, theme, ui, hud, alias };\n` +
    `for (const [n, m] of Object.entries(mods)) {\n` +
    `  if (!m || typeof m !== 'object') throw new Error('empty namespace: ' + n);\n` +
    `  if (Object.keys(m).length === 0) throw new Error('no exports: ' + n);\n` +
    `}\n`,
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
    // Required before esbuild will accept a CSS import, even with write:false —
    // it needs somewhere the emitted stylesheet *would* go. Nothing is written.
    outdir: join(workDir, 'out'),
    // A real consumer installs these; they are irrelevant to resolution here.
    // react-aria-components is a genuine `dependencies` entry of @weasel-js/ui
    // and is deliberately NOT bundled into it — see packages/ui/vite.config.ts.
    external: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      'react-aria-components',
      'earcut',
      'polygon-clipping',
    ],
  });
} catch (err) {
  fail(
    'consumer bundle FAILED — a published package emits unresolvable specifiers:',
    (err.message ?? String(err)) +
      '\n\nEvery cross-package import must name a real dependency with a matching\n' +
      '`exports` entry. Check the failing package\'s package.json.',
  );
}
console.log('[smoke] consumer bundle OK — all cross-package specifiers resolve.');

// ── Phase 4: consumer typecheck over the built .d.ts ───────────────────────
// esbuild strips types, so it cannot see a .d.ts whose cross-package type
// imports don't resolve, nor an empty DepSchema. A real tsc pass — bundler
// resolution, no weasel tsconfig — does.
const typeConsumer = join(workDir, 'consumer.ts');
await writeFile(
  typeConsumer,
  // (a) DepSchema must be the populated, merged interface, not the empty base;
  // (b) types re-exported across the package boundary must resolve to their
  //     real declarations in the sibling package, not to `any`/`never`.
  `import type { DepSchema, History, GestureSpec, SelectionApi, Op } from '@weasel-js/core';\n` +
    `import type { Mat3 } from '@weasel-js/geom';\n` +
    `import type { History as HistoryDirect } from '@weasel-js/history';\n` +
    `type _Sel = DepSchema['selection'];\n` +
    `type _View = DepSchema['view'];\n` +
    `type _Scene = DepSchema['scene'];\n` +
    `type _Hist = DepSchema['history'];\n` +
    `type _Ptr = DepSchema['pointer'];\n` +
    `const _k: keyof DepSchema = 'selection';\n` +
    // The re-export and the direct import must be the SAME type. If core
    // inlined a private copy of history's declarations instead of importing
    // them, these two resolve to structurally-separate types and the
    // assignment below fails — the type-level duplicate-identity check.
    `declare const _viaCore: History;\n` +
    `const _viaDirect: HistoryDirect = _viaCore;\n` +
    `type _M = Mat3;\n` +
    `type _G = GestureSpec;\n` +
    `type _S = SelectionApi;\n` +
    `type _O = Op;\n` +
    // Tier C gets its .d.ts from a standalone `tsc --emitDeclarationOnly` pass
    // rather than from the bundler that emits its JS — a second step, able to
    // fail on its own, and it did: ui@0.5.0 and hud@0.5.0 were published with
    // no declarations at all while their `exports` maps advertised some. Phase 3
    // could not see it, because esbuild strips types and resolves the JS fine.
    // These name no export on purpose, so they cannot rot as the API changes:
    // under `strict`, a module with no declarations is TS7016 right here.
    `type _Ui = typeof import('@weasel-js/ui');\n` +
    `type _Hud = typeof import('@weasel-js/hud');\n` +
    `export type { _Sel, _View, _Scene, _Hist, _Ptr, _M, _G, _S, _O, _Ui, _Hud };\n` +
    `export const _key = _k;\n` +
    `export const _h = _viaDirect;\n`,
);
await writeFile(
  join(workDir, 'tsconfig.json'),
  JSON.stringify(
    {
      compilerOptions: {
        strict: true,
        noEmit: true,
        // Mirrors a typical consumer: suppresses errors WITHIN dependency
        // .d.ts files, but NOT in the consumer's own code (the DepSchema field
        // accesses and the cross-package identity assignment above).
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
  fail(
    'consumer TYPECHECK FAILED — published .d.ts files do not resolve against each other:',
    String(err.stdout ?? '') +
      String(err.stderr ?? '') +
      '\n[smoke] Likely causes:\n' +
      '  • a package emits a type import for something missing from its dependencies\n' +
      '  • a subpath `exports` entry has no matching `types` field\n' +
      '  • a package shipped NO .d.ts at all (TS7016 on its import above) — its\n' +
      '    declaration build step silently emitted nothing; see npm run check:manifests\n' +
      '  • DepSchema came back empty (its fields must be a plain `export interface`\n' +
      "    in depSchema.ts, not a `declare module './depRegistry'` augmentation)\n" +
      '  • core inlined a sibling\'s declarations instead of importing them, so the\n' +
      '    re-exported type is no longer identical to the sibling\'s own.',
  );
}
console.log('[smoke] consumer typecheck OK — .d.ts cross-package types resolve and are identical.');
