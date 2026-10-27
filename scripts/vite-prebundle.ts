import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, relative, resolve, sep } from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';
import { APP_SOURCES } from './lib/packageEntries.mjs';
import { reachByPath, relativeImportsIn, resolveRelative } from './vite-prebundle-reach.ts';

const SPECIFIER = /(?:from|import)\s*\(?\s*'((?:@weasel-js|@editor)\/[\w./-]+)'/g;
const SOURCE_FILE = /\.(ts|tsx|js|jsx|mjs)$/;
const STORY_FILE = /\.stories\.(ts|tsx)$/;

function sourceFilter(stories: boolean): (file: string) => boolean {
  const skipped = stories ? /\.(test|spec)\./ : /\.(test|spec|stories)\./;
  return (file) => SOURCE_FILE.test(file) && !skipped.test(file) && !file.includes('/node_modules/');
}

/** The workspace specifiers one source file imports, stylesheets left out: the optimizer only takes JS. */
export function specifiersIn(code: string): string[] {
  return [...code.matchAll(SPECIFIER)].map((m) => m[1]!).filter((s) => !/\.(css|less)$/.test(s));
}

function filesUnder(dirs: readonly string[], keep: (file: string) => boolean): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (keep(path)) out.push(path);
    }
  };
  dirs.forEach(walk);
  return out;
}

function specifiersOf(files: Iterable<string>): Set<string> {
  const out = new Set<string>();
  for (const file of files) for (const s of specifiersIn(readFileSync(file, 'utf8'))) out.add(s);
  return out;
}

/** Every workspace specifier the source under `dirs` imports; `stories` reads `*.stories.*` files too. */
export function specifiersUnder(dirs: readonly string[], stories = false): Set<string> {
  return specifiersOf(filesUnder(dirs, sourceFilter(stories)));
}

/**
 * The modules of bundled trees that `served` files load by relative path, directly or through one another. Each is
 * left out of the bundles and served from source, so the served file and the bundle share one copy.
 */
