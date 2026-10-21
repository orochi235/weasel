import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import type { Plugin } from 'vite';
import { APP_SOURCES } from './lib/packageEntries.mjs';

const SPECIFIER = /(?:from|import)\s*\(?\s*'((?:@weasel-js|@editor)\/[\w./-]+)'/g;
const SOURCE_FILE = /\.(ts|tsx|js|jsx|mjs)$/;

function sourceFilter(stories: boolean): (file: string) => boolean {
  const skipped = stories ? /\.(test|spec)\./ : /\.(test|spec|stories)\./;
  return (file) => SOURCE_FILE.test(file) && !skipped.test(file) && !file.includes('/node_modules/');
}

/** The workspace specifiers one source file imports, stylesheets left out: the optimizer only takes JS. */
export function specifiersIn(code: string): string[] {
  return [...code.matchAll(SPECIFIER)].map((m) => m[1]!).filter((s) => !/\.(css|less)$/.test(s));
}

/** Every workspace specifier the source under `dirs` imports; `stories` reads `*.stories.*` files too. */
export function specifiersUnder(dirs: readonly string[], stories = false): Set<string> {
  const read = sourceFilter(stories);
  const out = new Set<string>();
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (read(path)) for (const s of specifiersIn(readFileSync(path, 'utf8'))) out.add(s);
    }
  };
  dirs.forEach(walk);
  return out;
}

export interface Workspace {
  /** Package name → its directory under `packages/`. */
  readonly dirs: ReadonlyMap<string, string>;
  /** Package name → the workspace packages it depends on. */
  readonly deps: ReadonlyMap<string, readonly string[]>;
}

function readWorkspace(repoRoot: string): Workspace {
  const dirs = new Map<string, string>();
  const deps = new Map<string, string[]>();
  const packages = resolve(repoRoot, 'packages');
  for (const name of readdirSync(packages)) {
    const manifest = join(packages, name, 'package.json');
    if (!existsSync(manifest)) continue;
    const pkg = JSON.parse(readFileSync(manifest, 'utf8'));
    dirs.set(pkg.name, join(packages, name));
    deps.set(pkg.name, Object.keys({ ...pkg.dependencies, ...pkg.peerDependencies }).filter((d) => d.startsWith('@weasel-js/')));
  }
  return { dirs, deps };
}

/**
 * The packages that have to be served from source: any with a tree in `sourceDirs`, and any that
 * depends on one, since a bundle holding it would carry a second copy of that source.
 */
export function sourcePackages(ws: Workspace, sourceDirs: readonly string[]): Set<string> {
  const seeds = [...ws.dirs].filter(([, dir]) => sourceDirs.some((own) => own === dir || own.startsWith(dir + sep)));
  const source = new Set(seeds.map(([name]) => name));
  const reaches = (name: string, seen = new Set<string>()): boolean => {
    if (source.has(name)) return true;
    if (seen.has(name)) return false;
    seen.add(name);
    return (ws.deps.get(name) ?? []).some((d) => reaches(d, seen));
  };
  for (const name of ws.dirs.keys()) if (reaches(name)) source.add(name);
  return source;
}

/** The package a specifier names: `@weasel-js/ui/components/Icon` → `@weasel-js/ui`. */
const packageOf = (specifier: string) => specifier.split('/').slice(0, 2).join('/');

/** The trees that end up inside the bundles: each bundled package, and each app source not among the app's own. */
export function bundledDirs(repoRoot: string, sourceDirs: readonly string[], ws: Workspace, source: ReadonlySet<string>): string[] {
  const packages = [...ws.dirs].filter(([name]) => !source.has(name)).map(([, dir]) => dir);
  const apps = Object.values(APP_SOURCES).map((dir) => resolve(repoRoot, dir));
  return [...packages, ...apps].filter((dir) => !sourceDirs.some((own) => own.startsWith(dir)));
}

const under = (file: string, dirs: readonly string[]) => dirs.some((dir) => file === dir || file.startsWith(dir + sep));

/** Leaves `./x.json?url` and its kind to the dev server: rolldown reads the query as part of the file name. */
function viteQueriesExternal() {
  return {
    name: 'weasel:prebundle-vite-queries',
    resolveId(id: string, importer?: string) {
      if (!importer || !id.startsWith('.') || !/\?(url|raw|inline|worker|sharedworker)\b/.test(id)) return null;
      return { id: resolve(dirname(importer), id), external: 'absolute' as const };
    },
  };
}

export interface PrebundleOptions {
  /** Read `*.stories.*` files under `sourceDirs` for specifiers, for a server that loads stories. */
  readonly stories?: boolean;
}

/**
 * Pre-bundles the workspace packages an app imports, so a dev page load fetches bundles instead
 * of one request per source file: chart went from 2,009 requests to 135. `sourceDirs` are the
 * trees served from source, scanned for the `@weasel-js/*` and `@editor/*` specifiers they import.
 * Every one has to be listed, or a module the bundles also hold loads a second copy from source,
 * so an edit that adds a specifier re-bundles too. A package with a tree in `sourceDirs` stays
 * source, with every package that depends on it.
 *
 * A saved package file re-bundles and reloads the page, in a few seconds rather than an HMR
 * patch. `WEASEL_DEV_SOURCE=1` serves the packages file by file again, with HMR.
 */
export function prebundleWorkspace(repoRoot: string, sourceDirs: string[], options: PrebundleOptions = {}): Plugin {
  const off = process.env.WEASEL_DEV_SOURCE === '1';
  const read = sourceFilter(options.stories ?? false);
  const ws = readWorkspace(repoRoot);
  const source = sourcePackages(ws, sourceDirs);
  const served = [...sourceDirs, ...[...source].map((name) => ws.dirs.get(name)!)];
  const bundled = bundledDirs(repoRoot, sourceDirs, ws, source);
  const bundles = (specifier: string) => !source.has(packageOf(specifier));
  let listed = new Set<string>();
  return {
    name: 'weasel:prebundle-workspace',
    apply: 'serve',
    config() {
      if (off) return;
      listed = new Set([...specifiersUnder(served, options.stories)].filter(bundles));
      return {
        optimizeDeps: {
          include: [...listed].sort(),
          // Without the extensions the optimizer leaves every .tsx file external, served from source.
          extensions: ['.tsx', '.jsx'],
          rolldownOptions: { plugins: [viteQueriesExternal()] },
        },
      };
    },
    configureServer(server) {
      if (off) return;
      server.watcher.add(bundled);
      let timer: ReturnType<typeof setTimeout> | undefined;
      const rebundle = (why: string) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          server.config.logger.info(`re-bundling workspace packages: ${why}`, { timestamp: true });
          void server.restart(true);
        }, 200);
      };
      const onFile = (file: string) => {
        if (!read(file)) return;
        if (under(file, bundled)) return rebundle(relative(repoRoot, file));
        if (!under(file, served)) return;
        let code: string;
        try { code = readFileSync(file, 'utf8'); } catch { return; }
        const fresh = specifiersIn(code).find((s) => bundles(s) && !listed.has(s));
        if (fresh) rebundle(`${fresh} is newly imported`);
      };
      server.watcher.on('change', onFile);
      server.watcher.on('add', onFile);
      server.watcher.on('unlink', (file) => read(file) && under(file, bundled) && rebundle(relative(repoRoot, file)));
    },
  };
}
