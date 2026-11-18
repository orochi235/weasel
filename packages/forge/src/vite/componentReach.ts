import { dirname, relative } from 'node:path';
import { type Bindings, fileOfKey, type Key, keyOf } from './bindings.ts';
import type { ModuleInfo } from './moduleInfo.ts';

/** The listed components, as the bindings declaring them. */
export interface ComponentKeys {
  /** Each component binding and the titles that name it. */
  byKey: ReadonlyMap<Key, readonly string[]>;
  /** The files declaring a component. */
  files: ReadonlySet<string>;
}

/**
 * The other components `key`'s own declaration reaches: directly, through its file's local helpers, or through
 * the relative imports in its own directory, short of a file declaring a component.
 */
export async function componentsReachedFrom(
  key: Key,
  components: ComponentKeys,
  info: (file: string) => ModuleInfo | null,
  bindings: Bindings,
): Promise<Set<Key>> {
  const { byKey, files: componentFiles } = components;
  const out = new Set<Key>();
  const home = fileOfKey(key);
  const homeDir = dirname(home);
  const visited = new Set<string>();

  /** The top-level names `roots` reach in `mod`, through the file's own declarations; every one for null. */
  const localsOf = (file: string, mod: ModuleInfo, roots: readonly string[] | null): Set<string> => {
    const locals = new Set<string>();
    if (roots === null) {
      for (const name of mod.refs.keys()) locals.add(name);
      for (const name of mod.imports.keys()) locals.add(name);
      return locals;
    }
    const queue = [...roots];
    while (queue.length > 0) {
      const name = queue.pop() as string;
      if (locals.has(name)) continue;
      locals.add(name);
      const here = keyOf(file, name);
      if (here !== key && byKey.has(here)) {
        out.add(here);
        continue;
      }
      for (const ref of mod.refs.get(name) ?? []) {
        if (mod.refs.has(ref) || mod.imports.has(ref)) queue.push(ref);
      }
    }
    return locals;
  };

  const walkFile = async (file: string, roots: readonly string[] | null): Promise<void> => {
    const mod = info(file);
    if (!mod) return;
    for (const name of localsOf(file, mod, roots)) {
      const imp = mod.imports.get(name);
      if (!imp) continue;
      const target = await bindings.importKey(file, imp);
      if (target && byKey.has(target)) {
        if (target !== key) out.add(target);
        continue;
      }
      if (!imp.spec.startsWith('.')) continue;
      const helper = await bindings.resolveFrom(imp.spec, file);
      if (!helper || visited.has(helper) || componentFiles.has(helper)) continue;
      if (relative(homeDir, helper).startsWith('..')) continue;
      visited.add(helper);
      await walkFile(helper, null);
    }
  };

  visited.add(home);
  await walkFile(home, [key.slice(home.length + 1)]);
  return out;
}
