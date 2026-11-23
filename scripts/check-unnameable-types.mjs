#!/usr/bin/env node
/**
 * A public declaration that names a type no entry of its package exports
 * hands a consumer a type they cannot write down: they can pass a value of it,
 * but cannot annotate a variable, extend it, or name it in their own API.
 * This reads each package's built `.d.ts` entries and fails on a new one.
 *
 * `typeof` references are not counted: a consumer never names the value
 * behind them. Wildcard subpaths are skipped; their barrels re-export from the root.
 * `test-seams`, `internal` and `testing/` subpaths are neither read nor counted as exporting.
 *
 * Types already unnameable are recorded per package in
 * `check-unnameable-types.allow.json`. The list only shrinks: a new name
 * fails, and a recorded name that is now exported or gone fails until
 * `npm run check:unnameable -- --update` drops it. Run after `npm run build`.
 *
 * Paths after the flags check only the packages holding them, and `--build` builds those first (and any sibling
 * they need that has no `dist`), so a branch's own packages are checked without a full build.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve as resolvePath, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { buildGraph } from './build-workspaces.mjs';
import { publishableWorkspaces, repoRoot } from './lib/workspaces.mjs';

const ALLOW = join(repoRoot, 'scripts', 'check-unnameable-types.allow.json');

/** A bundler's `Foo$2` is `Foo` to the reader. */
const bare = (name) => name.replace(/\$\d+$/, '');

const OPTIONS = {
  noEmit: true,
  skipLibCheck: true,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  target: ts.ScriptTarget.ESNext,
  jsx: ts.JsxEmit.ReactJSX,
  types: [],
};

/** A subpath that is not public API: exporting a type there does not make it nameable. */
const NOT_PUBLIC = /^\.\/(test-seams|internal|testing\/)/;

/** The `.d.ts` file behind each non-wildcard public export of a package. */
function typedEntries(dir, manifest) {
  const entries = [];
  for (const [key, target] of Object.entries(manifest.exports ?? {})) {
    if (NOT_PUBLIC.test(key)) continue;
    if (target && typeof target === 'object' && typeof target.types === 'string' && !target.types.includes('*')) {
      entries.push(join(dir, target.types));
    }
  }
  return entries;
}

/** Names of types declared in `dist` that a public declaration references and no entry exports. */
export function unnameableTypes(dir, manifest) {
  const files = typedEntries(dir, manifest).filter((f) => existsSync(f));
  if (files.length === 0) return [];
  const dist = join(dir, 'dist');
  const program = ts.createProgram(files, OPTIONS);
  const checker = program.getTypeChecker();
  const resolve = (s) => (s && s.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(s) : s);

  const exported = new Set();
  const publicDecls = [];
  for (const file of files) {
    const moduleSymbol = checker.getSymbolAtLocation(program.getSourceFile(file));
    if (!moduleSymbol) continue;
    for (const s of checker.getExportsOfModule(moduleSymbol).map(resolve)) {
      exported.add(s);
      for (const decl of s.declarations ?? []) {
        if (decl.getSourceFile().fileName.startsWith(dist)) publicDecls.push(decl);
      }
    }
  }

  const found = new Set();
  const visit = (node) => {
    if (ts.isTypeQueryNode(node)) return;
    if (ts.isTypeReferenceNode(node) || ts.isExpressionWithTypeArguments(node)) {
      const s = resolve(checker.getSymbolAtLocation(ts.isTypeReferenceNode(node) ? node.typeName : node.expression));
      const decl = s?.declarations?.[0];
      if (
        s &&
        decl &&
        !exported.has(s) &&
        !(s.parent && exported.has(s.parent)) &&
        !(s.flags & ts.SymbolFlags.TypeParameter) &&
        decl.getSourceFile().fileName.startsWith(dist)
      ) {
        found.add(bare(s.name));
      }
    }
    ts.forEachChild(node, visit);
  };
  publicDecls.forEach(visit);
  return [...found].sort();
}

