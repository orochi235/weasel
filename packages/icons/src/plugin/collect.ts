import { inside, opaqueSpans } from './lex';

const ANNOTATED = /\/\*\s*@icon\s*\*\/\s*(['"])([^'"]+)\1/g;

/** Every qualified ref the module names through an `@icon` annotation outside a comment or string. */
export function collectIconRefs(code: string): string[] {
  if (!code.includes('@icon')) return [];
  const spans = opaqueSpans(code);
  return [...code.matchAll(ANNOTATED)].filter((m) => !inside(spans, m.index!)).map((m) => m[2]!);
}
