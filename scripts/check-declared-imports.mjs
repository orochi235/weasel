/**
 * Every module a published package imports must be one its manifest declares.
 *
 * An undeclared import passes everything inside the monorepo, where hoisting
 * resolves it. Published, a bundling build inlines the module and a per-module
 * build leaves a specifier a clean install cannot resolve. The consumer smoke
 * test cannot see either: it packs every sibling into one tree.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGES = join(ROOT, 'packages');

const SOURCE = /\.(ts|tsx|mts|js|mjs)$/;
const NOT_SHIPPED = /(\.(test|stories|fixture|bench)\.|\.d\.ts$|\/__tests__\/|\/testing\/|\/test\/|\/test-utils\/|test-setup\.)/;
// Helpers only test files import, whose names do not say so. Each must exist.
const TEST_HELPERS = [
  'packages/core/src/interactions/actions/defaults/paintActionTestUtils.ts',
  'packages/core/src/tools/builtin/testUtils.ts',
  'packages/forge/src/shell/labHarness.ts',
  'packages/storage/src/adapterContract.ts',
];
const BUILTINS = new Set(builtinModules);

/** `from '…'`, `import '…'`, `import('…')`, and `require('…')`, on code with comments removed.
 *  A type-only import is erased at build and is not matched. */
const SPECIFIER =
  /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)(['"])([^'"\n]+)\1/g;
const TYPE_ONLY = /\b(?:import|export)\s+type\b[^;'"]*?\bfrom\s*(['"])[^'"\n]+\1/g;

function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/** `@scope/name/sub` → `@scope/name`; `name/sub` → `name`. */
function packageOf(specifier) {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

function isBare(specifier) {
  if (specifier.startsWith('.') || specifier.startsWith('/')) return false;
  if (specifier.startsWith('node:') || specifier.startsWith('virtual:')) return false;
  return /^(@[\w.-]+\/)?[\w.-]+(\/.*)?$/.test(specifier);
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name !== 'node_modules' && name !== 'dist') walk(path, out);
    } else if (SOURCE.test(name)) {
      out.push(path);
    }
  }
  return out;
}

/** Specifiers that resolve into the package's own source: its tsconfig `paths`
 *  keys, and with a `baseUrl`, each directory under it. */
function ownAliases(dir) {
  const file = join(dir, 'tsconfig.json');
  if (!existsSync(file)) return [];
  // Line comments only: a `paths` key such as `core/*` opens a block comment.
  const config = readFileSync(file, 'utf8').replace(/^\s*\/\/.*$/gm, '');
  const aliases = [];
  const paths = /"paths"\s*:\s*\{([\s\S]*?)\}/.exec(config);
  if (paths) {
    for (const m of paths[1].matchAll(/"([^"]+)"\s*:/g)) aliases.push(m[1].replace(/\/?\*$/, ''));
  }
  const baseUrl = /"baseUrl"\s*:\s*"([^"]+)"/.exec(config);
  if (baseUrl) {
    const base = join(dir, baseUrl[1]);
    if (existsSync(base)) {
      for (const name of readdirSync(base)) {
        if (statSync(join(base, name)).isDirectory()) aliases.push(name);
      }
    }
  }
  return aliases;
}

for (const helper of TEST_HELPERS) {
  if (!existsSync(join(ROOT, helper))) {
    console.error(`[declared-imports] ${helper} is listed as a test helper and does not exist.`);
    process.exit(1);
  }
}

const offenders = [];
let checked = 0;

for (const name of readdirSync(PACKAGES).sort()) {
  const dir = join(PACKAGES, name);
  const manifestPath = join(dir, 'package.json');
  if (!existsSync(manifestPath) || !existsSync(join(dir, 'src'))) continue;
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (manifest.private) continue;
  checked += 1;

  const declared = new Set([
    manifest.name,
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
    ...Object.keys(manifest.optionalDependencies ?? {}),
  ]);
  const aliases = ownAliases(dir).filter((alias) => !alias.startsWith('@weasel-js/'));
  const missing = new Map();

  for (const file of walk(join(dir, 'src'))) {
    const rel = relative(ROOT, file);
    if (NOT_SHIPPED.test(rel) || TEST_HELPERS.includes(rel)) continue;
    const text = stripComments(readFileSync(file, 'utf8')).replace(TYPE_ONLY, '');
    for (const match of text.matchAll(SPECIFIER)) {
      const specifier = match[2].replace(/\?.*$/, '');
      if (!isBare(specifier)) continue;
      const pkg = packageOf(specifier);
      if (declared.has(pkg) || BUILTINS.has(pkg)) continue;
      if (aliases.some((alias) => specifier === alias || specifier.startsWith(`${alias}/`))) continue;
      if (!missing.has(pkg)) missing.set(pkg, rel);
    }
  }
  if (missing.size > 0) offenders.push({ name: manifest.name, missing });
}

if (checked === 0) {
  console.error('[declared-imports] found no published package to check.');
  process.exit(1);
}

if (offenders.length > 0) {
  console.error(`\n[declared-imports] BLOCKED: ${offenders.length} package(s) import a module they do not declare.\n`);
  for (const { name, missing } of offenders) {
    console.error(`  ${name}`);
    for (const [pkg, file] of missing) console.error(`      ${pkg}   (first seen in ${file})`);
  }
  console.error('\n  Add each to the package\'s dependencies or peerDependencies.\n');
  process.exit(1);
}

console.log(`[declared-imports] OK — ${checked} published package(s), every import declared.`);
