import { type ParserPlugin, parse } from '@babel/parser';
import type * as t from '@babel/types';

/** A program's top-level `const` initializers, by name. */
export type Bindings = Map<string, t.Node>;

export function parseFile(code: string, file: string): t.Program {
  const plugins: ParserPlugin[] = ['typescript', 'decorators-legacy', ...(/\.[jt]sx$/.test(file) ? (['jsx'] as const) : [])];
  return parse(code, { sourceType: 'module', plugins }).program;
}

/** The identifier `node` calls, through casts and top-level `const`s. */
export function calleeOf(node: t.Node | undefined, bindings: Bindings, depth = 0): string | undefined {
  if (!node || depth > 16) return undefined;
  switch (node.type) {
    case 'TSSatisfiesExpression':
    case 'TSAsExpression':
    case 'TSTypeAssertion':
    case 'TSNonNullExpression':
    case 'ParenthesizedExpression':
      return calleeOf(node.expression, bindings, depth + 1);
    case 'CallExpression':
      return node.callee.type === 'Identifier' ? node.callee.name : undefined;
    case 'Identifier':
      return calleeOf(bindings.get(node.name), bindings, depth + 1);
    default:
      return undefined;
  }
}

/** The value of a plain string literal or an expression-free template literal. */
export function stringLiteral(node: t.Node): string | undefined {
  if (node.type === 'StringLiteral') return node.value;
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) return node.quasis.map((q) => q.value.cooked ?? q.value.raw).join('');
  return undefined;
}

export function isDefaultExport(stmt: t.Statement): boolean {
  if (stmt.type === 'ExportDefaultDeclaration') return true;
  return (
    stmt.type === 'ExportNamedDeclaration' &&
    stmt.specifiers.some((s) => s.type === 'ExportSpecifier' && exportedName(s.exported) === 'default')
  );
}

/**
 * The JSDoc block immediately above `node`, as prose. A `//` comment is not
 * one: a line comment above an export is as often a note to the author as a
 * description of the story, and printing it in the dossier would be guessing.
 */
export function docOf(node: t.Node): string | undefined {
  const comments = node.leadingComments;
  const last = comments?.[comments.length - 1];
  if (last?.type !== 'CommentBlock' || !last.value.startsWith('*')) return undefined;
  const text = last.value
    .slice(1)
    .split('\n')
    .map((line) => line.replace(/^\s*\*/, '').trim())
    .join('\n')
    .trim();
  return text || undefined;
}

export function exportedName(node: t.Identifier | t.StringLiteral): string {
  return node.type === 'Identifier' ? node.name : node.value;
}

/** The object literal `node` evaluates to, through casts, `meta(…)`/`story(…)` and top-level `const`s. */
export function objectOf(node: t.Node | undefined, bindings: Bindings, wrappers: Set<string>, depth = 0): t.ObjectExpression | null {
  if (!node || depth > 16) return null;
  switch (node.type) {
    case 'ObjectExpression':
      return node;
    case 'TSSatisfiesExpression':
    case 'TSAsExpression':
    case 'TSTypeAssertion':
    case 'TSNonNullExpression':
    case 'ParenthesizedExpression':
      return objectOf(node.expression, bindings, wrappers, depth + 1);
    case 'CallExpression':
      return node.callee.type === 'Identifier' && wrappers.has(node.callee.name)
        ? objectOf(node.arguments[0], bindings, wrappers, depth + 1)
        : null;
    case 'Identifier':
      return objectOf(bindings.get(node.name), bindings, wrappers, depth + 1);
    default:
      return null;
  }
}

export function prop(obj: t.ObjectExpression | null, key: string): t.Node | undefined {
  for (const p of obj?.properties ?? []) {
    if (p.type !== 'ObjectProperty' || p.computed) continue;
    const name = p.key.type === 'Identifier' ? p.key.name : p.key.type === 'StringLiteral' ? p.key.value : null;
    if (name === key) return p.value;
  }
  return undefined;
}

export function stringProp(obj: t.ObjectExpression | null, key: string): string | undefined {
  const value = prop(obj, key);
  return value?.type === 'StringLiteral' ? value.value : undefined;
}
