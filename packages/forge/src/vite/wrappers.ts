import type { ResolveImport } from './depGraph.ts';
import { foreignStories } from './foreignStories.ts';
import type { ForeignCallee } from './indexFile.ts';
import type { ForeignStories } from './nativeExports.ts';
import { createTracer } from './trace.ts';

export interface WrapperResolution {
  /** The callees that are forge's `meta` or `story`. */
  wrappers: Set<string>;
  /** What following the file's imports found each one to be: a story, a function returning one, or neither. */
  foreign: ForeignStories;
  /** Every file read to decide it, so an edit to one can re-decide it. */
  reads: Set<string>;
  /** Whether an import on the way resolved to nothing, so a file added later could change the answer. */
  unresolved: boolean;
}

export const NO_FOREIGN: ForeignStories = { values: {}, calls: {}, reexports: {} };

/** Whether two resolutions index a file the same way. */
export function sameResolution(a: WrapperResolution | undefined, b: WrapperResolution): boolean {
  const key = (r: WrapperResolution | undefined) => JSON.stringify([[...(r?.wrappers ?? [])].sort(), r?.foreign ?? NO_FOREIGN]);
  return key(a) === key(b);
}

/**
 * Decides which of a story file's foreign callees are forge's own `meta` or `story`, by following each import and
 * re-export to the function it names and comparing that with the one `@weasel-js/forge` exports; then, for a file
 * whose meta is forge's, what the other imports its exports rest on are. Unlike the component graph this follows
 * into `node_modules`, where a consumer's copy of forge lives. Each file is parsed once per resolver, so a fresh one
 * sees fresh source.
 */
export function createWrapperResolver(read: (file: string) => string) {
  const tracer = createTracer(read);

  return async (file: string, callees: readonly ForeignCallee[], resolve: ResolveImport): Promise<WrapperResolution> => {
    const trace = tracer(resolve);
    const wrappers = new Set<string>();
    const direct = [...(trace.info(file)?.imports.values() ?? [])].some((imp) => imp.spec === '@weasel-js/forge');
    if (callees.length === 0 && !direct) return { wrappers, foreign: NO_FOREIGN, reads: trace.reads, unresolved: false };
    const forge = await trace.target('@weasel-js/forge', file);
    const own = new Map<string, 'meta' | 'story'>();
    if (forge) {
      for (const name of ['meta', 'story'] as const) {
        const key = await trace.declaring(forge, name);
        if (key) own.set(key, name);
      }
      for (const callee of callees) {
        const from = await trace.target(callee.spec, file);
        const key = from ? await trace.declaring(from, callee.imported) : null;
        if (key && own.has(key)) wrappers.add(callee.local);
      }
    }
    const foreign = forge ? await foreignStories(file, wrappers, own, trace, read) : NO_FOREIGN;
    return { wrappers, foreign, reads: trace.reads, unresolved: trace.unresolved };
  };
}