export function sourcedFromBundled(served: Iterable<string>, bundled: readonly string[]): Set<string> {
  const inBundle = (file: string) => under(file, bundled);
  return new Set([...reachByPath(served, inBundle)].filter(inBundle));
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

/**
 * Whether the bundles cached in `cacheDir` were built from anything other than `inputs` and the files they name as
 * they are now. vite's cache key sees neither: a package edited while no server ran is otherwise served stale.
 */
function bundlesStale(cacheDir: string, inputs: readonly string[], files: readonly string[]): boolean {
  const record = join(cacheDir, 'weasel-prebundle.stamp');
  const hash = createHash('sha1').update(inputs.join('\n'));
  for (const file of files) hash.update(`${file}:${statSync(file).mtimeMs}\n`);
  const now = hash.digest('hex');
  if (existsSync(record) && readFileSync(record, 'utf8') === now) return false;
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(record, now);
  return true;
}

/** Leaves `sourced` modules out of the bundles: an import of one stays an import, of the dev server's copy. */
function sourcedExternal(sourced: () => ReadonlySet<string>) {
  return {
    name: 'weasel:prebundle-sourced',
    resolveId(id: string, importer?: string) {
      if (!importer || !id.startsWith('.')) return null;
      const file = resolveRelative(dirname(importer), id);
      return file && sourced().has(file) ? { id: file, external: 'absolute' as const } : null;
    },
  };
}

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

/**
 * `server.restart(true)`, less its leak. Each restart left its environments reachable, and with them its whole module
 * graph: ~30 MB a restart on forge (`scripts/probe-dev-restarts.ts`). vite hands them to the next server, whose
 * closures keep them, and rolldown's resolver holds a handle that is never released on a closure that reaches them.
 * Neither holder can be reached from here, so the outgoing environments are emptied once the new server is up.
 */
export async function restartLeavingNothing(server: ViteDevServer): Promise<void> {
  const outgoing = server.environments as Record<string, object>;
  await server.restart(true);
  if (server.environments === outgoing) return;
  for (const [name, env] of Object.entries(outgoing)) {
    for (const key of Object.keys(env)) delete (env as Record<string, unknown>)[key];
    delete outgoing[name];
  }
}

export interface PrebundleOptions {
  /** Read `*.stories.*` files under `sourceDirs` for specifiers, for a server that loads stories. */
  readonly stories?: boolean;
  /**
   * Trees holding stories that reach their subject through package specifiers. By default each is served from
   * source like `sourceDirs`, keeping HMR for its package. With `WEASEL_DEV_BUNDLE_STORIES=1` only its
   * `*.stories.*` files are served from source and its package is bundled; whatever a story still imports by
   * relative path is left out of the bundles and served from source too.
   */
  readonly storyTrees?: readonly string[];
}

/** The trees served from source and the story trees whose packages are bundled, as `env` asks. */
export function storyServing(
  sourceDirs: readonly string[],
  storyTrees: readonly string[],
  env: Record<string, string | undefined> = process.env,
): { sourceDirs: string[]; storyTrees: string[] } {
  return env.WEASEL_DEV_BUNDLE_STORIES === '1'
    ? { sourceDirs: [...sourceDirs], storyTrees: [...storyTrees] }
    : { sourceDirs: [...sourceDirs, ...storyTrees], storyTrees: [] };
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
export function prebundleWorkspace(repoRoot: string, ownDirs: string[], options: PrebundleOptions = {}): Plugin {
  const off = process.env.WEASEL_DEV_SOURCE === '1';
  const { sourceDirs, storyTrees } = storyServing(ownDirs, options.storyTrees ?? []);
  const read = sourceFilter((options.stories ?? false) || storyTrees.length > 0);
  const ws = readWorkspace(repoRoot);
  const source = sourcePackages(ws, sourceDirs);
  const served = [...sourceDirs, ...[...source].map((name) => ws.dirs.get(name)!)];
  const bundled = bundledDirs(repoRoot, sourceDirs, ws, source);
  const bundles = (specifier: string) => !source.has(packageOf(specifier));
  const isStory = (file: string) => STORY_FILE.test(file) && under(file, storyTrees);
  let listed = new Set<string>();
  let sourced = new Set<string>();
  return {
    name: 'weasel:prebundle-workspace',
    apply: 'serve',
    config(user) {
      if (off) return;
      const servedFiles = [...filesUnder(served, read), ...filesUnder(storyTrees, (file) => STORY_FILE.test(file))];
      sourced = sourcedFromBundled(servedFiles, bundled);
      listed = new Set([...specifiersOf([...servedFiles, ...sourced])].filter(bundles));
      const inBundles = filesUnder(bundled, (file) => read(file) && !isStory(file) && !sourced.has(file)).sort();
      const cacheDir = resolve(user.root ?? process.cwd(), user.cacheDir ?? 'node_modules/.vite');
      const stale = bundlesStale(cacheDir, [...sourced].sort(), inBundles);
      const imported = [...sourced].filter((file) => !isStory(file)).length;
      if (imported) console.info(`prebundle: serving ${imported} module(s) of bundled packages from source, since source imports them by path`);
      return {
        optimizeDeps: {
          // Only ever true: a `false` here would outrank the force a re-bundling restart asks for.
          ...(stale && { force: true }),
          include: [...listed].sort(),
          // Without the extensions the optimizer leaves every .tsx file external, served from source.
          extensions: ['.tsx', '.jsx'],
          rolldownOptions: { plugins: [viteQueriesExternal(), sourcedExternal(() => sourced)] },
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
          void restartLeavingNothing(server);
        }, 200);
      };
      const fromSource = (file: string) => under(file, served) || isStory(file) || sourced.has(file);
      const onFile = (file: string) => {
        if (!read(file)) return;
        if (!fromSource(file)) return under(file, bundled) ? rebundle(relative(repoRoot, file)) : undefined;
        let code: string;
        try { code = readFileSync(file, 'utf8'); } catch { return; }
        const fresh = specifiersIn(code).find((s) => bundles(s) && !listed.has(s));
        if (fresh) return rebundle(`${fresh} is newly imported`);
        const reached = relativeImportsIn(code).map((s) => resolveRelative(dirname(file), s));
        const bundledNow = reached.find((target) => target && under(target, bundled) && !sourced.has(target));
        if (bundledNow) rebundle(`${relative(repoRoot, bundledNow)} is newly imported by path`);
      };
      server.watcher.on('change', onFile);
      server.watcher.on('add', onFile);
      server.watcher.on('unlink', (file) => read(file) && !fromSource(file) && under(file, bundled) && rebundle(relative(repoRoot, file)));
    },
  };
}
