import { existsSync, globSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, matchesGlob, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Logger, Plugin, ViteDevServer } from 'vite';
import type { IndexEntry } from '../story/types';
import { hoistPages, writePages } from './build';
import { autoTitle } from './autoTitle';
import { html } from './html';
import { indexFile } from './indexFile';
import { storybookShims } from './storybookShims';

export interface ForgeOptions {
  /** Globs of story files, relative to the vite root. */
  stories: string[];
  /** Path to the frame config module, relative to the vite root. Only frame documents import it. Optional. */
  frameConfig?: string;
  /** Path to the shell config module, relative to the vite root. Only the workshop page imports it. Optional. */
  shellConfig?: string;
  /** Alias Storybook's runtime modules to forge shims (Task 13). Default true. */
  storybookShims?: boolean;
}

const PREFIX = 'virtual:forge/';
const MODULES = new Set(['index.js', 'importers.js', 'frame-config.js', 'shell-config.js', 'shell-entry.js', 'frame-entry.js']);
const PAGES: Record<string, string> = { '/': 'shell-entry.js', '/index.html': 'shell-entry.js', '/frame.html': 'frame-entry.js' };

/** forge's shell and frame entry modules: source beside this file in a checkout, the built entries in an install. */
function ownEntries(): string[] {
  const here = fileURLToPath(import.meta.url);
  for (let dir = dirname(here); dir !== dirname(dir); dir = dirname(dir)) {
    const manifest = join(dir, 'package.json');
    if (!existsSync(manifest) || (JSON.parse(readFileSync(manifest, 'utf8')) as { name?: string }).name !== '@weasel-js/forge') {
      continue;
    }
    const source = !relative(join(dir, 'src'), here).startsWith('..');
    return ['shell', 'frame'].map((realm) => join(dir, source ? `src/${realm}/index.ts` : `dist/${realm}/index.js`));
  }
  return [];
}

