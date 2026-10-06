import { globSync, readFileSync, statSync } from 'node:fs';
import { basename, matchesGlob, relative, resolve, sep } from 'node:path';
import type { Logger, Plugin, ViteDevServer } from 'vite';
import type { IndexEntry } from '../story/types.ts';
import { hoistPages, writePages } from './build.ts';
import { autoTitle } from './autoTitle.ts';
import { createDepGraph, type DepGraphBuilder, type ResolveImport } from './depGraph.ts';
import { html } from './html.ts';
import { foreignCallees, indexFile } from './indexFile.ts';
import { ownEntries } from './ownEntries.ts';
import { storybookShims } from './storybookShims.ts';
import { createWrapperResolver, type WrapperResolution } from './wrappers.ts';

/** Options for the `forge` vite plugin. */
export interface ForgeOptions {
  /** Globs of story files, relative to the vite root. */
  stories: string[];
  /** Path to the frame config module, relative to the vite root. Only frame documents import it. Optional. */
  frameConfig?: string;
  /** Path to the shell config module, relative to the vite root. Only the workshop page imports it. Optional. */
  shellConfig?: string;
  /** Alias Storybook's runtime modules to forge shims. Default true. */
  storybookShims?: boolean;
}

const PREFIX = 'virtual:forge/';
const MODULES = new Set(['index.js', 'importers.js', 'deps.js', 'frame-config.js', 'shell-config.js', 'shell-entry.js', 'frame-entry.js']);
const PAGES: Record<string, string> = { '/': 'shell-entry.js', '/index.html': 'shell-entry.js', '/frame.html': 'frame-entry.js' };

/**
 * The vite plugin that serves the workshop: it indexes the story files, serves the workshop at `/` and the frame
 * document at `/frame.html`, pushes a new index to the open page as story files change, and builds both pages.
 */
