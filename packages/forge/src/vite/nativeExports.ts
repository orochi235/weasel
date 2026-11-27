import type * as t from '@babel/types';
import { getOwn } from './ownKeys.ts';
import { type Bindings, calleeName, isLiteralValue, patternNames, stringLiteral, type Wrappers } from './ast.ts';

type Fn = t.ArrowFunctionExpression | t.FunctionExpression | t.FunctionDeclaration;

export const isFn = (node: t.Node | undefined): node is Fn =>
  node?.type === 'ArrowFunctionExpression' || node?.type === 'FunctionExpression' || node?.type === 'FunctionDeclaration';

/** What following a file's imports found, by local name; a name it could not decide is absent. */
export interface ForeignStories {
  /** Whether the import is a story. */
  values: Record<string, boolean>;
  /** Whether calling the import returns a story. */
  calls: Record<string, boolean>;
  /** Whether a name re-exported from another module is a story, by exported name. */
  reexports: Record<string, boolean>;
}

/** `ForeignStories` as it is asked; `undefined` is "not known". */
export interface Foreign {
  value(name: string): boolean | undefined;
  call(name: string): boolean | undefined;
  reexport(name: string): boolean | undefined;
}

export const foreignFrom = (known: ForeignStories): Foreign => ({
  value: (name) => getOwn(known.values, name),
  call: (name) => getOwn(known.calls, name),
  reexport: (name) => getOwn(known.reexports, name),
});

/** What a file is read against: its top-level bindings, its callees that are forge's, its imports, and what they are. */
export interface Scope {
  bindings: Bindings;
  wrappers: Wrappers;
  imports: ReadonlySet<string>;
  foreign?: Foreign;
  /** Names a function being read binds itself, which shadow the file's and read as unknown. */
  locals?: ReadonlySet<string>;
}

/** The statements `stmt` runs inside it whose `return`s are its function's. */
function innerStatements(stmt: t.Statement): t.Statement[] {
  switch (stmt.type) {
    case 'BlockStatement':
      return stmt.body;
    case 'IfStatement':
      return [stmt.consequent, ...(stmt.alternate ? [stmt.alternate] : [])];
    case 'TryStatement':
      return [stmt.block, ...(stmt.handler ? [stmt.handler.body] : []), ...(stmt.finalizer ? [stmt.finalizer] : [])];
    case 'SwitchStatement':
      return stmt.cases.flatMap((c) => c.consequent);
    case 'ForStatement':
    case 'ForInStatement':
    case 'ForOfStatement':
    case 'WhileStatement':
    case 'DoWhileStatement':
    case 'LabeledStatement':
    case 'WithStatement':
      return [stmt.body];
    default:
      return [];
  }
}

/** The names `stmts` declare, through every statement that nests others but not inside a nested function. */
function declaredIn(stmts: readonly t.Statement[]): string[] {
  return stmts.flatMap((stmt): string[] => {
    switch (stmt.type) {
      case 'VariableDeclaration':
        return stmt.declarations.flatMap((d) => patternNames(d.id));
      case 'FunctionDeclaration':
      case 'ClassDeclaration':
        return stmt.id ? [stmt.id.name] : [];
      case 'ForStatement':
        return [...(stmt.init?.type === 'VariableDeclaration' ? declaredIn([stmt.init]) : []), ...declaredIn([stmt.body])];
      case 'ForInStatement':
      case 'ForOfStatement':
        return [...(stmt.left.type === 'VariableDeclaration' ? declaredIn([stmt.left]) : []), ...declaredIn([stmt.body])];
      case 'TryStatement':
        return [...patternNames(stmt.handler?.param), ...declaredIn(innerStatements(stmt))];
      default:
        return declaredIn(innerStatements(stmt));
    }
  });
}

/** The names `fn` binds itself: its own name, its parameters, and what its body declares. */
function namesBoundBy(fn: Fn): string[] {
  const own = fn.type !== 'ArrowFunctionExpression' && fn.id ? [fn.id.name] : [];
  const params = fn.params.flatMap((p) => patternNames(p));
  return [...own, ...params, ...(fn.body.type === 'BlockStatement' ? declaredIn(fn.body.body) : [])];
}

/** `scope` inside `fn`, where each name `fn` binds hides the file's binding, forge callee, or import of that name. */
function scopeInside(fn: Fn, scope: Scope): Scope {
  const names = namesBoundBy(fn);
  if (names.length === 0) return scope;
  const locals = new Set([...(scope.locals ?? []), ...names]);
  const bindings: Bindings = new Map([...scope.bindings].filter(([name]) => !locals.has(name)));
  const wrappers = new Map([...scope.wrappers].filter(([name]) => !locals.has(name.split('.')[0] ?? name)));
  return { ...scope, bindings, wrappers, locals };
}

