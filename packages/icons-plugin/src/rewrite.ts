import MagicString, { type SourceMap } from 'magic-string';
import { qualify } from '../../icons/src/names.ts';
import { parseModule } from './parse.ts';
import { unshadowedCalls } from './scope.ts';

const ICONS_GEN = /icons\.gen(?:\.[cm]?[jt]sx?)?$/;
const NAME = /^[^'"`\s\\]+$/;
const LONE_SURROGATE = /[\uD800-\uDFFF]/gu;

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
  const unfollowed = (form: string) =>
    warn?.(`${id}: a ${form} of icon from an icons.gen module is not followed, so its calls are not rewritten and their glyphs can miss a trimmed build`);
  const fromGen = (source: { value: string } | null | undefined) =>
    !!source && ICONS_GEN.test(source.value) && namespaceOf(source.value) !== undefined;
  const nameOf = (n: { type: string; name?: string; value?: unknown }) => (n.type === 'Identifier' ? n.name : String(n.value));
  for (const node of parsed.program.body) {
    if (node.type === 'ExportAllDeclaration' && node.exportKind !== 'type' && fromGen(node.source)) unfollowed('re-export');
    if (node.type === 'ExportNamedDeclaration' && node.exportKind !== 'type' && node.source && fromGen(node.source)) {
      if (node.specifiers.some((e) => e.exportKind !== 'type' && nameOf(e.local) === 'icon')) unfollowed('re-export');
    }
    if (node.type !== 'ImportDeclaration' || node.importKind === 'type' || !ICONS_GEN.test(node.source.value)) continue;
    const namespace = namespaceOf(node.source.value);
    if (!namespace) {
      if (node.specifiers.some((e) => e.type === 'ImportSpecifier' && e.importKind !== 'type' && nameOf(e.imported) === 'icon')) {
        warn?.(`${id}: icon is imported from '${node.source.value}', which names no icons.gen module this build can read a namespace from, so its calls are not rewritten`);
      }
      continue;
    }
    for (const spec of node.specifiers) {
      if (spec.type === 'ImportNamespaceSpecifier') unfollowed('namespace import');
      if (spec.type === 'ImportDefaultSpecifier') unfollowed('default import');
      if (spec.type !== 'ImportSpecifier' || spec.importKind === 'type') continue;
      if (nameOf(spec.imported) === 'icon') locals.set(spec.local.name, namespace);
    }
  }
  for (const node of parsed.program.body) {
    const local =
      node.type === 'ExportNamedDeclaration' && !node.source && node.exportKind !== 'type'
        ? node.specifiers.some((e) => locals.has(nameOf(e.local) ?? ''))
        : node.type === 'ExportDefaultDeclaration' && node.declaration.type === 'Identifier' && locals.has(node.declaration.name);
    if (local) unfollowed('re-export');
  }
  if (locals.size === 0) return null;
  const s = new MagicString(code);
  let dynamic = 0;
  unshadowedCalls(parsed.program, new Set(locals.keys()), (node) => {
    const callee = (node.callee as Node & { name: string }).name;
    const name = literalArg(node.arguments as Node[]);
    if (name === undefined || !NAME.test(name)) {
      dynamic++;
      return;
    }
    // A lone surrogate written bare reaches the bundler's UTF-8 output as U+FFFD, naming another glyph.
    const ref = qualify(locals.get(callee)!, name).replace(LONE_SURROGATE, (c) => `\\u${c.charCodeAt(0).toString(16)}`);
    s.overwrite(node.start as number, node.end as number, `/* @icon */ '${ref}'`);
  });
  return { code: s.toString(), map: s.generateMap({ source: id, hires: true }), dynamic };
}
