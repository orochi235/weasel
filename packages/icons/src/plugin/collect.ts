import { Visitor } from 'oxc-parser';
import { parseModule } from './parse';

const ANNOTATED = /\/\*\s*@icon\s*\*\/\s*(['"])([^'"]+)\1/g;
const ANNOTATION = /^\s*@icon\s*$/;

/**
 * Every qualified ref the module names as a string literal led by an `@icon` block comment.
 * A module that does not parse falls back to a plain scan, which can over-count but never drops one.
 */
export function collectIconRefs(code: string, id = 'module.js'): string[] {
  if (!code.includes('@icon')) return [];
  const parsed = parseModule(code, id);
  if ('error' in parsed) return [...code.matchAll(ANNOTATED)].map((m) => m[2]!);
  const literals = new Map<number, string>();
  new Visitor({
    Literal(node) {
      if (typeof node.value === 'string') literals.set(node.start, node.value);
    },
  }).visit(parsed.program);
  const out: string[] = [];
  for (const c of parsed.comments) {
    if (c.type !== 'Block' || !ANNOTATION.test(c.value)) continue;
    let at = c.end;
    while (at < code.length && /\s/.test(code[at]!)) at++;
    const ref = literals.get(at);
    if (ref !== undefined) out.push(ref);
  }
  return out;
}
