/**
 * The npm dependencies the `browser` vitest project's tests load, for its `optimizeDeps.include`.
 *
 * Vite keys its dep cache on that list and on the lockfile, so a dependency first imported
 * anywhere a browser test reaches makes vite discard the cache and pre-bundle before a test runs.
 * Without it a warm cache skips the scan, the dependency is met mid-run, and vite reloads the
 * page under the suites.
 */
import { existsSync, globSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { dirname, join, matchesGlob, relative, resolve } from 'node:path';
import { SOURCE, isBare, packageOf, scanImports } from './lib/imports.mjs';
import { workspaceEntries } from './lib/packageEntries.mjs';
import { type ViteAlias, weaselAliases } from './vite-aliases.ts';

const BUILTINS = new Set(builtinModules);
const SKIPPED_DIR = /^(node_modules|dist|__screenshots__)$/;
/** What a specifier may leave off, in the order vite tries them. */
const ENDINGS = ['', '.ts', '.tsx', '.mts', '.mjs', '.js', '/index.ts', '/index.tsx'];
/** A dependency's stylesheet, image, or data file: vite serves it and never pre-bundles it. */
const ASSET = /\.(css|less|scss|sass|svg|png|jpe?g|gif|webp|woff2?|ttf|otf|json|wasm)$/;

const isFile = (path: string) => existsSync(path) && statSync(path).isFile();

/** The source module `path` names, or `undefined` for an asset or a path with nothing behind it. */
function sourceAt(path: string): string | undefined {
  const written = path.replace(/\.js$/, '');
  const found = [path, ...ENDINGS.map((ending) => written + ending)].find(isFile);
  return found && SOURCE.test(found) ? found : undefined;
}

type Scan = ReturnType<typeof scanImports>;
type Parsed = Map<string, { stamp: string; scan: Scan }>;
const PARSED = Symbol.for('weasel.browserDeps.parsed');
/** vitest evaluates its config once per project, each time in a fresh module instance, so the
 *  parses are kept on `globalThis`. Keyed on mtime and size, a watch-mode reload still sees edits. */
const parsed: Parsed = ((globalThis as { [PARSED]?: Parsed })[PARSED] ??= new Map());

function importsOf(file: string): Scan {
  const { mtimeMs, size } = statSync(file);
  const stamp = `${mtimeMs}:${size}`;
  const hit = parsed.get(file);
  if (hit?.stamp === stamp) return hit.scan;
  const scan = scanImports(readFileSync(file, 'utf8'), file);
  parsed.set(file, { stamp, scan });
  return scan;
}

function aliased(specifier: string, aliases: ViteAlias[]): string | undefined {
  for (const { find, replacement } of aliases) {
    if (typeof find !== 'string') {
      if (find.test(specifier)) return specifier.replace(find, replacement);
    } else if (specifier === find || specifier.startsWith(`${find}/`)) {
      return replacement + specifier.slice(find.length);
    }
  }
  return undefined;
}

/**
 * The files an `import.meta.glob` in `file` loads, its patterns read the way vite reads them: relative to the
 * file, from the root when they start with `/`, through an alias otherwise. A `!` pattern excludes.
 */
function globbed(file: string, patterns: string[], repoRoot: string, aliases: ViteAlias[]): string[] {
  const absolute = (pattern: string) =>
    pattern.startsWith('/') ? join(repoRoot, pattern)
    : pattern.startsWith('.') ? join(dirname(file), pattern)
    : aliased(pattern, aliases) ?? pattern;
  const include = patterns.filter((pattern) => !pattern.startsWith('!')).map(absolute);
  const exclude = patterns.filter((pattern) => pattern.startsWith('!')).map((pattern) => absolute(pattern.slice(1)));
  return globSync(include, { exclude: (name) => SKIPPED_DIR.test(name) }).filter(
    (path) => !exclude.some((pattern) => matchesGlob(path, pattern)),
  );
}

/** Where `pkg` is installed for `file`, by node's lookup up the tree; `undefined` when nothing is. */
function installedFor(file: string, pkg: string): string | undefined {
  for (let dir = dirname(file); ; dir = dirname(dir)) {
    const candidate = join(dir, 'node_modules', pkg);
    if (existsSync(join(candidate, 'package.json'))) return realpathSync(candidate);
    if (dirname(dir) === dir) return undefined;
  }
}

/** The name in the nearest `package.json` above `file`. */
function ownerOf(file: string): string | undefined {
  for (let dir = dirname(file); ; dir = dirname(dir)) {
    const manifest = join(dir, 'package.json');
    if (existsSync(manifest)) return (JSON.parse(readFileSync(manifest, 'utf8')) as { name?: string }).name;
    if (dirname(dir) === dir) return undefined;
  }
}

export interface BrowserDepsOptions {
  /** Globs of the test files, relative to the root: the project's `include`. */
  entries: string[];
  /** The project's `setupFiles`, relative to the root. */
  setupFiles?: string[];
}

/**
 * Every bare specifier reachable from the entries and setup files, sorted, written `<package> > <specifier>` where
 * an importing package installs a copy other than the root's. A workspace package is
 * followed into its source and never listed; vitest's own modules are left to vitest. Throws on an
 * `import()` or `import.meta.glob` it cannot read, which could reach a dependency it would not list.
 */
export function browserDeps(repoRoot: string, { entries, setupFiles = [] }: BrowserDepsOptions): string[] {
  const aliases = weaselAliases(repoRoot);
  const workspace = new Set(workspaceEntries(repoRoot).map(({ name }) => name));
  const ownedElsewhere = (pkg: string) =>
    workspace.has(pkg) || BUILTINS.has(pkg) || pkg === 'vitest' || pkg.startsWith('@vitest/');

  /** Each specifier's importing packages, by the copy each one resolves it to. */
  const found = new Map<string, Map<string | undefined, Set<string | undefined>>>();
  const record = (specifier: string, file: string) => {
    const copies = found.get(specifier) ?? found.set(specifier, new Map()).get(specifier)!;
    const copy = installedFor(file, packageOf(specifier));
    (copies.get(copy) ?? copies.set(copy, new Set()).get(copy)!).add(ownerOf(file));
  };
  const seen = new Set<string>();
  const queue = [
    // A failed browser test leaves its screenshots in a directory named for the test file.
    ...globSync(entries, { cwd: repoRoot, exclude: (name) => SKIPPED_DIR.test(name) })
      .sort()
      .map((file) => join(repoRoot, file))
      .filter(isFile),
    ...setupFiles.map((file) => resolve(repoRoot, file)),
  ];
  const resolved = new Map<string, string | undefined>();
  const visit = (path: string) => {
    if (!resolved.has(path)) resolved.set(path, sourceAt(path));
    const file = resolved.get(path);
    if (file && !seen.has(file)) {
      seen.add(file);
      queue.push(file);
    }
  };

  for (let file = queue.pop(); file; file = queue.pop()) {
    seen.add(file);
    const { specifiers, globs, unreadable } = importsOf(file);
    if (unreadable.length > 0) {
      throw new Error(
        `browserDeps: ${relative(repoRoot, file)} imports what a scan cannot read, so a browser test could meet a ` +
          `dependency vite has not pre-bundled. Write the specifier or the glob as a literal:\n  ${unreadable.join('\n  ')}`,
      );
    }
    for (const { patterns, modules } of globs) {
      if (modules) for (const path of globbed(file, patterns, repoRoot, aliases)) visit(path);
    }
    for (const specifier of specifiers) {
      // A query (`?raw`, `?url`) hands the module to a vite plugin as text or an address.
      if (specifier.includes('?')) continue;
      const target = aliased(specifier, aliases);
      if (target) visit(target);
      else if (specifier.startsWith('.')) visit(join(dirname(file), specifier));
      else if (isBare(specifier) && !ASSET.test(specifier) && !ownedElsewhere(packageOf(specifier))) record(specifier, file);
    }
  }
  // vite resolves a listed bare id from the root, and hands the copy it pre-bundled to every importer.
  const atRoot = (specifier: string) => installedFor(join(repoRoot, 'package.json'), packageOf(specifier));
  return [...found]
    .flatMap(([specifier, copies]) => {
      if (copies.size === 1 && copies.has(atRoot(specifier))) return [specifier];
      const owners = [...copies.values()].flatMap((names) => [...names]);
      const unnamed = owners.find((owner) => !owner || !workspace.has(owner));
      if (unnamed !== undefined || owners.includes(undefined)) {
        throw new Error(
          `browserDeps: ${specifier} is imported from ${unnamed ?? 'a file outside any package'} as a copy other than ` +
            `the root's, or beside one, and only a workspace package can name its own copy for vite (\`<package> > ${specifier}\`).`,
        );
      }
      return owners.map((owner) => `${owner} > ${specifier}`);
    })
    .sort();
}