export function forge(options: ForgeOptions): Plugin[] {
  let root = process.cwd();
  let base = '/';
  let byFile: Map<string, IndexEntry[]> | null = null;
  let logger: Logger | undefined;

  const glob = (): string[] => {
    const files = options.stories.flatMap((pattern) =>
      globSync(pattern, { cwd: root, exclude: (name) => basename(String(name)) === 'node_modules' })
        .map((f) => resolve(root, f))
        // A failed story run leaves `__screenshots__/<file>.stories.tsx/` directories that match the globs.
        .filter((f) => statSync(f).isFile())
        .sort(),
    );
    return [...new Set(files)];
  };
  const matches = (file: string): boolean => {
    const path = relative(root, file).split(sep).join('/');
    return !path.split('/').includes('node_modules') && options.stories.some((pattern) => matchesGlob(path, pattern));
  };
  const read = (file: string) => indexFile(readFileSync(file, 'utf8'), file, autoTitle(file, root, options.stories));
  const logError = (err: unknown) => logger?.error(`[forge] ${err instanceof Error ? err.message : String(err)}`);
  /** A file that fails to parse stays in the map with no entries, so an edit that fixes it re-indexes it. */
  const files = (): Map<string, IndexEntry[]> => {
    byFile ??= new Map(
      glob().map((file) => {
        try {
          return [file, read(file)];
        } catch (err) {
          logError(err);
          return [file, []];
        }
      }),
    );
    return byFile;
  };
  const index = () => [...files().values()].flat();

  const configModule = (path: string | undefined) =>
    path ? `export { default } from ${JSON.stringify(resolve(root, path))};\n` : 'export default {};\n';

  const modules: Record<string, () => string> = {
    'index.js': () => `export default ${JSON.stringify(index())};\n`,
    'importers.js': () => {
      const lines = [...files()]
        .filter(([, entries]) => entries.length > 0)
        .map(([file]) => `  ${JSON.stringify(file)}: () => import(${JSON.stringify(file)}),`);
      return `export default {\n${lines.join('\n')}\n};\n`;
    },
    'frame-config.js': () => configModule(options.frameConfig),
    'shell-config.js': () => configModule(options.shellConfig),
    'shell-entry.js': () => `import { mountWorkshop } from '@weasel-js/forge/shell';
import '@weasel-js/labkit/styles.css';
import '@weasel-js/forge/shell.css';
import index from 'virtual:forge/index.js';
import importers from 'virtual:forge/importers.js';
import config from 'virtual:forge/shell-config.js';
import setup from 'virtual:forge/frame-config.js';

const workshop = mountWorkshop({
  index,
  importers,
  setup,
  config,
  frameUrl: ${JSON.stringify(`${base}frame.html`)},
  stories: ${JSON.stringify(options.stories)},
});
import.meta.hot?.on('forge:index', (next) => workshop.setIndex(next));
// A story edit reaches here as an update of the importers module, whose fresh import() URLs carry the new
// timestamps; the file it names arrives just before, so the reload waits for the importers that can fetch it.
const stale = new Set();
import.meta.hot?.on('forge:story', ({ file }) => stale.add(file));
import.meta.hot?.accept('virtual:forge/importers.js', (next) => {
  if (!next) return;
  workshop.setImporters(next.default);
  for (const file of stale) workshop.reloadStory(file);
  stale.clear();
});
`,
    'frame-entry.js': () => `import { mountFrame } from '@weasel-js/forge/frame';
import '@weasel-js/forge/frame.css';
import index from 'virtual:forge/index.js';
import importers from 'virtual:forge/importers.js';
import setup from 'virtual:forge/frame-config.js';

mountFrame({ index, importers, setup });
// The importers module is shared with the workshop page, which accepts a story edit in place; a frame document
// showing the old module reloads instead, and without this the edit would dead-end here and reload every page.
import.meta.hot?.accept('virtual:forge/importers.js', () => location.reload());
`,
  };

  function reindex(server: ViteDevServer, file: string, event: 'add' | 'change' | 'unlink'): void {
    const current = files();
    if (event === 'change' && current.has(file)) server.ws.send({ type: 'custom', event: 'forge:story', data: { file } });
    if (event === 'change' && !current.has(file)) return;
    if (event === 'add' && !matches(file)) return;
    if (event === 'unlink' && !current.has(file)) return;

    const before = JSON.stringify(index());
    if (event === 'unlink') {
      current.delete(file);
    } else {
      try {
        current.set(file, read(file));
      } catch (err) {
        logError(err);
        return;
      }
    }
    const next = index();
    if (JSON.stringify(next) === before) return;

    for (const env of Object.values(server.environments)) {
      for (const name of ['index.js', 'importers.js']) {
        const mod = env.moduleGraph.getModuleById(`\0${PREFIX}${name}`);
        if (mod) env.moduleGraph.invalidateModule(mod);
      }
    }
    server.ws.send({ type: 'custom', event: 'forge:index', data: next });
  }

  return [
    ...(options.storybookShims === false ? [] : [storybookShims()]),
    {
      name: 'weaselforge',
      config(config, { command }) {
        const at = resolve(config.root ?? process.cwd());
        // The pages are virtual, so vite's scan finds no entry of its own to crawl for dependencies.
        const entries = [
          ...options.stories,
          ...[options.frameConfig, options.shellConfig].flatMap((path) => (path ? [resolve(at, path)] : [])),
          ...ownEntries(),
        ];
        const optimizeDeps = { entries };
        if (command !== 'build') return { optimizeDeps };
        return { optimizeDeps, build: { rolldownOptions: { input: writePages(at) } } };
      },
      generateBundle: {
        order: 'post',
        handler(_, bundle) {
          hoistPages(bundle, (file) => this.emitFile(file));
        },
      },
      configResolved(config) {
        root = config.root;
        base = config.base;
        logger = config.logger;
        byFile = null;
      },
      resolveId(id) {
        return id.startsWith(PREFIX) && MODULES.has(id.slice(PREFIX.length)) ? `\0${id}` : undefined;
      },
      load(id) {
        if (!id.startsWith(`\0${PREFIX}`)) return undefined;
        return modules[id.slice(PREFIX.length + 1)]?.();
      },
      configureServer(server) {
        server.watcher.add([...files().keys()]);
        for (const event of ['add', 'change', 'unlink'] as const) {
          server.watcher.on(event, (file) => reindex(server, resolve(file), event));
        }
        server.middlewares.use((req, res, next) => {
          const url = req.url ?? '/';
          const path = url.split('?')[0] ?? '/';
          const prefix = base.endsWith('/') ? base.slice(0, -1) : base;
          const page = path === prefix ? '/' : path.startsWith(`${prefix}/`) ? path.slice(prefix.length) : null;
          const entry = req.method === 'GET' && page !== null ? PAGES[page] : undefined;
          if (!entry) return next();
          server.transformIndexHtml(url, html(entry)).then(
            (doc) => {
              res.statusCode = 200;
              res.setHeader('Content-Type', 'text/html');
              res.end(doc);
            },
            (err: unknown) => next(err),
          );
        });
      },
    },
  ];
}