/** Whether any `return` of `statements`, through every statement that nests others, may hand back a story; a bare `return` cannot. */
function returnsStory(statements: readonly t.Statement[], scope: Scope, depth: number): boolean {
  return statements.some((stmt) =>
    stmt.type === 'ReturnStatement'
      ? stmt.argument != null && mayBeStory(stmt.argument, scope, depth)
      : returnsStory(innerStatements(stmt), scope, depth),
  );
}

const isGlobal = (node: t.Node, scope: Scope): boolean =>
  node.type === 'Identifier' && !scope.bindings.has(node.name) && !scope.imports.has(node.name) && !scope.locals?.has(node.name);

/** `Object`'s methods that hand back the object they are given first. */
const PASS_THROUGH = new Set(['freeze', 'seal', 'preventExtensions', 'defineProperty', 'defineProperties', 'setPrototypeOf']);

/** The name a member expression reads, written as `.name` or `['name']`. */
const memberName = (node: t.MemberExpression): string | undefined =>
  node.computed ? stringLiteral(node.property) : node.property.type === 'Identifier' ? node.property.name : undefined;

/** What an `Object.assign` call copies from, or what a pass-through `Object` call hands back; else null. */
function objectCallSources(node: t.CallExpression, scope: Scope): readonly t.Node[] | null {
  const { callee } = node;
  if (callee.type !== 'MemberExpression') return null;
  if (callee.object.type !== 'Identifier' || callee.object.name !== 'Object' || !isGlobal(callee.object, scope)) return null;
  const name = memberName(callee);
  if (name === 'assign') return node.arguments;
  return name !== undefined && PASS_THROUGH.has(name) ? node.arguments.slice(0, 1) : null;
}

/** Whether calling `fn` may hand back a story. */
export function mayReturnStory(fn: Fn, outer: Scope, depth = 0): boolean {
  const scope = scopeInside(fn, outer);
  return fn.body.type === 'BlockStatement' ? returnsStory(fn.body.body, scope, depth + 1) : mayBeStory(fn.body, scope, depth + 1);
}

/** Whether calling `node`, the value a callee is bound to, may hand back a story: a function by what it returns, else by whether a call made it. */
export function mayCallStory(node: t.Node | undefined, scope: Scope, depth = 0): boolean {
  return isFn(node) ? mayReturnStory(node, scope, depth) : !isLiteralValue(node, scope.bindings);
}

/**
 * Whether a native file's export may be what forge's `story` returned, which is all the loader takes. A call is one
 * when it calls `story` or a function that returns such a call; a value written out is not, and a copy (a spread,
 * `Object.assign`, or an `Object` method like `freeze` that hands back its first argument) or a choice is one when
 * something it copies or chooses from is. What cannot be read stays in: an import
 * nothing resolved, a method of anything but a literal or a global, a function a call made, a chain longer than it
 * follows.
 */
export function mayBeStory(node: t.Node | undefined, scope: Scope, depth = 0): boolean {
  if (!node || depth > 16) return true;
  switch (node.type) {
    case 'TSSatisfiesExpression':
    case 'TSAsExpression':
    case 'TSTypeAssertion':
    case 'TSNonNullExpression':
    case 'ParenthesizedExpression':
      return mayBeStory(node.expression, scope, depth + 1);
    case 'Identifier':
      if (scope.locals?.has(node.name)) return true;
      return scope.bindings.has(node.name)
        ? mayBeStory(scope.bindings.get(node.name), scope, depth + 1)
        : (scope.foreign?.value(node.name) ?? true);
    case 'CallExpression': {
      const { callee } = node;
      const sources = objectCallSources(node, scope);
      if (sources) return sources.some((arg) => mayBeStory(arg, scope, depth + 1));
      const wrapper = scope.wrappers.get(calleeName(callee) ?? '');
      if (wrapper) return wrapper === 'story';
      if (callee.type === 'MemberExpression') return !isLiteralValue(callee.object, scope.bindings) && !isGlobal(callee.object, scope);
      if (isFn(callee)) return mayReturnStory(callee, scope, depth);
      if (callee.type !== 'Identifier') return !isLiteralValue(callee, scope.bindings);
      if (scope.bindings.has(callee.name)) return mayCallStory(scope.bindings.get(callee.name), scope, depth);
      return scope.locals?.has(callee.name) || (scope.foreign?.call(callee.name) ?? true);
    }
    case 'ConditionalExpression':
      return mayBeStory(node.consequent, scope, depth + 1) || mayBeStory(node.alternate, scope, depth + 1);
    case 'LogicalExpression':
      return mayBeStory(node.left, scope, depth + 1) || mayBeStory(node.right, scope, depth + 1);
    case 'ObjectExpression':
      // A spread carries a story's brand into the copy.
      return node.properties.some((p) => p.type === 'SpreadElement' && mayBeStory(p.argument, scope, depth + 1));
    default:
      return !isLiteralValue(node, scope.bindings);
  }
}
