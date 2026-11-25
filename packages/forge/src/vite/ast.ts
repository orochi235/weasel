import { type ParserPlugin, parse } from '@babel/parser';
import type * as t from '@babel/types';

/**
 * A program's top-level locals by name: a variable's initializer, a function, class or enum declaration, and the
 * declarator of a variable with no initializer, a destructured one, or a `let` or `var` assigned anywhere.
 */
export type Bindings = Map<string, t.Node>;

/** A file's callees that are forge's `meta` or `story`, and which, keyed as `calleeName` writes them. */
export type Wrappers = ReadonlyMap<string, 'meta' | 'story'>;

/** The syntax babel reads `file` with: JSX in any JavaScript file and in `.tsx`, TypeScript in any but JavaScript. */
export function parserPluginsFor(file: string): ParserPlugin[] {
  const js = /\.[cm]?jsx?$/.test(file);
  return [...(js ? [] : (['typescript'] as const)), 'decorators-legacy', ...(js || /\.[cm]?tsx$/.test(file) ? (['jsx'] as const) : [])];
}

export function parseFile(code: string, file: string): t.Program {
  return parse(code, { sourceType: 'module', plugins: parserPluginsFor(file) }).program;
}

/** The local a default export that names no binding of its own is declared as. */
export const DEFAULT_LOCAL = '*default*';

/** `program`'s bindings, exported or not, a default export's under its own name or `DEFAULT_LOCAL`. */
export function bindingsOf(program: t.Program): Bindings {
  const bindings: Bindings = new Map();
  let reassigned: ReadonlySet<string> | undefined;
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
        const fixed = decl.kind === 'const' || !(reassigned ??= assignedNames(program)).has(d.id.type === 'Identifier' ? d.id.name : '');
        if (d.id.type === 'Identifier' && d.init && fixed) bindings.set(d.id.name, d.init);
        // A destructured, uninitialized or reassigned local is still a local, though nothing here can read its value.
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

const FUNCTIONS: ReadonlySet<string> = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
  'ObjectMethod',
  'ClassMethod',
  'ClassPrivateMethod',
]);

const childrenOf = (n: t.Node): unknown[] =>
  Object.entries(n).flatMap(([key, child]) => (key === 'loc' || key.endsWith('Comments') ? [] : [child]));

const isNode = (value: unknown): value is t.Node =>
  !!value && typeof value === 'object' && typeof (value as t.Node).type === 'string';

/** The `var`s a function body declares, outside any function nested in it. */
function varNames(body: t.Node): string[] {
  const out: string[] = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!isNode(value) || FUNCTIONS.has(value.type)) return;
    if (value.type === 'VariableDeclaration' && value.kind === 'var') out.push(...value.declarations.flatMap((d) => patternNames(d.id)));
    childrenOf(value).forEach(visit);
  };
  visit(body);
  return out;
}

/** The names `n` declares for its own scope, which hide a top-level binding of the same name inside it. */
function scopeNames(n: t.Node): string[] {
  if (FUNCTIONS.has(n.type)) {
    const fn = n as t.Function;
    const own = fn.type === 'FunctionExpression' && fn.id ? [fn.id.name] : [];
    return [...own, ...fn.params.flatMap((p) => patternNames(p.type === 'TSParameterProperty' ? p.parameter : p)), ...varNames(fn.body)];
  }
  if (n.type === 'CatchClause') return patternNames(n.param);
  if (n.type === 'ClassExpression' && n.id) return [n.id.name];
  const statements =
    n.type === 'BlockStatement' || n.type === 'StaticBlock'
      ? n.body
      : n.type === 'SwitchStatement'
        ? n.cases.flatMap((c) => c.consequent)
        : n.type === 'ForStatement'
          ? [n.init]
          : n.type === 'ForInStatement' || n.type === 'ForOfStatement'
            ? [n.left]
            : [];
  return statements.flatMap((stmt) => {
    if (stmt?.type === 'VariableDeclaration' && stmt.kind !== 'var') return stmt.declarations.flatMap((d) => patternNames(d.id));
    if ((stmt?.type === 'FunctionDeclaration' || stmt?.type === 'ClassDeclaration') && stmt.id) return [stmt.id.name];
    return [];
  });
}

/**
 * Every top-level name `program` assigns to, `=`, `+=`, `++` or a `for…in`/`for…of` head, at any depth, leaving out
 * an assignment to an inner scope's own variable of that name.
 */
function assignedNames(program: t.Program): Set<string> {
  const out = new Set<string>();
  const visit = (value: unknown, hidden: ReadonlySet<string>): void => {
    if (Array.isArray(value)) return value.forEach((v) => visit(v, hidden));
    if (!isNode(value)) return;
    const n = value;
    const inner = scopeNames(n);
    const scope = inner.length === 0 ? hidden : new Set([...hidden, ...inner]);
    const add = (names: string[]) => names.forEach((name) => scope.has(name) || out.add(name));
    if (n.type === 'AssignmentExpression') add(patternNames(n.left as t.LVal));
    else if (n.type === 'UpdateExpression' && n.argument.type === 'Identifier') add([n.argument.name]);
    else if ((n.type === 'ForInStatement' || n.type === 'ForOfStatement') && n.left.type !== 'VariableDeclaration') {
      add(patternNames(n.left));
    }
    for (const child of childrenOf(n)) visit(child, scope);
  };
  visit(program, new Set());
  return out;
}

export function patternNames(node: t.LVal | t.ObjectProperty['value'] | null | undefined): string[] {
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

/** The name a call's callee is written as: `meta`, or `forge.meta` off a namespace import. */
export function calleeName(callee: t.Node): string | undefined {
  if (callee.type === 'Identifier') return callee.name;
  if (callee.type !== 'MemberExpression' || callee.computed) return undefined;
  return callee.object.type === 'Identifier' && callee.property.type === 'Identifier' ? `${callee.object.name}.${callee.property.name}` : undefined;
}

/** The name an identifier or a chain of plain member accesses off one is written as: `Tabs` or `Tabs.Panel`. */
export function dottedName(node: t.Node): string | undefined {
  if (node.type === 'Identifier') return node.name;
  if (node.type !== 'MemberExpression' || node.computed || node.property.type !== 'Identifier') return undefined;
  const object = dottedName(node.object);
  return object === undefined ? undefined : `${object}.${node.property.name}`;
}

/** The name `node` calls, as `calleeName` writes it, through casts and top-level `const`s. */
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
      return calleeName(node.callee);
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
      return wrappers.has(calleeName(node.callee) ?? '')
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
 * The value `obj` holds at `key`, as an object literal evaluates: the last property naming it (a method or accessor
 * answers itself, which reads as no literal), or what a spread after it carries, read through `bindings` and
 * `wrappers`. A computed key reads as its string when it is a literal one. A spread or a computed key it cannot read
 * is taken to set nothing.
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
    const name = p.computed ? stringLiteral(p.key) : p.key.type === 'Identifier' ? p.key.name : p.key.type === 'StringLiteral' ? p.key.value : null;
    if (name === key) return p.type === 'ObjectProperty' ? p.value : p;
  }
  return ABSENT;
}
