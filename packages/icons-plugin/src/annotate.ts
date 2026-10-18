import MagicString from 'magic-string';
import { annotatedLiterals, stringLiterals } from './collect.ts';
import { parseModule } from './parse.ts';

/** The start and value of each string literal in a chunk that is one of `refs` and has no `@icon` annotation. */
function unannotated(code: string, id: string, refs: ReadonlySet<string>): [number, string][] {
  if (![...refs].some((r) => code.includes(r))) return [];
  const parsed = parseModule(code, id);
  if ('error' in parsed) throw new Error(`${id}: cannot check its @icon annotations, the chunk did not parse: ${parsed.error}`);
  const literals = stringLiterals(parsed);
  const done = annotatedLiterals(parsed, code, literals);
  return [...literals].filter(([start, value]) => refs.has(value) && !done.has(start));
}

/**
 * Annotate every string literal in a bundled chunk whose value is one of `refs`, unless it already
 * is. rolldown drops plain block comments as it generates a chunk, so a library built with it gets
 * its annotations back here.
 */
export function annotateRefs(code: string, id: string, refs: ReadonlySet<string>) {
  const bare = unannotated(code, id, refs);
  if (bare.length === 0) return null;
  const s = new MagicString(code);
  for (const [start] of bare) s.prependLeft(start, '/* @icon */ ');
  return { code: s.toString(), map: s.generateMap({ hires: true }).toString() };
}

/**
 * Library mode's bookkeeping: every ref the build's modules were left naming, annotated again in
 * whichever chunk a literal lands in, since a bundler can inline a constant into another chunk.
 */
export function libraryAnnotations() {
  const moduleRefs = new Map<string, string[]>();
  const all = () => new Set([...moduleRefs.values()].flat());
  return {
    record(id: string, refs: string[]) {
      if (refs.length > 0) moduleRefs.set(id, refs);
      else moduleRefs.delete(id);
    },
    /** Drop the modules a rebuild no longer holds. */
    keep(ids: ReadonlySet<string>) {
      for (const id of moduleRefs.keys()) if (!ids.has(id)) moduleRefs.delete(id);
    },
    renderChunk(code: string, chunk: { fileName: string }) {
      const named = all();
      return named.size > 0 ? annotateRefs(code, chunk.fileName, named) : null;
    },
    /** Why the bundle is wrong, when a chunk holds a recorded ref with its annotation stripped. */
    stripped(bundle: Record<string, { type: string; code?: string }>): string | undefined {
      const named = all();
      if (named.size === 0) return undefined;
      const lost = new Set<string>();
      for (const [file, c] of Object.entries(bundle)) {
        if (c.type === 'chunk' && c.code) for (const [, ref] of unannotated(c.code, file, named)) lost.add(ref);
      }
      if (lost.size === 0) return undefined;
      return `the library build stripped the @icon annotation from ${[...lost].join(', ')}; set both build.minify and the bundler output's minify to false`;
    },
  };
}
