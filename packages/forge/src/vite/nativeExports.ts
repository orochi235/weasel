import type * as t from '@babel/types';
import { type Bindings, isLiteralValue } from './ast.ts';

type Fn = t.ArrowFunctionExpression | t.FunctionExpression | t.FunctionDeclaration;

const isFn = (node: t.Node | undefined): node is Fn =>
  node?.type === 'ArrowFunctionExpression' || node?.type === 'FunctionExpression' || node?.type === 'FunctionDeclaration';

/** Whether any `return` of `statements`, through blocks and `if`s, may hand back a story. */
function returnsStory(statements: readonly t.Statement[], bindings: Bindings, wrappers: ReadonlySet<string>, depth: number): boolean {
  return statements.some((stmt) => {
    if (stmt.type === 'ReturnStatement') return mayBeStory(stmt.argument ?? undefined, bindings, wrappers, depth);
    if (stmt.type === 'BlockStatement') return returnsStory(stmt.body, bindings, wrappers, depth);
    if (stmt.type !== 'IfStatement') return false;
    return returnsStory([stmt.consequent, ...(stmt.alternate ? [stmt.alternate] : [])], bindings, wrappers, depth);
  });
}

/**
 * Whether a native file's export may be what forge's `story` returned, which is all the loader takes. A call is one
 * only when it calls `story`, or a function of this file that returns such a call; a value written out is not. What
 * cannot be read here stays in: an import, a re-export, a spread that can carry a story's brand into the copy.
 */
export function mayBeStory(node: t.Node | undefined, bindings: Bindings, wrappers: ReadonlySet<string>, depth = 0): boolean {
  if (!node) return true;
  if (depth > 16) return false;
  switch (node.type) {
    case 'TSSatisfiesExpression':
    case 'TSAsExpression':
    case 'TSTypeAssertion':
    case 'TSNonNullExpression':
    case 'ParenthesizedExpression':
      return mayBeStory(node.expression, bindings, wrappers, depth + 1);
    case 'Identifier':
      return mayBeStory(bindings.get(node.name), bindings, wrappers, depth + 1);
    case 'CallExpression': {
      if (node.callee.type !== 'Identifier') return false;
      if (wrappers.has(node.callee.name)) return true;
      const fn = bindings.get(node.callee.name);
      if (!isFn(fn)) return false;
      return fn.body.type === 'BlockStatement'
        ? returnsStory(fn.body.body, bindings, wrappers, depth + 1)
        : mayBeStory(fn.body, bindings, wrappers, depth + 1);
    }
    default:
      return !isLiteralValue(node, bindings);
  }
}
