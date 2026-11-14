#!/usr/bin/env node
/**
 * A public declaration that names a type no entry of its package exports
 * hands a consumer a type they cannot write down: they can pass a value of it,
 * but cannot annotate a variable, extend it, or name it in their own API.
 * This reads each package's built `.d.ts` entries and fails on a new one.
 *
 * `typeof` references are not counted: a consumer never names the value
 * behind them. Wildcard subpaths are skipped; their barrels re-export from the root.
 *
 * Types already unnameable are recorded per package in
 * `check-unnameable-types.allow.json`. The list only shrinks: a new name
 * fails, and a recorded name that is now exported or gone fails until
 * `npm run check:unnameable -- --update` drops it. Run after `npm run build`.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
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

/** The `.d.ts` file behind each non-wildcard export of a package. */
function typedEntries(dir, manifest) {
  const entries = [];
  for (const target of Object.values(manifest.exports ?? {})) {
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

function main() {
  const update = process.argv.includes('--update');
  const seeding = update && !existsSync(ALLOW);
  const allow = existsSync(ALLOW) ? JSON.parse(readFileSync(ALLOW, 'utf8')) : {};
  const added = [];
  const stale = [];
  const next = {};
  const packages = publishableWorkspaces();
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
    writeFileSync(ALLOW, `${JSON.stringify(next, null, 2)}\n`);
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

main();
