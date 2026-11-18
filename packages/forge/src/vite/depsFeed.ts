import { readFileSync } from 'node:fs';
import type { ViteDevServer } from 'vite';
import type { ComponentGraph, IndexEntry } from '../story/types.ts';
import { clientResolver, createComponentGraph, type ComponentGraphBuilder, type ResolveImport } from './componentGraph.ts';
import { createHistoryReader, type HistoryReader } from './history.ts';
import { getOwn } from './ownKeys.ts';
import { invalidateVirtual } from './virtualModules.ts';

/** `run` for each call, one at a time: calls made while one runs share a single run after it. */
function coalesced<A>(run: (arg: A) => Promise<void>, onError: (err: unknown) => void): (arg: A) => void {
  let running = false;
  let next: { arg: A } | null = null;
  const start = (arg: A): void => {
    running = true;
    run(arg)
      .catch(onError)
      .finally(() => {
        running = false;
        const queued = next;
        next = null;
        if (queued) start(queued.arg);
      });
  };
  return (arg) => {
    if (running) next = { arg };
    else start(arg);
  };
}

/** What the component graph is built from, each read when it is built. */
export interface DepsFeedOptions {
  root(): string;
  index(): IndexEntry[];
  logError(err: unknown): void;
}

/** The component graph the workshop's `deps.js` serves, and the push that keeps an open page's copy current. */
export interface DepsFeed {
  /** The graph builder, made on first use. */
  componentGraph(): ComponentGraphBuilder;
  /** The `deps.js` module's source, remembered as what the page now holds. */
  module(resolveImport: ResolveImport): Promise<string>;
  /** After an edit, rebuilds the graph and pushes it when it changed, once a page has asked for it. */
  redeps(server: ViteDevServer): void;
  /** Forgets the graph, its history and what was sent, for a new root. */
  reset(): void;
}

/** Builds the component graph, each component with what git says of its source file, and pushes it as it changes. */
export function createDepsFeed({ root, index, logError }: DepsFeedOptions): DepsFeed {
  let deps: ComponentGraphBuilder | null = null;
  let history: HistoryReader | null = null;
  /** The graph last served or pushed; null until a page first asks for it, so no edit rebuilds it before then. */
  let depsSent: string | null = null;

  const componentGraph = (): ComponentGraphBuilder => (deps ??= createComponentGraph({ root: root(), read: (file) => readFileSync(file, 'utf8') }));

  /** The component graph, each component with what git says of its source file. */
  async function graphOf(resolveImport: ResolveImport): Promise<ComponentGraph> {
    const graph = await componentGraph().build(index(), resolveImport);
    const sources = Object.values(graph).flatMap((entry) => (entry.source === null ? [] : [entry.source]));
    const histories = await (history ??= createHistoryReader(root())).read(sources);
    for (const entry of Object.values(graph)) {
      const found = entry.source === null ? undefined : getOwn(histories, entry.source);
      if (found) entry.history = found;
    }
    return graph;
  }

  /** Rebuilds the graph after an edit and pushes it when it changed. Edits landing while one runs share the next. */
  const rebuild = coalesced(async (server: ViteDevServer) => {
    const graph = await graphOf(clientResolver(server));
    const json = JSON.stringify(graph);
    if (json === depsSent) return;
    depsSent = json;
    invalidateVirtual(server, ['deps.js']);
    server.ws.send({ type: 'custom', event: 'forge:deps', data: graph });
  }, logError);

  return {
    componentGraph,
    async module(resolveImport) {
      const graph = await graphOf(resolveImport);
      depsSent = JSON.stringify(graph);
      return `export default ${depsSent};\n`;
    },
    redeps(server) {
      if (depsSent !== null) rebuild(server);
    },
    reset() {
      deps = null;
      history = null;
      depsSent = null;
    },
  };
}
