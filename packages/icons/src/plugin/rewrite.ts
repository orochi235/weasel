import MagicString, { type SourceMap } from 'magic-string';
import { qualify } from '../names';
import { inside, opaqueSpans } from './lex';

const IMPORT = /import\s*\{([^}]*)\}\s*from\s*(['"])([^'"]*icons\.gen(?:\.[jt]s)?)\2/g;
const LITERAL_ARG = /\s*(['"])([^'"\s]+)\1\s*\)/y;

export interface RewriteResult {
  readonly code: string;
  readonly map: SourceMap;
  /** Calls whose argument is not a string literal, left as calls. */
  readonly dynamic: number;
}

const escape = (s: string) => s.replace(/[$]/g, '\\$&');

/** Rewrite each `icon('x')` imported from a generated icons.gen into an annotated, qualified literal. */
export function rewriteIconCalls(
  code: string,
  id: string,
  namespaceOf: (specifier: string) => string | undefined,
): RewriteResult | null {
  if (!code.includes('icons.gen')) return null;
  const spans = opaqueSpans(code);
  const locals = new Map<string, string>();
  for (const m of code.matchAll(IMPORT)) {
    if (inside(spans, m.index!)) continue;
    const namespace = namespaceOf(m[3]!);
    if (!namespace) continue;
    for (const part of m[1]!.split(',')) {
      const [imported, local = imported] = part.trim().split(/\s+as\s+/);
      if (imported === 'icon' && local) locals.set(local.trim(), namespace);
    }
  }
  if (locals.size === 0) return null;
  const s = new MagicString(code);
  let dynamic = 0;
  const call = new RegExp(`(?<![\\w$.])(${[...locals.keys()].map(escape).join('|')})\\s*\\(`, 'g');
  for (const m of code.matchAll(call)) {
    const start = m.index!;
    if (inside(spans, start)) continue;
    LITERAL_ARG.lastIndex = start + m[0].length;
    const arg = LITERAL_ARG.exec(code);
    if (!arg) {
      dynamic++;
      continue;
    }
    const ref = qualify(locals.get(m[1]!)!, arg[2]!);
    s.overwrite(start, LITERAL_ARG.lastIndex, `/* @icon */ '${ref}'`);
  }
  return { code: s.toString(), map: s.generateMap({ source: id, hires: true }), dynamic };
}
