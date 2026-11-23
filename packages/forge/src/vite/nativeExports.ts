import type * as t from '@babel/types';
import { getOwn } from './ownKeys.ts';
import { type Bindings, isLiteralValue } from './ast.ts';

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
  wrappers: ReadonlySet<string>;
  imports: ReadonlySet<string>;
  foreign?: Foreign;
}

/** Whether any `return` of `statements`, through blocks and `if`s, may hand back a story. */
function returnsStory(statements: readonly t.Statement[], scope: Scope, depth: number): boolean {
  return statements.some((stmt) => {
    if (stmt.type === 'ReturnStatement') return mayBeStory(stmt.argument ?? undefined, scope, depth);
    if (stmt.type === 'BlockStatement') return returnsStory(stmt.body, scope, depth);
    if (stmt.type !== 'IfStatement') return false;
    return returnsStory([stmt.consequent, ...(stmt.alternate ? [stmt.alternate] : [])], scope, depth);
  });
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
      if (callee.type !== 'Identifier') return false;
      if (scope.wrappers.has(callee.name)) return true;
      const fn = scope.bindings.get(callee.name);
      if (isFn(fn)) return mayReturnStory(fn, scope, depth);
      if (scope.bindings.has(callee.name)) return !isLiteralValue(fn, scope.bindings);
      return scope.foreign?.call(callee.name) ?? false;
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
