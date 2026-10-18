import { Visitor, type ParseResult } from 'oxc-parser';
import { parseModule } from './parse.ts';

const ANNOTATED = /\/\*\s*@icon\s*\*\/\s*(['"])([^'"]+)\1/g;
const ANNOTATION = /^\s*@icon\s*$/;

/** Every string literal in a parsed module, a template with no substitution included, by start offset. */
export function stringLiterals(parsed: ParseResult): Map<number, string> {
  const literals = new Map<number, string>();
  new Visitor({
    Literal(node) {
      if (typeof node.value === 'string') literals.set(node.start, node.value);
    },
    TemplateLiteral(node) {
      const cooked = node.expressions.length === 0 ? node.quasis[0]?.value.cooked : undefined;
      if (typeof cooked === 'string') literals.set(node.start, cooked);
    },
  }).visit(parsed.program);
  return literals;
}

/** The start offset of each string literal an `@icon` block comment leads, with its value. */
export function annotatedLiterals(parsed: ParseResult, code: string, literals = stringLiterals(parsed)): Map<number, string> {
  const out = new Map<number, string>();
  for (const c of parsed.comments) {
    if (c.type !== 'Block' || !ANNOTATION.test(c.value)) continue;
    let at = c.end;
    while (at < code.length && /\s/.test(code[at]!)) at++;
    const ref = literals.get(at);
    if (ref !== undefined) out.set(at, ref);
  }
  return out;
}

/**
 * Every qualified ref the module names as a string literal led by an `@icon` block comment.
 * A module that does not parse falls back to a plain scan, which can over-count but never drops one.
 */
export function collectIconRefs(code: string, id = 'module.js'): string[] {
  if (!code.includes('@icon')) return [];
  const parsed = parseModule(code, id);
  if ('error' in parsed) return [...code.matchAll(ANNOTATED)].map((m) => m[2]!);
  return [...annotatedLiterals(parsed, code).values()];
}
