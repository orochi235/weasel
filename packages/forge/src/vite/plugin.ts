import { resolve, sep } from 'node:path';
import type { EnvironmentModuleNode, Logger, Plugin, ViteDevServer } from 'vite';
import { getOwn } from './ownKeys.ts';
import type { IndexEntry } from '../story/types.ts';
import { hoistPages, writePages } from './build.ts';
import { clientResolver, type ComponentGraphBuilder, type ResolveImport } from './componentGraph.ts';
import { createDepsFeed } from './depsFeed.ts';
import { ownEntries } from './ownEntries.ts';
import { propControls, type TypedocOptions } from './propControls.ts';
import type { PropControlsOptions } from './propTypes.ts';
import type { CaptureEndpoint } from './capture/endpoint.ts';
import { serveIssues } from './issues/endpoint.ts';
import { servePages } from './servePages.ts';
import { readShellFields } from './shellTitle.ts';
import { createStoryIndex } from './storyIndex.ts';
import { storybookShims } from './storybookShims.ts';
import { invalidateVirtual, MODULES, PREFIX, virtualModules } from './virtualModules.ts';
import { titleStandIn } from './componentOf.ts';
import { warnWhenWatchIsSilent } from './watchProbe.ts';
import { watchRecovery } from './watchRecovery.ts';
import { settledWatch } from './watchSettle.ts';

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
  /**
   * Show each component's API on its index page: every prop, and what its `ref` exposes, read from the component's
   * TypeScript types. Needs `typescript` installed. Default true; `propControls`' `skip` narrows it the same way.
   */
  api?: boolean;
  /**
   * TypeDoc's JSON, read as the richer source for each component's API where it documents the component: comments
   * with `{@link}` and `@see` resolved, where a prop or member is inherited from, a method's overloads, and a link to
   * the component's page. A component whose files changed after the JSON was written is read from its types alone,
   * as is every component while there is no JSON. Default `{ json: 'dist/typedoc.json' }`; false reads none.
   */
  typedoc?: TypedocOptions | false;
}

const SCRIPT = /\.[cm]?[jt]sx?$/;

interface SourceWatch {
  files: readonly string[];
  componentGraph: () => ComponentGraphBuilder;
  reindex: (server: ViteDevServer, file: string, event: 'add' | 'change' | 'unlink') => Promise<boolean>;
  redeps: (server: ViteDevServer) => void;
  logError: (err: unknown) => void;
}

/** Watches the story files and everything they import, reindexing a changed story and pushing new deps. */
function watchSources(server: ViteDevServer, { files, componentGraph, reindex, redeps, logError }: SourceWatch): void {
  server.watcher.add([...files]);
  void warnWhenWatchIsSilent(server);
  for (const event of ['add', 'change', 'unlink'] as const) {
    server.watcher.on(event, (path) => {
      const file = resolve(path);
      // A new file can answer an import that resolved to nothing before.
      const added = event === 'add' && SCRIPT.test(file) && !file.split(sep).includes('node_modules');
      if (added) componentGraph().reset();
      const read = added || (event !== 'add' && componentGraph().invalidate(file));
      reindex(server, file, event).then((indexed) => {
        if (indexed || read) redeps(server);
      }, logError);
    });
  }
}

/** The plugins forge serves beside its own, as its options ask. */
function companions(options: ForgeOptions, files: () => Map<string, IndexEntry[]>): Plugin[] {
  const { storybookShims: shims, propControls: controls, api, typedoc } = options;
  const storyFiles = () => [...files().keys()];
  const fallbackOf = (file: string) => {
    const title = files().get(file)?.[0]?.title;
    return title === undefined ? undefined : titleStandIn(title);
  };
  const readings = { controls: controls !== false, api: api !== false };
  const narrowed = typeof controls === 'object' ? controls : undefined;
  return [
    watchRecovery(),
    ...(shims === false ? [] : [storybookShims()]),
    ...(readings.controls || readings.api ? [propControls(storyFiles, fallbackOf, readings, narrowed, typedoc)] : []),
  ];
}

/** The story files an edit to `changed` reaches, climbing the way vite's own update does: through every importer. */
function storiesReaching(changed: readonly EnvironmentModuleNode[], current: ReadonlyMap<string, unknown>): string[] {
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
}

/**
 * The vite plugin that serves the workshop: it indexes the story files, serves the workshop at `/` and the frame
 * document at `/frame.html`, pushes a new index to the open page as story files change, and builds both pages.
 */
export function forge(options: ForgeOptions): Plugin[] {
  let root = process.cwd();
  let base = '/';
  let logger: Logger | undefined;
  const logError = (err: unknown) => logger?.error(`[forge] ${err instanceof Error ? err.message : String(err)}`);
  const stories = createStoryIndex({ stories: options.stories, root: () => root, logger: () => logger, logError });
  const { files, index } = stories;
  const deps = createDepsFeed({ root: () => root, index, logError });

  /** What the shell config's source names under `at`: its title, undefined and so the default when unread. */
  const shellUnder = (at: string) => readShellFields(options.shellConfig ? resolve(at, options.shellConfig) : undefined, logger);

  const modules = virtualModules(options, { index, files, root: () => root, base: () => base });
  let capture: CaptureEndpoint | null = null;

  /** Re-reads a story file after `event` and pushes the index when it changed; true when it did. */
  async function reindex(server: ViteDevServer, file: string, event: 'add' | 'change' | 'unlink'): Promise<boolean> {
    const update = await stories.update(file, event, clientResolver(server));
    if (!update) return false;
    invalidateVirtual(server, ['index.js', 'importers.js']);
    server.ws.send({ type: 'custom', event: 'forge:index', data: update.index });
    // Nothing imports a file that was just added, so vite has no update of its own to hand the open page the importer.
    const importers = server.environments.client.moduleGraph.getModuleById(`\0${PREFIX}importers.js`);
    if (importers && update.importablesChanged) await server.environments.client.reloadModule(importers);
    return true;
  }

  return [
    ...companions(options, files),
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
        if (command !== 'build') return { optimizeDeps, server: { watch: settledWatch(config.server?.watch) } };
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
        stories.reset();
        deps.reset();
      },
      resolveId(id) {
        return id.startsWith(PREFIX) && MODULES.has(id.slice(PREFIX.length)) ? `\0${id}` : undefined;
      },
      async load(id) {
        if (!id.startsWith(`\0${PREFIX}`)) return undefined;
        const name = id.slice(PREFIX.length + 1);
        const resolveImport: ResolveImport = async (spec, importer) => (await this.resolve(spec, importer))?.id ?? null;
        if (name === 'index.js') await stories.settleAll(resolveImport);
        if (name !== 'deps.js') return getOwn(modules, name)?.();
        return deps.module(resolveImport);
      },
      hotUpdate({ modules, server }) {
        if (this.environment.name !== 'client') return;
        capture?.revise();
        for (const file of storiesReaching(modules, files())) server.ws.send({ type: 'custom', event: 'forge:story', data: { file } });
      },
      configureServer(server) {
        watchSources(server, { files: [...files().keys()], componentGraph: deps.componentGraph, reindex, redeps: deps.redeps, logError });
        capture = servePages(server, base, () => shellUnder(root));
        serveIssues(server, base, () => root);
      },
      closeServer: () => capture?.close(),
    },
  ];
}
