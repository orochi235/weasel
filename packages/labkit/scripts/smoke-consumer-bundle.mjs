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
//   3. Every scoped class name the bundle paints with is defined in the shipped
//      stylesheet. Self-contained JS is not self-contained UI: the passed-through
//      weasel-ui components are styled by CSS modules, whose scoped names come
//      out of THAT package's build. Ship the bundle without its stylesheet — or
//      against a stale one — and the consumer gets a component whose class names
//      match nothing, with no error anywhere. That shipped in 0.1.0.
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
/**
 * Blank out comment spans, line by line, keeping one output line per input
 * line so reported line numbers still point at the file.
 *
 * A leak is a specifier something *resolves* — esbuild, tsc, a consumer's
 * bundler. Prose never is. Without this, a JSDoc example naming a package
 * fails the check: `SvgIngestOptions.unpack` in core documents itself with a
 * fenced ```import { unpackSvgFiles } from '@weasel-js/svg'``` block, exactly
 * as it should, and that comment rides into labkit's bundled `.d.ts`.
 *
 * Deliberately not a parser. The one thing it gets wrong is a `//` inside a
 * string literal, which truncates the rest of that line and could hide a real
 * leak sharing it — but ESM emits imports on their own lines, and check 1
 * catches any JS leak by failing to resolve it.
 */
function stripComments(text) {
  let inBlock = false;
  return text.split('\n').map((line) => {
    let out = '';
    let i = 0;
    while (i < line.length) {
      if (inBlock) {
        const end = line.indexOf('*/', i);
        if (end === -1) break;
        i = end + 2;
        inBlock = false;
        continue;
      }
      const block = line.indexOf('/*', i);
      const lineComment = line.indexOf('//', i);
      if (block !== -1 && (lineComment === -1 || block < lineComment)) {
        out += line.slice(i, block);
        i = block + 2;
        inBlock = true;
        continue;
      }
      if (lineComment !== -1) {
        out += line.slice(i, lineComment);
        break;
      }
      out += line.slice(i);
      break;
    }
    return out;
  });
}

const leaks = [];
for (const file of await walk(distDir)) {
  const text = await readFile(file, 'utf8');
  stripComments(text).forEach((line, i) => {
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
    return file?.endsWith('.js') ? subpath : null;
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

// --- Check 3: every CSS module the bundle paints with shipped its stylesheet ---
// CSS-module output, as `_local_hash_line` — the shape both esbuild and Vite emit.
// The hash identifies the source file, so it is what gets asserted: an empty rule
// (`.paletteBtn {}`) is dropped by the minifier and a `@keyframes` name is never
// a selector, but either way its file's OTHER names are in the stylesheet. What
// this catches is a whole module's CSS going missing, which is the failure that
// shipped: a component styled by names that match nothing anywhere.
const SCOPED_CLASS_RE = /"(_[A-Za-z][\w-]*_([a-z0-9]{4,})_\d+)"/g;
const stylesheet = await readFile(join(distDir, 'styles.css'), 'utf8');
const missing = new Map();
for (const file of await walk(distDir)) {
  if (!file.endsWith('.js')) continue;
  const text = await readFile(file, 'utf8');
  for (const [, cls, moduleHash] of text.matchAll(SCOPED_CLASS_RE)) {
    if (!stylesheet.includes(`_${moduleHash}_`)) missing.set(moduleHash, cls);
  }
}
if (missing.size) {
  console.error(
    `[smoke] dist/styles.css carries no rule from ${missing.size} CSS module(s) the bundle paints with:\n`,
  );
  console.error([...missing.values()].slice(0, 10).join('\n'));
  console.error(
    "\n[smoke] Either `build:css` (package.json) stopped concatenating that package's\n" +
      'stylesheet, or labkit was built against a stale dist of it — build it first.',
  );
  process.exit(1);
}

console.log(
  `[smoke] OK — ${jsEntries.length} labkit entries bundle self-contained; no @weasel-js specifiers in dist (js+dts); every CSS module's stylesheet shipped.`,
);
