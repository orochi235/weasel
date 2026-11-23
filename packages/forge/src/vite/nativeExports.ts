import type * as t from '@babel/types';
import { getOwn } from './ownKeys.ts';
import { type Bindings, isLiteralValue, type Wrappers } from './ast.ts';

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

/** Whether any `return` of `statements`, through every statement that nests others, may hand back a story. */
function returnsStory(statements: readonly t.Statement[], scope: Scope, depth: number): boolean {
  return statements.some((stmt) =>
    stmt.type === 'ReturnStatement' ? mayBeStory(stmt.argument ?? undefined, scope, depth) : returnsStory(innerStatements(stmt), scope, depth),
  );
}

const isGlobal = (node: t.Node, scope: Scope): boolean =>
  node.type === 'Identifier' && !scope.bindings.has(node.name) && !scope.imports.has(node.name);

const isObjectAssign = (callee: t.Node, scope: Scope): boolean =>
  callee.type === 'MemberExpression' &&
  isGlobal(callee.object, scope) &&
  callee.object.type === 'Identifier' &&
  callee.object.name === 'Object' &&
  !callee.computed &&
  callee.property.type === 'Identifier' &&
  callee.property.name === 'assign';

/** Whether calling `fn` may hand back a story. */
export function mayReturnStory(fn: Fn, scope: Scope, depth = 0): boolean {
  return fn.body.type === 'BlockStatement' ? returnsStory(fn.body.body, scope, depth + 1) : mayBeStory(fn.body, scope, depth + 1);
}

/** Whether calling `node`, the value a callee is bound to, may hand back a story: a function by what it returns, else by whether a call made it. */
export function mayCallStory(node: t.Node | undefined, scope: Scope, depth = 0): boolean {
  return isFn(node) ? mayReturnStory(node, scope, depth) : !isLiteralValue(node, scope.bindings);
}

/**
 * Whether a native file's export may be what forge's `story` returned, which is all the loader takes. A call is one
 * when it calls `story` or a function that returns such a call; a value written out is not, and a copy (a spread or
 * `Object.assign`) or a choice is one when something it copies or chooses from is. What cannot be read stays in: an
 * import nothing resolved, a method of anything but a literal or a global, a function a call made.
 */
export function mayBeStory(node: t.Node | undefined, scope: Scope, depth = 0): boolean {
  if (!node) return true;
  if (depth > 16) return false;
  switch (node.type) {
    case 'TSSatisfiesExpression':
    case 'TSAsExpression':
    case 'TSTypeAssertion':
    case 'TSNonNullExpression':
    case 'ParenthesizedExpression':
      return mayBeStory(node.expression, scope, depth + 1);
    case 'Identifier':
      return scope.bindings.has(node.name)
        ? mayBeStory(scope.bindings.get(node.name), scope, depth + 1)
        : (scope.foreign?.value(node.name) ?? true);
    case 'CallExpression': {
      const { callee } = node;
      if (isObjectAssign(callee, scope)) return node.arguments.some((arg) => mayBeStory(arg, scope, depth + 1));
      if (callee.type === 'MemberExpression') return !isLiteralValue(callee.object, scope.bindings) && !isGlobal(callee.object, scope);
      if (isFn(callee)) return mayReturnStory(callee, scope, depth);
      if (callee.type !== 'Identifier') return !isLiteralValue(callee, scope.bindings);
      if (scope.wrappers.has(callee.name)) return scope.wrappers.get(callee.name) === 'story';
      if (scope.bindings.has(callee.name)) return mayCallStory(scope.bindings.get(callee.name), scope, depth);
      return scope.foreign?.call(callee.name) ?? true;
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
