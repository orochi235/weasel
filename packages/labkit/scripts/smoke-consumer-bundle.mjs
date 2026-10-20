#!/usr/bin/env node

// labkit consumer-bundle smoke test.
//
// labkit's `dist` inlines no weasel sibling. Every `@weasel-js/*` package it uses
// stays an external specifier in the JS (`external` in tsup.config.ts) and in the
// declarations (scripts/build-dts.mts), resolved once at the consumer, because
// several own module state with identity (core's registries, theme's React
// context, quantity's display kinds, ui's providers) and a second copy fails
// silently. See docs/proposals/2026-08-31-singleton-packages-as-peers.md.
//
// So this guards a promise with two halves: dist names no package the manifest
// does not declare, and it inlines none that it does.
//
//   1. Bundle resolves. Relocate the built `dist` OUTSIDE the repo into a temp
//      `node_modules/@weasel-js/labkit`, then esbuild-bundle a consumer that
//      imports every package entry, with labkit's declared deps and peers marked
//      external the way a real install satisfies them. Outside the monorepo,
//      neither the repo tsconfig `paths` nor the workspace-linked sub-packages
//      are discoverable — exactly a third party's situation. An undeclared
//      specifier in the emitted JS fails to resolve and this exits non-zero.
//
//   2. Every `@weasel-js` specifier in dist `.js` and `.d.ts` is a declared
//      dependency's or peer's, and every declared one DOES appear in the JS.
//      The bundle check (1) marks them all external, so the second half is not
//      reachable from it: an INLINED sibling resolves perfectly while shipping
//      the duplicate state this whole arrangement exists to prevent.
//
//   3. Every scoped class name weasel-ui paints with is defined in the shipped
//      stylesheet. labkit's `dist/styles.css` is the one sheet a consumer
//      imports, and weasel-ui's components are styled by CSS modules whose
//      scoped names come out of THAT package's build. Ship the sheet without
//      them — or from a stale build — and the consumer gets a component whose
//      class names match nothing, with no error anywhere.

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

// --- Check 2: dist imports every declared @weasel-js package and no other ---
// Matches `from '@weasel-js/…'`, `require('@weasel-js/…')`, `import('@weasel-js/…')`.
const LEAK_RE = /(?:from|require\(|import\()\s*['"](@weasel-js\/[^'"]+)['"]/;
// Declared and imported for its types alone, so no JS specifier is owed. icons is one because
// weaselIcons' library mode rewrites every icon() call to a literal, leaving icons.gen unimported.
const TYPES_ONLY = new Set(['@weasel-js/animator', '@weasel-js/icons']);
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
 * fails the check when that comment rides into labkit's bundled `.d.ts`.
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

// Read off package.json so a new sibling needs no edit here.
const declaredSiblings = new Set(
  Object.keys({ ...pkg.dependencies, ...pkg.peerDependencies }).filter((dep) =>
    dep.startsWith('@weasel-js/'),
  ),
);
const declaredSiblingOf = (spec) =>
  [...declaredSiblings].find((d) => spec === d || spec.startsWith(`${d}/`));

const leaks = [];
const jsCounts = Object.fromEntries([...declaredSiblings].map((d) => [d, 0]));
for (const file of await walk(distDir)) {
  const text = await readFile(file, 'utf8');
  stripComments(text).forEach((line, i) => {
    const m = LEAK_RE.exec(line);
    if (!m) return;
    const sibling = declaredSiblingOf(m[1]);
    if (!sibling) {
      leaks.push(`${file.slice(pkgRoot.length + 1)}:${i + 1}: ${line.trim()}`);
      return;
    }
    if (file.endsWith('.js')) jsCounts[sibling] += 1;
  });
}
if (leaks.length) {
  console.error(
    '[smoke] dist imports @weasel-js packages that package.json declares as neither a dependency nor a peer:\n',
  );
  console.error(leaks.join('\n'));
  console.error('\n[smoke] Declare each one, or stop importing it.');
  process.exit(1);
}

// The inverse, and the one that matters more: a sibling INLINED is the silent
// failure. It resolves, it bundles, it renders — against its own second copy of
// the state.
const inlined = Object.entries(jsCounts)
  .filter(([dep, count]) => count === 0 && !TYPES_ONLY.has(dep))
  .map(([dep]) => dep);
if (inlined.length) {
  console.error(
    `[smoke] dist JS imports none of: ${inlined.join(', ')}.\n` +
      'Each is declared, so either it was INLINED — and a consumer holding both labkit\n' +
      'and that package gets two copies of its module state, one reading what the other\n' +
      'never wrote — or labkit no longer uses it at runtime.\n\n' +
      'Check `external` in tsup.config.ts; a package now used for its types alone goes in\n' +
      'TYPES_ONLY here, and one not used at all comes out of package.json.',
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

// A real consumer installs labkit's declared deps and peers, so they are external.
const externals = Object.keys({ ...pkg.dependencies, ...pkg.peerDependencies }).flatMap((dep) => [
  dep,
  `${dep}/*`,
]);

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
    external: externals,
  });
} catch (err) {
  console.error('[smoke] consumer bundle FAILED — dist emits unresolved specifiers:\n');
  console.error(err.message ?? err);
  console.error(
    '\n[smoke] dist imports a package labkit does not declare, or a chunk it did not ship.',
  );
  process.exit(1);
}

// --- Check 3: every CSS module weasel-ui paints with is in the shipped stylesheet ---
// CSS-module output, as `_local_hash` — the shape scripts/vite-css-modules.ts mints.
// The hash identifies the source file, so it is what gets asserted: an empty rule
// (`.paletteBtn {}`) is dropped by the minifier and a `@keyframes` name is never
// a selector, but either way its file's OTHER names are in the stylesheet. What
// this catches is a whole module's CSS going missing.
const SCOPED_CLASS_RE = /"(_[A-Za-z][\w-]*_([0-9a-f]{6}))"/g;
const uiDist = join(pkgRoot, '../ui/dist');
try {
  await access(join(uiDist, 'index.js'));
} catch {
  console.error(`[smoke] ${uiDist} not found — run \`npm run build\` from the repo root first.`);
  process.exit(1);
}
const stylesheet = await readFile(join(distDir, 'styles.css'), 'utf8');
const missing = new Map();
for (const file of await walk(uiDist)) {
  if (!file.endsWith('.js')) continue;
  const text = await readFile(file, 'utf8');
  for (const [, cls, moduleHash] of text.matchAll(SCOPED_CLASS_RE)) {
    if (!stylesheet.includes(`_${moduleHash}`)) missing.set(moduleHash, cls);
  }
}
if (missing.size) {
  console.error(
    `[smoke] dist/styles.css carries no rule from ${missing.size} CSS module(s) weasel-ui paints with:\n`,
  );
  console.error([...missing.values()].slice(0, 10).join('\n'));
  console.error(
    "\n[smoke] Either `build:css` (package.json) stopped concatenating that package's\n" +
      'stylesheet, or the sheet was copied from a stale dist of it — rebuild labkit.',
  );
  process.exit(1);
}

console.log(
  `[smoke] OK — ${jsEntries.length} labkit entries bundle against the declared packages alone; ` +
    `dist names no undeclared @weasel-js package and inlines none of the ${declaredSiblings.size} declared; ` +
    "every weasel-ui CSS module's stylesheet shipped.",
);
