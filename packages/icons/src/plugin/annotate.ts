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
