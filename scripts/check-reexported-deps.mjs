#!/usr/bin/env node
/**
 * Fails when a package depends on a sibling for nothing but names that sibling re-exports from
 * another. prefs re-exports prefs-schema's declarations so an app needs one import; a package that
 * only declares settings depends on prefs-schema and never pulls in the store, its storage and React.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SOURCE, reexportedNames, writtenNames } from './lib/imports.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGES = join(ROOT, 'packages');

/**
 * Each dependency of a package that it could take from where the names come instead.
 * `uses` maps a sibling's name to every name the package writes against it (`*` for one that
 * reaches the whole module), its subpaths keyed apart. `reexports` maps a sibling to the names its
 * main entry re-exports, by the package each comes from.
 */
export function narrowerDeps(uses, reexports) {
  const out = [];
  for (const [dep, names] of uses) {
    const from = reexports.get(dep);
    if (!from || names.size === 0) continue;
    if ([...uses.keys()].some((spec) => spec.startsWith(`${dep}/`))) continue;
    const sources = new Set();
    let all = true;
    for (const name of names) {
      const owner = [...from].find(([, set]) => set.has(name))?.[0];
      if (owner === undefined) { all = false; break; }
      sources.add(owner);
    }
    if (all) out.push({ dep, instead: [...sources].sort() });
  }
  return out;
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name !== 'node_modules' && name !== 'dist') walk(path, out);
    } else if (SOURCE.test(name)) out.push(path);
  }
  return out;
}

function main() {
  const manifests = new Map();
  for (const name of readdirSync(PACKAGES)) {
    const path = join(PACKAGES, name, 'package.json');
    if (existsSync(path)) manifests.set(name, JSON.parse(readFileSync(path, 'utf8')));
  }
  const siblings = new Set([...manifests.values()].map((m) => m.name));
  const reexports = new Map();
  for (const [dir, manifest] of manifests) {
    const entry = join(PACKAGES, dir, 'src', 'index.ts');
    if (!existsSync(entry)) continue;
    const from = reexportedNames(readFileSync(entry, 'utf8'), entry);
    for (const spec of from.keys()) if (!siblings.has(spec)) from.delete(spec);
    if (from.size > 0) reexports.set(manifest.name, from);
  }

  const problems = [];
  for (const [dir, manifest] of [...manifests].sort()) {
    const declared = new Set(['dependencies', 'peerDependencies', 'devDependencies'].flatMap((k) => Object.keys(manifest[k] ?? {})));
    const uses = new Map();
    const src = join(PACKAGES, dir, 'src');
    if (!existsSync(src)) continue;
    for (const file of walk(src)) {
      for (const [spec, names] of writtenNames(readFileSync(file, 'utf8'), file)) {
        if (!spec.startsWith('@weasel-js/')) continue;
        if (!uses.has(spec)) uses.set(spec, new Set());
        for (const n of names) uses.get(spec).add(n);
      }
    }
    for (const { dep, instead } of narrowerDeps(uses, reexports)) {
      if (dep === manifest.name || !declared.has(dep)) continue;
      problems.push(`${manifest.name} imports from ${dep} only what it re-exports from ${instead.join(', ')}: depend on that instead`);
    }
  }
  for (const p of problems) console.error(`[reexported-deps] ${p}`);
  if (problems.length) process.exit(1);
  console.log('[reexported-deps] OK — no package depends on a sibling only for its re-exports.');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
