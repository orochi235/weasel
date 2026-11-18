import type { IndexEntry } from '../story/types.ts';
import { titleStandIn } from './componentOf.ts';
import type { ResolveImport } from './componentGraph.ts';
import type { Import, ModuleInfo } from './moduleInfo.ts';

/** A declared binding: the file declaring it and its name there. */
export type Key = string;
export const keyOf = (file: string, local: string): Key => `${file}#${local}`;
export const fileOfKey = (key: Key): string => key.slice(0, key.lastIndexOf('#'));

const SCRIPT = /\.[cm]?[jt]sx?$/;

/** Each importer's resolved imports, by specifier: kept between builds until the importer is invalidated. */
export type Resolutions = Map<string, Map<string, Promise<string | null>>>;

/** Follows imports and re-exports to the binding they name. */
export interface Bindings {
  /** The source file `spec` resolves to from `importer`, or null for anything that is not one, or is a dependency's. */
  resolveFrom(spec: string, importer: string): Promise<string | null>;
  /** The binding `imp`, an import in `importer`, is declared as. */
  importKey(importer: string, imp: Import): Promise<Key | null>;
  /** The component a story file's meta stands for. */
  componentOf(entry: IndexEntry): Promise<Key | null>;
}

/**
 * Bindings read through `info`, resolving each import with `resolve` once and keeping the answer in `resolutions`.
 */
export function createBindings(
  info: (file: string) => ModuleInfo | null,
  resolutions: Resolutions,
  resolve: ResolveImport,
): Bindings {
  const resolveFrom = (spec: string, importer: string): Promise<string | null> => {
    let byImporter = resolutions.get(importer);
    if (!byImporter) {
      byImporter = new Map();
      resolutions.set(importer, byImporter);
    }
    let pending = byImporter.get(spec);
    if (!pending) {
      pending = resolve(spec, importer).then(
        (id) => {
          const file = id?.split('?')[0];
          return file && !file.startsWith('\0') && SCRIPT.test(file) && !file.split(/[\\/]/).includes('node_modules') ? file : null;
        },
        () => null,
      );
      byImporter.set(spec, pending);
    }
    return pending;
  };

  /** The binding `name` exported from `file` is declared as, through re-exports. */
  const declaring = async (file: string, name: string, depth = 0): Promise<Key | null> => {
    const mod = info(file);
    if (!mod || depth > 32) return null;
    const exp = mod.exports.get(name);
    if (exp?.kind === 'local') {
      const imp = mod.imports.get(exp.local);
      return imp ? importKey(file, imp, depth + 1) : keyOf(file, exp.local);
    }
    if (exp?.kind === 'from') {
      const target = await resolveFrom(exp.spec, file);
      return target ? declaring(target, exp.imported, depth + 1) : null;
    }
    if (name === 'default') return null;
    for (const spec of mod.stars) {
      const target = await resolveFrom(spec, file);
      const found = target ? await declaring(target, name, depth + 1) : null;
      if (found) return found;
    }
    return null;
  };

  const importKey = async (importer: string, imp: Import, depth = 0): Promise<Key | null> => {
    if (imp.imported === '*') return null;
    const target = await resolveFrom(imp.spec, importer);
    return target ? declaring(target, imp.imported, depth) : null;
  };

  const componentOf = async (entry: IndexEntry): Promise<Key | null> => {
    const mod = info(entry.file);
    if (!mod) return null;
    const byTitle = titleStandIn(entry.title);
    for (const local of [entry.componentName, byTitle]) {
      const imp = local ? mod.imports.get(local) : undefined;
      const key = imp ? await importKey(entry.file, imp) : null;
      if (key) return key;
    }
    return null;
  };

  return { resolveFrom, importKey: (importer, imp) => importKey(importer, imp), componentOf };
}
