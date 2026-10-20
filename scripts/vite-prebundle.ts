import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { Plugin } from 'vite';
import { APP_SOURCES } from './lib/packageEntries.mjs';

const SPECIFIER = /(?:from|import)\s*\(?\s*'((?:@weasel-js|@editor)\/[^']+)'/g;
const SOURCE_FILE = /\.(ts|tsx|js|jsx|mjs)$/;
const NOT_SHIPPED = /\.(test|spec|stories)\./;

function isShippedSource(file: string): boolean {
  return SOURCE_FILE.test(file) && !NOT_SHIPPED.test(file) && !file.includes('/node_modules/');
}

/** The workspace specifiers one source file imports, stylesheets left out: the optimizer only takes JS. */
export function specifiersIn(code: string): string[] {
  return [...code.matchAll(SPECIFIER)].map((m) => m[1]!).filter((s) => !/\.(css|less)$/.test(s));
}

/** Every workspace specifier the shipped source under `dirs` imports. */
export function specifiersUnder(dirs: readonly string[]): Set<string> {
  const out = new Set<string>();
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (isShippedSource(path)) for (const s of specifiersIn(readFileSync(path, 'utf8'))) out.add(s);
    }
  };
  dirs.forEach(walk);
  return out;
}

/** The trees that end up inside the bundles: every package, and each app source not among the app's own. */
export function bundledDirs(repoRoot: string, sourceDirs: readonly string[]): string[] {
  return [resolve(repoRoot, 'packages'), ...Object.values(APP_SOURCES).map((dir) => resolve(repoRoot, dir))]
    .filter((dir) => !sourceDirs.some((own) => own.startsWith(dir)));
}

const under = (file: string, dirs: readonly string[]) => dirs.some((dir) => file.startsWith(dir + '/'));

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
 * Pre-bundles the workspace packages an app imports, so a dev page load fetches bundles instead
 * of one request per source file: chart went from 2,009 requests to 135. `sourceDirs` are the
 * app's own trees, scanned for the `@weasel-js/*` and `@editor/*` specifiers they import. Every
 * one has to be listed, or a module the bundles also hold loads a second copy from source, so an
 * edit that adds a specifier re-bundles too.
 *
 * A saved package file re-bundles and reloads the page, in a couple of seconds rather than an
 * HMR patch. `WEASEL_DEV_SOURCE=1` serves the packages file by file again, with HMR.
 */
export function prebundleWorkspace(repoRoot: string, sourceDirs: string[]): Plugin {
  const off = process.env.WEASEL_DEV_SOURCE === '1';
  const bundled = bundledDirs(repoRoot, sourceDirs);
  let listed = new Set<string>();
  return {
    name: 'weasel:prebundle-workspace',
    apply: 'serve',
    config() {
      if (off) return;
      listed = specifiersUnder(sourceDirs);
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
        if (!isShippedSource(file)) return;
        if (under(file, bundled)) return rebundle(file.slice(repoRoot.length + 1));
        if (!under(file, sourceDirs)) return;
        let code: string;
        try { code = readFileSync(file, 'utf8'); } catch { return; }
        const fresh = specifiersIn(code).find((s) => !listed.has(s));
        if (fresh) rebundle(`${fresh} is newly imported`);
      };
      server.watcher.on('change', onFile);
      server.watcher.on('add', onFile);
      server.watcher.on('unlink', (file) => isShippedSource(file) && under(file, bundled) && rebundle(file.slice(repoRoot.length + 1)));
    },
  };
}
