import { type ModuleInfo, moduleInfo, type ResolveImport } from './depGraph.ts';
import type { ForeignCallee } from './indexFile.ts';

export interface WrapperResolution {
  /** The callees that are forge's `meta` or `story`. */
  wrappers: Set<string>;
  /** Every file read to decide it, so an edit to one can re-decide it. */
  reads: Set<string>;
}

/**
 * Decides which of a story file's foreign callees are forge's own `meta` or `story`, by following each import and
 * re-export to the function it names and comparing that with the one `@weasel-js/forge` exports. Unlike the
 * component graph this follows into `node_modules`, where a consumer's copy of forge lives. Each file is parsed once
 * per resolver, so a fresh one sees fresh source.
 */
export function createWrapperResolver(read: (file: string) => string) {
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

  return async (file: string, callees: readonly ForeignCallee[], resolve: ResolveImport): Promise<WrapperResolution> => {
    const reads = new Set<string>();
    const wrappers = new Set<string>();
    if (callees.length === 0) return { wrappers, reads };

    const target = async (spec: string, importer: string): Promise<string | null> => {
      const id = (await resolve(spec, importer).catch(() => null))?.split('?')[0];
      return id && !id.startsWith('\0') ? id : null;
    };

    /** `file#local` for the binding `name` exported from `file` is declared as, through imports and re-exports. */
    const declaring = async (at: string, name: string, depth = 0): Promise<string | null> => {
      reads.add(at);
      const mod = info(at);
      if (!mod || depth > 32) return null;
      const exp = mod.exports.get(name);
      if (exp?.kind === 'local') {
        const imp = mod.imports.get(exp.local);
        if (!imp) return `${at}#${exp.local}`;
        if (imp.imported === '*') return null;
        const next = await target(imp.spec, at);
        return next ? declaring(next, imp.imported, depth + 1) : null;
      }
      if (exp?.kind === 'from') {
        const next = await target(exp.spec, at);
        return next ? declaring(next, exp.imported, depth + 1) : null;
      }
      if (name === 'default') return null;
      for (const spec of mod.stars) {
        const next = await target(spec, at);
        const found = next ? await declaring(next, name, depth + 1) : null;
        if (found) return found;
      }
      return null;
    };

    const forge = await target('@weasel-js/forge', file);
    if (!forge) return { wrappers, reads };
    const own = new Set(
      (await Promise.all(['meta', 'story'].map((name) => declaring(forge, name)))).filter((key) => key !== null),
    );
    for (const callee of callees) {
      const from = await target(callee.spec, file);
      const key = from ? await declaring(from, callee.imported) : null;
      if (key && own.has(key)) wrappers.add(callee.local);
    }
    return { wrappers, reads };
  };
}
