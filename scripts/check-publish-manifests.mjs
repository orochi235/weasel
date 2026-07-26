// Fail the build if a publishable package's `exports`/`main`/`types` map
// advertises a file that `npm pack` would not actually put in the tarball.
//
// Why this exists: `@weasel-js/ui@0.5.0` and `@weasel-js/hud@0.5.0` shipped with
// ZERO .d.ts files while their own `exports` maps pointed at `./dist/index.d.ts`.
// Their build is `vite build && tsc -p tsconfig.build.json`; vite's `emptyOutDir`
// deleted the declarations tsc had emitted on the previous run, but tsc's
// `--incremental` state still recorded them as emitted, so every build after the
// first quietly emitted nothing and exited 0. (Fixed at the source: those two
// tsconfigs now set `"incremental": false`.)
//
// Nothing caught it. `npm run build` was green. The consumer smoke test packs
// both packages, but Phase 3 bundles with esbuild — which strips types and never
// looks for a .d.ts — and Phase 4's typecheck only type-imports from core, geom
// and history. CI was green too, because a cold checkout only ever builds once,
// so CI never reached the second build where the emit starts being skipped.
//
// This check is deliberately dumber and broader than any of those: it asks only
// "does every path this manifest promises exist in the tarball?" It needs no
// knowledge of what a package is for, so it covers packages added later, and it
// catches the whole class — a renamed entry point, a `files` field that forgot a
// directory, a subpath added to `exports` before the build emits it.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Every non-private workspace, i.e. everything `changeset publish` would push. */
function publishableWorkspaces() {
  const { workspaces = [] } = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
  const out = [];
  for (const pattern of workspaces) {
    if (!pattern.endsWith('/*')) throw new Error(`unsupported workspace pattern: ${pattern}`);
    const parent = join(repoRoot, pattern.slice(0, -2));
    for (const entry of readdirSync(parent, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const dir = join(parent, entry.name);
      let manifest;
      try {
        manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
      } catch {
        continue; // not a package (e.g. packages/den is an empty placeholder)
      }
      if (manifest.private === true) continue;
      out.push({ dir, manifest });
    }
  }
  return out.sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));
}

/**
 * Every relative path a manifest promises a consumer can resolve.
 *
 * Wildcard subpaths (`"./*": "./dist/*.js"`) are skipped: they describe a
 * family of paths, so "does this exact file exist" is not a meaningful question
 * for them.
 */
function advertisedPaths(manifest) {
  const found = new Set();
  const add = (value) => {
    if (typeof value !== 'string') return;
    if (!value.startsWith('./') && !value.startsWith('dist/')) return;
    if (value.includes('*')) return;
    found.add(value.replace(/^\.\//, ''));
  };

  for (const field of ['main', 'module', 'types', 'typings', 'style', 'browser', 'unpkg']) {
    add(manifest[field]);
  }
  if (typeof manifest.bin === 'string') add(manifest.bin);
  else if (manifest.bin) for (const v of Object.values(manifest.bin)) add(v);

  // `exports` nests arbitrarily deep: subpaths, then condition objects, and a
  // condition's value may itself be an array of fallbacks.
  const walkExports = (node) => {
    if (node === null || node === undefined) return;
    if (typeof node === 'string') return add(node);
    if (Array.isArray(node)) return node.forEach(walkExports);
    if (typeof node === 'object') return Object.values(node).forEach(walkExports);
  };
  walkExports(manifest.exports);

  return [...found].sort();
}

/** The exact file list `npm publish` would upload, per npm itself. */
function packedFiles(dir) {
  // --ignore-scripts: report the tree as it stands. A `prepack` that rebuilds
  // would mask the very staleness this check is looking for.
  const raw = execFileSync(
    'npm',
    ['pack', '--dry-run', '--json', '--ignore-scripts', '--loglevel=error'],
    { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const [report] = JSON.parse(raw);
  return new Set((report?.files ?? []).map((f) => f.path));
}

const failures = [];
const packages = publishableWorkspaces();

for (const { dir, manifest } of packages) {
  const packed = packedFiles(dir);
  const promised = advertisedPaths(manifest);
  const missing = promised.filter((p) => !packed.has(p));

  // A package whose manifest points at .d.ts files but whose tarball has none
  // is the exact 0.5.0 failure. `missing` already covers it, but calling it out
  // by name turns a list of paths into a diagnosis.
  const promisesTypes = promised.some((p) => p.endsWith('.d.ts'));
  const shipsTypes = [...packed].some((p) => p.endsWith('.d.ts'));

  if (missing.length > 0) {
    failures.push(
      `${manifest.name}\n` +
        missing.map((p) => `    missing from tarball: ${p}`).join('\n') +
        (promisesTypes && !shipsTypes
          ? '\n    → the tarball contains NO .d.ts at all. This package is published\n' +
            '      untyped: consumers get an implicit-any module while its own\n' +
            '      `exports` map claims otherwise. Check that the declaration step\n' +
            "      of its `build` script actually emitted (a bundler's emptyOutDir\n" +
            "      plus tsc's --incremental cache will silently skip it)."
          : ''),
    );
  }
}

if (failures.length > 0) {
  console.error(
    `[manifests] ${failures.length} package(s) advertise files they do not ship:\n\n` +
      failures.map((f) => `  ${f}`).join('\n\n') +
      '\n\nEvery path in `main`/`module`/`types`/`exports` must survive into the\n' +
      'tarball — `npm pack --dry-run` in the package directory shows what does.\n' +
      'Either build the missing artifact or stop advertising it.\n',
  );
  process.exit(1);
}

const total = packages.reduce((n, { manifest }) => n + advertisedPaths(manifest).length, 0);
console.log(
  `[manifests] OK — ${total} advertised path(s) across ${packages.length} publishable ` +
    'package(s) are all present in their tarballs.',
);