export function forge(options: ForgeOptions): Plugin[] {
  let root = process.cwd();
  let base = '/';
  let byFile: Map<string, IndexEntry[]> | null = null;
  let logger: Logger | undefined;
  let deps: DepGraphBuilder | null = null;
  /** The graph last served or pushed; null until a page first asks for it, so no edit rebuilds it before then. */
  let depsSent: string | null = null;
  let depsPending: Promise<void> | null = null;
  /** Per story file, which of its foreign callees are forge's `meta`/`story`, and what was read to decide it. */
  const wrappersOf = new Map<string, WrapperResolution>();
  /** The first pass over every story file, run before the index is first served. */
  let settledAll: Promise<void> | null = null;

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
  const read = (file: string) =>
    indexFile(readFileSync(file, 'utf8'), file, autoTitle(file, root, options.stories), wrappersOf.get(file)?.wrappers);
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

  /**
   * Decides, for each of `targets`, which imports reached through another module are forge's `meta`/`story`, and
   * re-reads a file whose answer changed. Without it a meta imported from a project helper reads as no meta at all.
   */
  const settle = async (targets: readonly string[], resolveImport: ResolveImport): Promise<void> => {
    const decide = createWrapperResolver((file) => readFileSync(file, 'utf8'));
    const current = files();
    for (const file of targets) {
      if (!current.has(file)) continue;
      let next: WrapperResolution;
      try {
        next = await decide(file, foreignCallees(readFileSync(file, 'utf8'), file), resolveImport);
      } catch {
        // `read` has already logged a file that fails to parse.
        continue;
      }
      const before = wrappersOf.get(file)?.wrappers ?? new Set();
      wrappersOf.set(file, next);
      if (before.size === next.wrappers.size && [...before].every((name) => next.wrappers.has(name))) continue;
      try {
        current.set(file, read(file));
      } catch (err) {
        logError(err);
      }
    }
  };
  const depGraph = (): DepGraphBuilder => (deps ??= createDepGraph({ root, read: (file) => readFileSync(file, 'utf8') }));

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
// Read from source on first request, so the graph costs nothing until the page is up.
import('virtual:forge/deps.js').then((m) => workshop.setDependencies(m.default));
import.meta.hot?.on('forge:deps', (next) => workshop.setDependencies(next));
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

  const invalidate = (server: ViteDevServer, names: readonly string[]): void => {
    for (const env of Object.values(server.environments)) {
      for (const name of names) {
        const mod = env.moduleGraph.getModuleById(`\0${PREFIX}${name}`);
        if (mod) env.moduleGraph.invalidateModule(mod);
      }
    }
  };

  /** Rebuilds the graph after an edit and pushes it when it changed. Edits landing while one runs share the next. */
  function redeps(server: ViteDevServer): void {
    if (depsSent === null || depsPending) return;
    const resolve: ResolveImport = async (spec, importer) =>
      (await server.environments.client.pluginContainer.resolveId(spec, importer))?.id ?? null;
    depsPending = Promise.resolve()
      .then(async () => {
        const graph = await depGraph().build(index(), resolve);
        const json = JSON.stringify(graph);
        if (json === depsSent) return;
        depsSent = json;
        invalidate(server, ['deps.js']);
        server.ws.send({ type: 'custom', event: 'forge:deps', data: graph });
      })
      .catch(logError)
      .finally(() => {
        depsPending = null;
      });
  }

  /** Re-reads a story file after `event`, and any story file whose meta or stories were resolved through it; true when the index changed. */
  async function reindex(server: ViteDevServer, file: string, event: 'add' | 'change' | 'unlink'): Promise<boolean> {
    const current = files();
    if (event === 'change' && current.has(file)) server.ws.send({ type: 'custom', event: 'forge:story', data: { file } });
    const own = event === 'add' ? matches(file) : current.has(file);
    const through = [...wrappersOf].filter(([story, { reads }]) => story !== file && reads.has(file)).map(([story]) => story);
    if (!own && through.length === 0) return false;

    const before = JSON.stringify(index());
    if (own && event === 'unlink') {
      current.delete(file);
      wrappersOf.delete(file);
    } else if (own) {
      try {
        current.set(file, read(file));
      } catch (err) {
        logError(err);
        if (through.length === 0) return false;
      }
    }
    const resolveImport: ResolveImport = async (spec, importer) =>
      (await server.environments.client.pluginContainer.resolveId(spec, importer))?.id ?? null;
    await settle([...(own && event !== 'unlink' ? [file] : []), ...through], resolveImport);
    const next = index();
    if (JSON.stringify(next) === before) return false;

    invalidate(server, ['index.js', 'importers.js']);
    server.ws.send({ type: 'custom', event: 'forge:index', data: next });
    return true;
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
          ...ownEntries(['shell', 'frame']),
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
        wrappersOf.clear();
        settledAll = null;
        deps = null;
        depsSent = null;
      },
      resolveId(id) {
        return id.startsWith(PREFIX) && MODULES.has(id.slice(PREFIX.length)) ? `\0${id}` : undefined;
      },
      async load(id) {
        if (!id.startsWith(`\0${PREFIX}`)) return undefined;
        const name = id.slice(PREFIX.length + 1);
        if (name === 'index.js') {
          settledAll ??= settle([...files().keys()], async (spec, importer) => (await this.resolve(spec, importer))?.id ?? null);
          await settledAll;
        }
        if (name !== 'deps.js') return modules[name]?.();
        const graph = await depGraph().build(index(), async (spec, importer) => (await this.resolve(spec, importer))?.id ?? null);
        depsSent = JSON.stringify(graph);
        return `export default ${depsSent};\n`;
      },
      configureServer(server) {
        server.watcher.add([...files().keys()]);
        for (const event of ['add', 'change', 'unlink'] as const) {
          server.watcher.on(event, (path) => {
            const file = resolve(path);
            // A new file can answer an import that resolved to nothing before.
            const added = event === 'add' && /\.[cm]?[jt]sx?$/.test(file) && !file.split(sep).includes('node_modules');
            if (added) depGraph().reset();
            const read = added || (event !== 'add' && depGraph().invalidate(file));
            reindex(server, file, event).then((indexed) => {
              if (indexed || read) redeps(server);
            }, logError);
          });
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
