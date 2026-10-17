import MagicString, { type SourceMap } from 'magic-string';
import { Visitor } from 'oxc-parser';
import { qualify } from '../../icons/src/names';
import { parseModule } from './parse';

const ICONS_GEN = /icons\.gen(?:\.[cm]?[jt]sx?)?$/;
const NAME = /^[^'"`\s\\]+$/;

export interface RewriteResult {
  readonly code: string;
  readonly map: SourceMap;
  /** Calls whose argument is not a string literal, left as calls. */
  readonly dynamic: number;
}

interface Node {
  readonly type: string;
  readonly start: number;
  readonly end: number;
  readonly [key: string]: unknown;
}

/** The string a call's lone argument spells, when it is a literal. */
function literalArg(args: readonly Node[]): string | undefined {
  const [arg] = args;
  if (args.length !== 1 || !arg) return undefined;
  if (arg.type === 'Literal' && typeof arg.value === 'string') return arg.value;
  const quasis = arg.quasis as { value: { cooked: string | null } }[] | undefined;
  if (arg.type === 'TemplateLiteral' && quasis?.length === 1) return quasis[0]!.value.cooked ?? undefined;
  return undefined;
}

/**
 * Rewrite each `icon('x')` imported from a generated icons.gen into an annotated, qualified literal.
 * A module that does not parse is left alone, and `warn` hears why.
 */
export function rewriteIconCalls(
  code: string,
  id: string,
  namespaceOf: (specifier: string) => string | undefined,
  warn?: (message: string) => void,
): RewriteResult | null {
  if (!code.includes('icons.gen')) return null;
  const parsed = parseModule(code, id);
  if ('error' in parsed) {
    warn?.(`${id}: icon() calls left unrewritten, the module did not parse: ${parsed.error}`);
    return null;
  }
  const locals = new Map<string, string>();
  for (const node of parsed.program.body) {
    if (node.type !== 'ImportDeclaration' || node.importKind === 'type' || !ICONS_GEN.test(node.source.value)) continue;
    const namespace = namespaceOf(node.source.value);
    if (!namespace) continue;
    for (const spec of node.specifiers) {
      if (spec.type !== 'ImportSpecifier' || spec.importKind === 'type') continue;
      const imported = spec.imported.type === 'Identifier' ? spec.imported.name : spec.imported.value;
      if (imported === 'icon') locals.set(spec.local.name, namespace);
    }
  }
  if (locals.size === 0) return null;
  const s = new MagicString(code);
  let dynamic = 0;
  new Visitor({
    CallExpression(node) {
      if (node.callee.type !== 'Identifier' || !locals.has(node.callee.name)) return;
      const name = literalArg(node.arguments as unknown as Node[]);
      if (name === undefined || !NAME.test(name)) {
        dynamic++;
        return;
      }
      s.overwrite(node.start, node.end, `/* @icon */ '${qualify(locals.get(node.callee.name)!, name)}'`);
    },
  }).visit(parsed.program);
  return { code: s.toString(), map: s.generateMap({ source: id, hires: true }), dynamic };
}