/** The workspaces of `all` holding any of `paths` (relative to the repo root): every one when there are none. */
export function packagesHolding(all, paths, root = repoRoot) {
  if (paths.length === 0) return all;
  const rel = paths.map((p) => relative(root, resolvePath(root, p)));
  return all.filter(({ dir }) => {
    const own = relative(root, dir);
    return rel.some((p) => p === own || p.startsWith(own + sep));
  });
}

/**
 * The order to build `names` in, each after the siblings `graph` says it needs; a sibling not in `names` is built too
 * when `built(sibling)` says it has no `dist`.
 */
export function buildOrder(graph, names, built) {
  const order = [];
  const seen = new Set();
  const wanted = new Set(names);
  const visit = (name) => {
    if (seen.has(name) || (!wanted.has(name) && built(name))) return;
    seen.add(name);
    for (const dep of graph.get(name) ?? []) visit(dep);
    order.push(name);
  };
  for (const name of names) visit(name);
  return order;
}

function main() {
  const args = process.argv.slice(2);
  const update = args.includes('--update');
  const paths = args.filter((a) => !a.startsWith('--'));
  const seeding = update && !existsSync(ALLOW);
  const allow = existsSync(ALLOW) ? JSON.parse(readFileSync(ALLOW, 'utf8')) : {};
  const added = [];
  const stale = [];
  const all = publishableWorkspaces();
  const packages = packagesHolding(all, paths);
  if (packages.length === 0) {
    console.log('[unnameable] OK — no published package holds the paths given.');
    return;
  }
  // Packages not checked keep their allowlist entries as they are.
  const checked = new Set(packages.map(({ manifest }) => manifest.name));
  const next = Object.fromEntries(Object.entries(allow).filter(([name]) => !checked.has(name)));
  if (args.includes('--build')) {
    const dirOf = new Map(all.map(({ dir, manifest }) => [manifest.name, dir]));
    const graph = buildGraph(all.map(({ manifest }) => manifest));
    for (const name of buildOrder(graph, [...checked], (n) => existsSync(join(dirOf.get(n), 'dist')))) {
      console.log(`[unnameable] building ${name}`);
      const { status } = spawnSync('npm', ['run', 'build', '-w', name], { cwd: repoRoot, stdio: 'inherit' });
      if (status !== 0) {
        console.error(`\n[unnameable] npm run build -w ${name} failed (exit ${status}).`);
        process.exit(status ?? 1);
      }
    }
  }
  packages.forEach(({ dir, manifest }, i) => {
    const names = unnameableTypes(dir, manifest);
    const allowed = new Set(seeding ? names : (allow[manifest.name] ?? []));
    for (const n of names) if (!allowed.has(n)) added.push(`${manifest.name}: ${n}`);
    for (const n of allowed) if (!names.includes(n)) stale.push(`${manifest.name}: ${n}`);
    const kept = names.filter((n) => allowed.has(n));
    if (kept.length > 0) next[manifest.name] = kept;
    console.log(`[unnameable] ${String(i + 1).padStart(2)}/${packages.length} ${manifest.name} ${names.length}`);
  });

  if (added.length > 0) {
    console.error(
      `\n[unnameable] public declarations name ${added.length} type(s) their package does not export:\n\n` +
        added.map((a) => `  ${a}`).join('\n') +
        '\n\nExport the type from the entry that uses it, or inline it. --update never adds a name.',
    );
    process.exit(1);
  }
  if (update) {
    const sorted = Object.fromEntries(Object.entries(next).sort(([a], [b]) => a.localeCompare(b)));
    writeFileSync(ALLOW, `${JSON.stringify(sorted, null, 2)}\n`);
    console.log(`[unnameable] ${stale.length} name(s) dropped from the allowlist.`);
    return;
  }
  if (stale.length > 0) {
    console.error(
      `\n[unnameable] ${stale.length} allowlisted type(s) are now nameable or gone:\n\n` +
        stale.map((s) => `  ${s}`).join('\n') +
        '\n\nRun `npm run check:unnameable -- --update` to keep the gain.',
    );
    process.exit(1);
  }
  const total = Object.values(next).reduce((n, names) => n + names.length, 0);
  console.log(`[unnameable] OK — no new unnameable types; ${total} allowlisted.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
