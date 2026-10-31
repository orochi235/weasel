import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join, parse, resolve } from 'node:path';
import type { IconTable } from '@weasel-js/icons';

const read = (file: string): IconTable => JSON.parse(readFileSync(file, 'utf8')) as IconTable;

/** The table beside a generated icons.gen module. */
export function tableBeside(genFile: string): IconTable | undefined {
  const file = join(dirname(genFile), 'icons.table.json');
  return existsSync(file) ? read(file) : undefined;
}

/** The namespace a generated icons.gen module binds, read from its scopedIcon call. */
export function namespaceIn(genFile: string): string | undefined {
  return /scopedIcon<[^>]*>\(\s*['"]([^'"]+)['"]\s*\)/.exec(readFileSync(genFile, 'utf8'))?.[1];
}

/**
 * The table a package directory declares through its `weaselIcons.table` field, or, for a
 * workspace package not yet built, the source table beside its icons.gen.
 */
export function declaredTable(pkgDir: string): IconTable | undefined {
  const pkgFile = join(pkgDir, 'package.json');
  if (!existsSync(pkgFile)) return undefined;
  const table = (JSON.parse(readFileSync(pkgFile, 'utf8')) as { weaselIcons?: { table?: string } }).weaselIcons?.table;
  if (!table) return undefined;
  if (existsSync(join(pkgDir, table))) return read(join(pkgDir, table));
  return sourceTablesUnder(join(pkgDir, 'src'))[0];
}

// A manifest with no name, such as a `dist/package.json` holding only `type`, does not root a package.
const named = (file: string) => existsSync(file) && typeof (JSON.parse(readFileSync(file, 'utf8')) as { name?: unknown }).name === 'string';

/** Finds the package directory a file belongs to, caching by directory. */
export function packageDirFinder() {
  const cache = new Map<string, string | undefined>();
  const find = (dir: string): string | undefined => {
    if (cache.has(dir)) return cache.get(dir);
    const parent = dirname(dir);
    const out = named(join(dir, 'package.json')) ? dir : parent === dir ? undefined : find(parent);
    cache.set(dir, out);
    return out;
  };
  return (file: string) => find(dirname(file));
}

const GEN = /^icons\.gen\.[cm]?[jt]sx?$/;
const SKIP = new Set(['node_modules', 'dist']);
const OWN_FIXTURES = join(import.meta.dirname, 'fixtures');

/** Every table sitting beside a generated icons.gen anywhere under `dir`, outside `node_modules`, `dist` and this plugin's test fixtures. */
export function sourceTablesUnder(dir: string): IconTable[] {
  const out: IconTable[] = [];
  const walk = (d: string) => {
    const entries = readdirSync(d, { withFileTypes: true });
    if (entries.some((e) => e.isFile() && GEN.test(e.name)) && existsSync(join(d, 'icons.table.json'))) {
      out.push(read(join(d, 'icons.table.json')));
    }
    for (const e of entries) {
      const path = join(d, e.name);
      if (e.isDirectory() && !SKIP.has(e.name) && !e.name.startsWith('.') && path !== OWN_FIXTURES) walk(path);
    }
  };
  if (existsSync(dir)) walk(dir);
  return out;
}

/**
 * The tables a package ships, or, when it is a linked workspace package or its declared table
 * is not built, the source tables under its `src`.
 */
function packageTables(pkg: string): IconTable[] {
  const linked = lstatSync(pkg).isSymbolicLink();
  const sources = () => {
    const real = realpathSync(pkg);
    return sourceTablesUnder(existsSync(join(real, 'src')) ? join(real, 'src') : real);
  };
  // A linked package's code is served from source, so its built table can lag a glyph just added.
  if (linked) {
    const fromSource = sources();
    if (fromSource.length > 0) return fromSource;
  }
  const declared = declaredTable(pkg);
  if (declared) return [declared];
  const declares = existsSync(join(pkg, 'package.json')) && readFileSync(join(pkg, 'package.json'), 'utf8').includes('"weaselIcons"');
  return declares ? sources() : [];
}

/** The package directories a workspace root's `workspaces` field names: plain paths, and `dir/*`. */
export function workspacePackageDirs(rootDir: string): string[] | undefined {
  const file = join(rootDir, 'package.json');
  if (!existsSync(file)) return undefined;
  const field = (JSON.parse(readFileSync(file, 'utf8')) as { workspaces?: string[] | { packages?: string[] } }).workspaces;
  const patterns = Array.isArray(field) ? field : field?.packages;
  if (!patterns) return undefined;
  return patterns.flatMap((pattern) => {
    if (!pattern.endsWith('/*')) return [join(rootDir, pattern)];
    const parent = join(rootDir, pattern.slice(0, -2));
    return existsSync(parent) ? readdirSync(parent).map((d) => join(parent, d)) : [];
  }).filter((d) => existsSync(join(d, 'package.json')));
}

/**
 * Every table the app at `root` can reach without a transform: its own source tables, those of
 * each package in a `node_modules` at `root` or above it, and the source tables of the workspace
 * packages of the nearest workspace root above it. Dev and vitest use this, since vite pre-bundles
 * dependencies with esbuild, skipping the plugin, and a virtual module can load before the modules
 * that would reveal a table are transformed.
 *
 * The walk stops at that workspace root. Past it lies another checkout's `node_modules` (a git
 * worktree nests inside its main checkout), whose packages are not the ones the app is served from.
 */
export function reachableTables(root: string): IconTable[] {
  const out = sourceTablesUnder(root);
  for (let dir = root; ; dir = dirname(dir)) {
    const nm = join(dir, 'node_modules');
    if (existsSync(nm)) {
      const dirs = readdirSync(nm).flatMap((d) =>
        d.startsWith('@') ? readdirSync(join(nm, d)).map((s) => join(nm, d, s)) : d.startsWith('.') ? [] : [join(nm, d)],
      );
      for (const pkg of dirs) if (existsSync(join(pkg, 'package.json'))) out.push(...packageTables(pkg));
    }
    const workspace = workspacePackageDirs(dir);
    if (workspace) {
      for (const pkg of workspace) out.push(...sourceTablesUnder(existsSync(join(pkg, 'src')) ? join(pkg, 'src') : pkg));
      return out;
    }
    if (dir === parse(dir).root) return out;
  }
}

/** The icons.gen source file an import specifier names, relative to its importer. */
export function genFile(specifier: string, importer: string): string | undefined {
  const base = resolve(dirname(importer), specifier);
  return ['.ts', '.js', ''].map((e) => base + e).find((f) => existsSync(f) && /\.[cm]?[jt]sx?$/.test(f));
}
