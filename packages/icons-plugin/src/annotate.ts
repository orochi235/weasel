import MagicString from 'magic-string';
import { annotatedLiterals, stringLiterals } from './collect';
import { parseModule } from './parse';

/**
 * Annotate every string literal in a bundled chunk whose value is one of `refs`, unless it already
 * is. rolldown drops plain block comments as it generates a chunk, so a library built with it gets
 * its annotations back here.
 */
export function annotateRefs(code: string, id: string, refs: ReadonlySet<string>) {
  if (![...refs].some((r) => code.includes(r))) return null;
  const parsed = parseModule(code, id);
  if ('error' in parsed) throw new Error(`${id}: cannot restore its @icon annotations, the chunk did not parse: ${parsed.error}`);
  const literals = stringLiterals(parsed);
  const done = annotatedLiterals(parsed, code, literals);
  const s = new MagicString(code);
  for (const [start, value] of literals) {
    if (refs.has(value) && !done.has(start)) s.prependLeft(start, '/* @icon */ ');
  }
  if (!s.hasChanged()) return null;
  return { code: s.toString(), map: s.generateMap({ hires: true }).toString() };
}

/** Library mode's bookkeeping: the refs each module was left naming, annotated again in its chunk. */
export function libraryAnnotations() {
  const moduleRefs = new Map<string, string[]>();
  return {
    record(id: string, refs: string[]) {
      if (refs.length > 0) moduleRefs.set(id, refs);
    },
    renderChunk(code: string, chunk: { fileName: string; moduleIds: readonly string[] }) {
      const named = new Set(chunk.moduleIds.flatMap((m) => moduleRefs.get(m) ?? []));
      return named.size > 0 ? annotateRefs(code, chunk.fileName, named) : null;
    },
    /** Why the bundle is wrong, when its modules named refs and none of its chunks kept an annotation. */
    stripped(bundle: Record<string, { type: string; code?: string }>): string | undefined {
      if (moduleRefs.size === 0) return undefined;
      if (Object.values(bundle).some((c) => c.type === 'chunk' && c.code?.includes('@icon'))) return undefined;
      return `the library build stripped every @icon annotation from ${moduleRefs.size} module(s); set both build.minify and the bundler output's minify to false`;
    },
  };
}
