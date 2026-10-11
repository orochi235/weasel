import { type ModuleInfo, moduleInfo, type ResolveImport } from './depGraph.ts';

/** One pass of following imports for one story file: what it read, and whether anything failed to resolve. */
export interface Trace {
  reads: Set<string>;
  unresolved: boolean;
  info(file: string): ModuleInfo | null;
  /** The file `spec` names from `importer`, or null for nothing, or for a virtual module. */
  target(spec: string, importer: string): Promise<string | null>;
  /** `file#local` for the binding `name` exported from `at` is declared as, through imports and re-exports. */
  declaring(at: string, name: string): Promise<string | null>;
}

/** Follows imports and re-exports to the binding a name was declared as. Each file is parsed once per tracer. */
export function createTracer(read: (file: string) => string): (resolve: ResolveImport) => Trace {
  const modules = new Map<string, ModuleInfo | null>();
  const info = (file: string): ModuleInfo | null => {
    if (!modules.has(file)) {
      let parsed: ModuleInfo | null = null;
      try {
        parsed = moduleInfo(read(file), file);
      } catch {
        parsed = null;
      }
      modules.set(file, parsed);
    }
    return modules.get(file) ?? null;
  };

  return (resolve) => {
    const trace: Trace = {
      reads: new Set(),
      unresolved: false,
      info,
      async target(spec, importer) {
        const id = (await resolve(spec, importer).catch(() => null))?.split('?')[0];
        if (!id) trace.unresolved = true;
        return id && !id.startsWith('\0') ? id : null;
      },
      declaring: (at, name) => declaring(at, name, 0),
    };
    const declaring = async (at: string, name: string, depth: number): Promise<string | null> => {
      trace.reads.add(at);
      const mod = info(at);
      if (!mod || depth > 32) return null;
      const exp = mod.exports.get(name);
      if (exp?.kind === 'local') {
        const imp = mod.imports.get(exp.local);
        if (!imp) return `${at}#${exp.local}`;
        if (imp.imported === '*') return null;
        const next = await trace.target(imp.spec, at);
        return next ? declaring(next, imp.imported, depth + 1) : null;
      }
      if (exp?.kind === 'from') {
        const next = await trace.target(exp.spec, at);
        return next ? declaring(next, exp.imported, depth + 1) : null;
      }
      if (name === 'default') return null;
      for (const spec of mod.stars) {
        const next = await trace.target(spec, at);
        const found = next ? await declaring(next, name, depth + 1) : null;
        if (found) return found;
      }
      return null;
    };
    return trace;
  };
}
