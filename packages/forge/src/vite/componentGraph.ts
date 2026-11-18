import { relative, sep } from 'node:path';
import type { ViteDevServer } from 'vite';
import { getOwn, setOwn } from './ownKeys.ts';
import { isGallery } from '../story/tags.ts';
import type { ComponentNode, ComponentGraph, IndexEntry } from '../story/types.ts';
import { type Bindings, createBindings, fileOfKey, type Key, type Resolutions } from './bindings.ts';
import { componentsReachedFrom } from './componentReach.ts';
import { moduleInfo, type ModuleInfo } from './moduleInfo.ts';

/** Resolves an import as the bundler would: an absolute file, or null for anything that is not one. */
export type ResolveImport = (specifier: string, importer: string) => Promise<string | null>;

/** Resolves an import as the dev server's client environment does. */
export const clientResolver =
  (server: ViteDevServer): ResolveImport =>
  async (spec, importer) =>
    (await server.environments.client.pluginContainer.resolveId(spec, importer))?.id ?? null;

export interface ComponentGraphOptions {
  root: string;
  read: (file: string) => string;
}

export interface ComponentGraphBuilder {
  build(entries: readonly IndexEntry[], resolve: ResolveImport): Promise<ComponentGraph>;
  /** Drops what was read from `file`. True when the graph had read it, so the graph may have changed. */
  invalidate(file: string): boolean;
  /** Drops every cached import resolution and every file that could not be read, keeping the parsed files. */
  reset(): void;
}

/** `file` read and parsed; null for one that cannot be read or parsed. */
function readModule(read: ComponentGraphOptions['read'], file: string): ModuleInfo | null {
  try {
    return moduleInfo(read(file), file);
  } catch {
    return null;
  }
}

/** Each title's component, as the binding declaring it; null where none is found. */
async function componentsOf(entries: readonly IndexEntry[], bindings: Bindings): Promise<Map<string, Key | null>> {
  const titles = new Map<string, IndexEntry[]>();
  for (const entry of entries) {
    if (isGallery(entry)) continue;
    const list = titles.get(entry.title);
    if (list) list.push(entry);
    else titles.set(entry.title, [entry]);
  }
  const components = new Map<string, Key | null>();
  for (const [title, list] of titles) {
    let key: Key | null = null;
    for (const file of new Set(list.map((e) => e.file))) {
      key = await bindings.componentOf(list.find((e) => e.file === file) as IndexEntry);
      if (key) break;
    }
    components.set(title, key);
  }
  return components;
}

/**
 * The component graph of `entries`, derived from source: each component is the binding its story file's meta names
 * (or, when that is declared in the story file itself, the import the title's last segment names), found by
 * following imports and re-exports to the file declaring it. What a component uses is every listed component that
 * its own declaration reaches, directly or through the file's local helpers and the relative imports in its own
 * directory. Each file is read and parsed once and each import resolved once, until `invalidate` names it.
 */
export function createComponentGraph({ root, read }: ComponentGraphOptions): ComponentGraphBuilder {
  const modules = new Map<string, ModuleInfo | null>();
  const resolutions: Resolutions = new Map();

  const info = (file: string): ModuleInfo | null => {
    if (!modules.has(file)) modules.set(file, readModule(read, file));
    return modules.get(file) ?? null;
  };

  return {
    invalidate(file) {
      const known = modules.has(file) || resolutions.has(file);
      modules.delete(file);
      resolutions.delete(file);
      return known;
    },

    reset() {
      resolutions.clear();
      for (const [file, parsed] of modules) if (parsed === null) modules.delete(file);
    },

    async build(entries, resolve) {
      const bindings = createBindings(info, resolutions, resolve);
      const components = await componentsOf(entries, bindings);
      const byKey = new Map<Key, string[]>();
      for (const [title, key] of components) if (key) byKey.set(key, [...(byKey.get(key) ?? []), title]);
      const keys = { byKey, files: new Set([...byKey.keys()].map(fileOfKey)) };

      const graph: ComponentGraph = {};
      for (const [title, key] of components) {
        setOwn(graph, title, { source: key ? relative(root, fileOfKey(key)).split(sep).join('/') : null, uses: [], usedBy: [] });
      }
      for (const [title, key] of components) {
        if (!key) continue;
        const uses = new Set<string>();
        for (const target of await componentsReachedFrom(key, keys, info, bindings)) {
          for (const other of byKey.get(target) ?? []) if (other !== title) uses.add(other);
        }
        const node = getOwn(graph, title) as ComponentNode;
        node.uses = [...uses].sort();
        for (const other of node.uses) getOwn(graph, other)?.usedBy.push(title);
      }
      for (const node of Object.values(graph)) node.usedBy.sort();
      return Object.fromEntries(Object.entries(graph).sort(([a], [b]) => a.localeCompare(b)));
    },
  };
}
