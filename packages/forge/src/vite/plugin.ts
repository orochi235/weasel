import { globSync, readFileSync, statSync } from 'node:fs';
import { basename, relative, resolve, sep } from 'node:path';
import type { EnvironmentModuleNode, Logger, Plugin, ViteDevServer } from 'vite';
import { byComponent } from '../story/indexPages.ts';
import type { DepGraph, IndexEntry } from '../story/types.ts';
import { hoistPages, writePages } from './build.ts';
import { createDepGraph, type DepGraphBuilder, type ResolveImport } from './depGraph.ts';
import { createHistoryReader, type HistoryReader } from './history.ts';
import { foreignCallees } from './indexFile.ts';
import { indexStory } from './indexStory.ts';
import { ownEntries } from './ownEntries.ts';
import { propControls } from './propControls.ts';
import type { PropControlsOptions } from './propTypes.ts';
import type { CaptureEndpoint } from './capture/endpoint.ts';
import { serveIssues } from './issues/endpoint.ts';
import { servePages } from './servePages.ts';
import { readShellFields } from './shellTitle.ts';
import { storybookShims } from './storybookShims.ts';
import { storyGlobOf } from './storyGlob.ts';
import { MODULES, PREFIX, virtualModules } from './virtualModules.ts';
import { warnWhenWatchIsSilent } from './watchProbe.ts';
import { createWrapperResolver, sameResolution, type WrapperResolution } from './wrappers.ts';

/** Options for the `forge` vite plugin. */
export interface ForgeOptions {
  /** Globs of story files, relative to the vite root. */
  stories: string[];
  /** Path to the frame config module, relative to the vite root. The workshop page and every frame document import it. Optional. */
  frameConfig?: string;
  /** Path to the shell config module, relative to the vite root. Only the workshop page imports it. Optional. */
  shellConfig?: string;
  /** Stylesheets for frame documents alone, relative to the vite root: a page background, a body font. The workshop page never loads them. */
  frameStyles?: string[];
  /** Alias Storybook's runtime modules to forge shims. Default true. */
  storybookShims?: boolean;
  /**
   * Give a CSF story a control for each prop of its meta's `component`, read from the component's TypeScript types;
   * the story's own `args` and `argTypes` refine them. Needs `typescript` installed. Default true; an object narrows
   * which props are read.
   */
  propControls?: boolean | PropControlsOptions;
}

const SCRIPT = /\.[cm]?[jt]sx?$/;

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
    return !path.split('/').includes('node_modules') && storyGlobOf(path, options.stories) !== undefined;
  };
  const read = (file: string) =>
    indexStory(readFileSync(file, 'utf8'), file, { root, stories: options.stories }, wrappersOf.get(file));
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
  const index = () => byComponent([...files().values()].flat());

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
      const before = wrappersOf.get(file);
      wrappersOf.set(file, next);
      if (sameResolution(before, next)) continue;
      try {
        current.set(file, read(file));
      } catch (err) {
        logError(err);
      }
    }
  };
  const depGraph = (): DepGraphBuilder => (deps ??= createDepGraph({ root, read: (file) => readFileSync(file, 'utf8') }));
  let history: HistoryReader | null = null;

  /** The component graph, each component with what git says of its source file. */
  async function graphOf(resolveImport: ResolveImport): Promise<DepGraph> {
    const graph = await depGraph().build(index(), resolveImport);
    const sources = Object.values(graph).flatMap((entry) => (entry.source === null ? [] : [entry.source]));
    const histories = await (history ??= createHistoryReader(root)).read(sources);
    for (const entry of Object.values(graph)) {
      const found = entry.source === null ? undefined : histories[entry.source];
      if (found) entry.history = found;
    }
    return graph;
  }

  /** What the shell config's source names under `at`: its title, undefined and so the default when unread. */
  const shellUnder = (at: string) => readShellFields(options.shellConfig ? resolve(at, options.shellConfig) : undefined);

  const modules = virtualModules(options, { index, files, root: () => root, base: () => base });
  let capture: CaptureEndpoint | null = null;

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
        const graph = await graphOf(resolve);
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

  /** The story files an edit to `changed` reaches, climbing the way vite's own update does: through every importer. */
  const storiesReaching = (changed: readonly EnvironmentModuleNode[]): string[] => {
    const current = files();
    const seen = new Set<EnvironmentModuleNode>();
    const reached = new Set<string>();
    const climb = (mod: EnvironmentModuleNode): void => {
      if (seen.has(mod)) return;
      seen.add(mod);
      if (mod.file && current.has(mod.file)) reached.add(mod.file);
      // A stylesheet takes its own update, so the edit stops there.
      if (mod.isSelfAccepting && !(mod.file && SCRIPT.test(mod.file))) return;
      for (const importer of mod.importers) climb(importer);
    };
    for (const mod of changed) climb(mod);
    return [...reached];
  };

  /** Re-reads a story file after `event`, and any story file whose meta or stories were resolved through it; true when the index changed. */
  async function reindex(server: ViteDevServer, file: string, event: 'add' | 'change' | 'unlink'): Promise<boolean> {
    const current = files();
    const own = event === 'add' ? matches(file) : current.has(file);
    const through = [...wrappersOf]
      .filter(([story, { reads, unresolved }]) => story !== file && (reads.has(file) || (event === 'add' && unresolved)))
      .map(([story]) => story);
    if (!own && through.length === 0) return false;

    const before = JSON.stringify(index());
    const importable = () => JSON.stringify([...current].filter(([, entries]) => entries.length > 0).map(([path]) => path));
    const importableBefore = importable();
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
    // Nothing imports a file that was just added, so vite has no update of its own to hand the open page the importer.
    const importers = server.environments.client.moduleGraph.getModuleById(`\0${PREFIX}importers.js`);
    if (importers && importable() !== importableBefore) await server.environments.client.reloadModule(importers);
    return true;
  }

  return [
    ...(options.storybookShims === false ? [] : [storybookShims()]),
    ...(options.propControls === false ? [] : [propControls(() => [...files().keys()], options.propControls === true ? undefined : options.propControls)]),
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
        return { optimizeDeps, build: { rolldownOptions: { input: writePages(at, shellUnder(at).title) } } };
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
        history = null;
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
        const graph = await graphOf(async (spec, importer) => (await this.resolve(spec, importer))?.id ?? null);
        depsSent = JSON.stringify(graph);
        return `export default ${depsSent};\n`;
      },
      hotUpdate({ modules, server }) {
        if (this.environment.name !== 'client') return;
        capture?.revise();
        for (const file of storiesReaching(modules)) server.ws.send({ type: 'custom', event: 'forge:story', data: { file } });
      },
      configureServer(server) {
        server.watcher.add([...files().keys()]);
        void warnWhenWatchIsSilent(server);
        for (const event of ['add', 'change', 'unlink'] as const) {
          server.watcher.on(event, (path) => {
            const file = resolve(path);
            // A new file can answer an import that resolved to nothing before.
            const added = event === 'add' && SCRIPT.test(file) && !file.split(sep).includes('node_modules');
            if (added) depGraph().reset();
            const read = added || (event !== 'add' && depGraph().invalidate(file));
            reindex(server, file, event).then((indexed) => {
              if (indexed || read) redeps(server);
            }, logError);
          });
        }
        capture = servePages(server, base, () => shellUnder(root));
        serveIssues(server, base, () => root);
      },
      closeServer: () => capture?.close(),
    },
  ];
}
