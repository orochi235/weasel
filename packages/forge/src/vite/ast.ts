import { type ParserPlugin, parse } from '@babel/parser';
import type * as t from '@babel/types';

/**
 * A program's top-level locals by name: a variable's initializer, a function, class or enum declaration, and the
 * declarator of a variable with no initializer or a destructured one.
 */
export type Bindings = Map<string, t.Node>;

/** A file's locals that are forge's `meta` or `story`, and which. */
export type Wrappers = ReadonlyMap<string, 'meta' | 'story'>;

export function parseFile(code: string, file: string): t.Program {
  const plugins: ParserPlugin[] = ['typescript', 'decorators-legacy', ...(/\.[jt]sx$/.test(file) ? (['jsx'] as const) : [])];
  return parse(code, { sourceType: 'module', plugins }).program;
}

/** The local a default export that names no binding of its own is declared as. */
export const DEFAULT_LOCAL = '*default*';

/** `program`'s bindings, exported or not, a default export's under its own name or `DEFAULT_LOCAL`. */
export function bindingsOf(program: t.Program): Bindings {
  const bindings: Bindings = new Map();
  for (const stmt of program.body) {
    if (stmt.type === 'ExportDefaultDeclaration') {
      const decl = stmt.declaration;
      if ((decl.type === 'FunctionDeclaration' || decl.type === 'ClassDeclaration') && decl.id) bindings.set(decl.id.name, decl);
      else if (decl.type !== 'Identifier') bindings.set(DEFAULT_LOCAL, decl);
      continue;
    }
    const decl = stmt.type === 'ExportNamedDeclaration' ? stmt.declaration : stmt;
    if (decl?.type === 'VariableDeclaration') {
      for (const d of decl.declarations) {
        if (d.id.type === 'Identifier' && d.init) bindings.set(d.id.name, d.init);
        // A destructured or uninitialized local is still a local, though nothing here can read its value.
        else for (const name of patternNames(d.id)) bindings.set(name, d);
      }
    } else if ((decl?.type === 'FunctionDeclaration' || decl?.type === 'ClassDeclaration') && decl.id) {
      bindings.set(decl.id.name, decl);
    } else if (decl?.type === 'TSEnumDeclaration') {
      bindings.set(decl.id.name, decl);
    }
  }
  return bindings;
}

function patternNames(node: t.LVal | t.ObjectProperty['value'] | null | undefined): string[] {
  switch (node?.type) {
    case 'Identifier':
      return [node.name];
    case 'ObjectPattern':
      return node.properties.flatMap((p) => patternNames(p.type === 'RestElement' ? p.argument : p.value));
    case 'ArrayPattern':
      return node.elements.flatMap((e) => patternNames(e));
    case 'RestElement':
      return patternNames(node.argument);
    case 'AssignmentPattern':
      return patternNames(node.left);
    default:
      return [];
  }
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

const LITERALS: ReadonlySet<string> = new Set([
  'StringLiteral',
  'NumericLiteral',
  'BooleanLiteral',
  'NullLiteral',
  'BigIntLiteral',
  'RegExpLiteral',
  'TemplateLiteral',
  'ArrayExpression',
  'ArrowFunctionExpression',
  'FunctionExpression',
  'FunctionDeclaration',
  'ClassExpression',
  'ClassDeclaration',
  'TSEnumDeclaration',
  'JSXElement',
  'JSXFragment',
]);

/** Whether `node` is written out as a value, through casts and top-level `const`s, so no call produced it. */
export function isLiteralValue(node: t.Node | undefined, bindings: Bindings, depth = 0): boolean {
  if (!node || depth > 16) return false;
  switch (node.type) {
    case 'TSSatisfiesExpression':
    case 'TSAsExpression':
    case 'TSTypeAssertion':
    case 'TSNonNullExpression':
    case 'ParenthesizedExpression':
      return isLiteralValue(node.expression, bindings, depth + 1);
    case 'Identifier':
      return isLiteralValue(bindings.get(node.name), bindings, depth + 1);
    case 'ObjectExpression':
      // A spread can carry a story's brand into the copy.
      return node.properties.every((p) => p.type !== 'SpreadElement');
    default:
      return LITERALS.has(node.type);
  }
}

/** The value of a plain string literal or an expression-free template literal. */
export function stringLiteral(node: t.Node): string | undefined {
  if (node.type === 'StringLiteral') return node.value;
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) return node.quasis.map((q) => q.value.cooked ?? q.value.raw).join('');
  return undefined;
}

/** The expression `node` stands for, through casts and top-level `const`s. */
export function valueOf(node: t.Node | undefined, bindings: Bindings, depth = 0): t.Node | undefined {
  if (!node || depth > 16) return undefined;
  switch (node.type) {
    case 'TSSatisfiesExpression':
    case 'TSAsExpression':
    case 'TSTypeAssertion':
    case 'TSNonNullExpression':
    case 'ParenthesizedExpression':
      return valueOf(node.expression, bindings, depth + 1);
    case 'Identifier':
      return valueOf(bindings.get(node.name), bindings, depth + 1);
    default:
      return node;
  }
}

/** The string `node` is written as: a literal, through casts and top-level `const`s. */
export function stringOf(node: t.Node | undefined, bindings: Bindings): string | undefined {
  const value = valueOf(node, bindings);
  return value && stringLiteral(value);
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
export function objectOf(
  node: t.Node | undefined,
  bindings: Bindings,
  wrappers: { has(name: string): boolean },
  depth = 0,
): t.ObjectExpression | null {
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

const ABSENT = Symbol('absent');

/**
 * The value `obj` holds at `key`, as an object literal evaluates: the last property naming it, or what a spread after
 * it carries, read through `bindings` and `wrappers`. A spread it cannot read is taken to set nothing.
 */
export function prop(
  obj: t.ObjectExpression | null,
  key: string,
  bindings: Bindings = new Map(),
  wrappers: { has(name: string): boolean } = new Set(),
): t.Node | undefined {
  const found = lookup(obj, key, bindings, wrappers, 0);
  return found === ABSENT ? undefined : found;
}

function lookup(
  obj: t.ObjectExpression | null,
  key: string,
  bindings: Bindings,
  wrappers: { has(name: string): boolean },
  depth: number,
): t.Node | typeof ABSENT {
  if (depth > 16) return ABSENT;
  for (const p of [...(obj?.properties ?? [])].reverse()) {
    if (p.type === 'SpreadElement') {
      const found = lookup(objectOf(p.argument, bindings, wrappers), key, bindings, wrappers, depth + 1);
      if (found !== ABSENT) return found;
      continue;
    }
    if (p.type !== 'ObjectProperty' || p.computed) continue;
    const name = p.key.type === 'Identifier' ? p.key.name : p.key.type === 'StringLiteral' ? p.key.value : null;
    if (name === key) return p.value;
  }
  return ABSENT;
}
