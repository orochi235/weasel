/**
 * The npm dependencies the `browser` vitest project's tests load, for its `optimizeDeps.include`.
 *
 * Vite keys its dep cache on that list and on the lockfile, so a dependency first imported
 * anywhere a browser test reaches makes vite discard the cache and pre-bundle before a test runs.
 * Without it a warm cache skips the scan, the dependency is met mid-run, and vite reloads the
 * page under the suites.
 */
import { existsSync, globSync, readFileSync, statSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { SOURCE, importSpecifiers, isBare, packageOf } from './lib/imports.mjs';
import { workspaceEntries } from './lib/packageEntries.mjs';
import { type ViteAlias, weaselAliases } from './vite-aliases.ts';

const BUILTINS = new Set(builtinModules);
const SKIPPED_DIR = /^(node_modules|dist)$/;
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

export interface BrowserDepsOptions {
  /** Globs of the test files, relative to the root: the project's `include`. */
  entries: string[];
  /** The project's `setupFiles`, relative to the root. */
  setupFiles?: string[];
}

/**
 * Every bare specifier reachable from the entries and setup files, sorted. A workspace package is
 * followed into its source and never listed; vitest's own modules are left to vitest.
 */
export function browserDeps(repoRoot: string, { entries, setupFiles = [] }: BrowserDepsOptions): string[] {
  const aliases = weaselAliases(repoRoot);
  const workspace = new Set(workspaceEntries(repoRoot).map(({ name }) => name));
  const ownedElsewhere = (pkg: string) =>
    workspace.has(pkg) || BUILTINS.has(pkg) || pkg === 'vitest' || pkg.startsWith('@vitest/');

  const found = new Set<string>();
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
    for (const specifier of importSpecifiers(readFileSync(file, 'utf8'))) {
      // A query (`?raw`, `?url`) hands the module to a vite plugin as text or an address.
      if (specifier.includes('?')) continue;
      const target = aliased(specifier, aliases);
      if (target) visit(target);
      else if (specifier.startsWith('.')) visit(join(dirname(file), specifier));
      else if (isBare(specifier) && !ASSET.test(specifier) && !ownedElsewhere(packageOf(specifier))) found.add(specifier);
    }
  }
  return [...found].sort();
}
