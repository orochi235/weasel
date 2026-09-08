#!/usr/bin/env node

// labkit consumer-bundle smoke test.
//
// labkit's `dist` bundles its weasel siblings — with ONE deliberate exception.
// tsup inlines every transitively-used `@weasel-js/*` package (`noExternal` in
// tsup.config.ts) and the dts pipeline inlines their types (scripts/build-dts.mts),
// so a downstream consumer installs only the third-party deps (react*, zustand,
// earcut, …). `@weasel-js/core` is the exception: it is an exact PEER, kept as an
// external specifier, because it owns module-global registries and a second copy
// of them is a blank canvas with no diagnostic. See
// docs/proposals/2026-08-31-singleton-packages-as-peers.md.
//
// So this guards a promise with two halves — everything but core is inlined, and
// core never is:
//
//   1. Bundle resolves. Relocate the built `dist` OUTSIDE the repo into a temp
//      `node_modules/@weasel-js/labkit`, then esbuild-bundle a consumer that
//      imports every package entry, with labkit's declared deps and peers marked
//      external the way a real install satisfies them. Outside the monorepo,
//      neither the repo tsconfig `paths` nor the workspace-linked sub-packages
//      are discoverable — exactly a third party's situation. If a bundled
//      sibling's specifier leaked into the emitted JS, esbuild fails to resolve
//      it and this exits non-zero. (Mirrors the core's
//      scripts/smoke-consumer-bundle.mjs.)
//
//   2. No `@weasel-js` specifier other than core survives in dist — in `.js` OR
//      `.d.ts` — and core's DOES, in both. The bundle check (1) only exercises
//      runtime JS, and it marks core external, so neither half of this is
//      reachable from it: a leaked sibling would resolve inside the smoke tree if
//      it were merely mismarked, and an INLINED core resolves perfectly while
//      shipping the duplicate registries this whole arrangement exists to
//      prevent. Both directions are therefore checked statically here.
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

// --- Check 2: dist externalizes core and nothing else under @weasel-js ---
// Matches `from '@weasel-js/…'`, `require('@weasel-js/…')`, `import('@weasel-js/…')`.
const LEAK_RE = /(?:from|require\(|import\()\s*['"](@weasel-js\/[^'"]+)['"]/;
// The one specifier dist is supposed to carry, bare or subpath.
const CORE_RE = /^@weasel-js\/core(?:\/|$)/;
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
let coreInJs = 0;
let coreInDts = 0;
for (const file of await walk(distDir)) {
  const text = await readFile(file, 'utf8');
  stripComments(text).forEach((line, i) => {
    const m = LEAK_RE.exec(line);
    if (!m) return;
    if (CORE_RE.test(m[1])) {
      if (file.endsWith('.d.ts')) coreInDts += 1;
      else coreInJs += 1;
      return;
    }
    leaks.push(`${file.slice(pkgRoot.length + 1)}:${i + 1}: ${line.trim()}`);
  });
}
if (leaks.length) {
  console.error(
    '[smoke] dist leaks @weasel-js specifiers other than the core peer (these should be inlined):\n',
  );
  console.error(leaks.join('\n'));
  console.error(
    '\n[smoke] Check `noExternal` in tsup.config.ts and the alias table in scripts/build-dts.mts.',
  );
  process.exit(1);
}

// The inverse, and the one that matters more: core INLINED is the silent
// failure. It resolves, it bundles, it renders — against its own second copy of
// the registries. Tracked separately for JS and `.d.ts` because the two
// pipelines externalize independently (tsup.config.ts vs scripts/build-dts.mts),
// and a bundle that duplicates core at runtime while emitting correct-looking
// types is the worst of the states to be in.
if (coreInJs === 0 || coreInDts === 0) {
  console.error(
    '[smoke] dist does not import @weasel-js/core — it was INLINED, so a consumer\n' +
      "holding both labkit and core gets two copies of core's registries (content\n" +
      'handlers, paint kinds, shape painters, markers, programs). Registering into\n' +
      'one and reading the other paints nothing, with no error.\n',
  );
  console.error(
    `  dist JS   : ${coreInJs} external core specifier(s) — check \`noExternal\`/\`external\` in tsup.config.ts\n` +
      `  dist .d.ts: ${coreInDts} external core specifier(s) — check DTS_EXCLUDE/\`external\` in scripts/build-dts.mts`,
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

/**
 * A real consumer installs labkit's declared deps and peers, so they are
 * external here. The weasel siblings in `dependencies` are NOT: they are
 * bundled, and their absence from dist is the thing under test. `@weasel-js/core`
 * is external because it is a peer the consumer installs — check 2 above is what
 * holds it to that.
 *
 * Read off package.json rather than listed: this array was hand-maintained until
 * `windease` was added as a dependency without being added here, and the check
 * failed on a bundle that was correct.
 */
const bundledSiblings = new Set(
  Object.keys(pkg.dependencies ?? {}).filter((dep) => dep.startsWith('@weasel-js/')),
);
const thirdPartyExternals = Object.keys({
  ...pkg.dependencies,
  ...pkg.peerDependencies,
})
  .filter((dep) => dep !== 'weasel-js' && !bundledSiblings.has(dep))
  .flatMap((dep) => [dep, `${dep}/*`]);

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
    external: thirdPartyExternals,
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
  `[smoke] OK — ${jsEntries.length} labkit entries bundle against the core peer alone; ` +
    'no other @weasel-js specifiers in dist (js+dts); core stays external ' +
    `(${coreInJs} js, ${coreInDts} dts); every CSS module's stylesheet shipped.`,
);
