import type * as t from '@babel/types';
import { patternNames } from './ast.ts';

/** Keys holding types, which name no value a component could render. */
const TYPE_KEYS = new Set(['typeAnnotation', 'typeParameters', 'typeArguments', 'returnType', 'superTypeParameters', 'implements']);
const SKIPPED_KEYS = new Set(['leadingComments', 'trailingComments', 'innerComments', 'loc', 'start', 'end', 'extra', 'range']);

type Names = ReadonlySet<string>;

const isNode = (value: unknown): value is t.Node =>
  !!value && typeof value === 'object' && typeof (value as { type?: unknown }).type === 'string';

const isFunction = (n: t.Node): n is t.Function =>
  n.type === 'FunctionDeclaration' ||
  n.type === 'FunctionExpression' ||
  n.type === 'ArrowFunctionExpression' ||
  n.type === 'ObjectMethod' ||
  n.type === 'ClassMethod' ||
  n.type === 'ClassPrivateMethod';

const plus = (names: Names, more: Iterable<string>): Names => {
  const out = new Set(names);
  for (const name of more) out.add(name);
  return out;
};

/** The names `let`, `const`, `class` and `function` declare directly in `statements`, which shadow for the block. */
function lexicalNames(statements: readonly t.Node[]): string[] {
  return statements.flatMap((s) => {
    if (s.type === 'VariableDeclaration' && s.kind !== 'var') return s.declarations.flatMap((d) => patternNames(d.id));
    if ((s.type === 'FunctionDeclaration' || s.type === 'ClassDeclaration') && s.id) return [s.id.name];
    return [];
  });
}

/** The names `var` declares anywhere in `node` short of a nested function, which shadow for the whole function. */
function varNames(node: unknown): string[] {
  if (Array.isArray(node)) return node.flatMap(varNames);
  if (!isNode(node) || isFunction(node) || node.type.startsWith('TS')) return [];
  if (node.type === 'VariableDeclaration' && node.kind === 'var') return node.declarations.flatMap((d) => patternNames(d.id));
  if (!/Statement$|Clause$|Declaration$|^SwitchCase$/.test(node.type)) return [];
  return Object.entries(node).flatMap(([k, child]) => (SKIPPED_KEYS.has(k) ? [] : varNames(child)));
}

/**
 * Every name `node` refers to as a value and does not declare itself, JSX tags included: a parameter, an inner
 * `const` or a catch binding shadows a top-level name of the same spelling. Types and property names are left out.
 */
export function freeNames(node: t.Node): Set<string> {
  const out = new Set<string>();

  const pattern = (p: t.Node | null | undefined, scope: Names): void => {
    switch (p?.type) {
      case 'ObjectPattern':
        for (const prop of p.properties) {
          if (prop.type === 'RestElement') pattern(prop.argument, scope);
          else {
            if (prop.computed) walk(prop.key, scope);
            pattern(prop.value, scope);
          }
        }
        return;
      case 'ArrayPattern':
        for (const e of p.elements) pattern(e, scope);
        return;
      case 'RestElement':
        return pattern(p.argument, scope);
      case 'AssignmentPattern':
        pattern(p.left, scope);
        return walk(p.right, scope);
      case 'TSParameterProperty':
        return pattern(p.parameter, scope);
      case 'Identifier':
      case undefined:
        return;
      default:
        return walk(p, scope);
    }
  };

  const children = (n: t.Node, scope: Names): void => {
    for (const [k, child] of Object.entries(n)) {
      if (SKIPPED_KEYS.has(k) || TYPE_KEYS.has(k)) continue;
      if ((n.type === 'MemberExpression' || n.type === 'OptionalMemberExpression') && k === 'property' && !n.computed) continue;
      if (n.type === 'JSXMemberExpression' && k === 'property') continue;
      if ((n.type === 'ObjectProperty' || n.type === 'ClassProperty' || n.type === 'ClassAccessorProperty') && k === 'key' && !n.computed) continue;
      if (n.type === 'JSXAttribute' && k === 'name') continue;
      walk(child, scope);
    }
  };

  const walk = (value: unknown, scope: Names): void => {
    if (Array.isArray(value)) {
      for (const item of value) walk(item, scope);
      return;
    }
    if (!isNode(value)) return;
    const n = value;
    if (n.type.startsWith('TS') && !('expression' in n)) return;
    if (isFunction(n)) {
      if ((n.type === 'ObjectMethod' || n.type === 'ClassMethod') && n.computed) walk(n.key, scope);
      const own = n.type === 'FunctionExpression' && n.id ? [n.id.name] : [];
      const inner = plus(scope, [...own, ...n.params.flatMap((p) => patternNames(p.type === 'TSParameterProperty' ? p.parameter : p)), ...varNames(n.body)]);
      for (const p of n.params) pattern(p, inner);
      walk(n.body, inner);
      return;
    }
    switch (n.type) {
      case 'Identifier':
      case 'JSXIdentifier':
        if (!scope.has(n.name)) out.add(n.name);
        return;
      case 'BlockStatement':
      case 'StaticBlock':
        return walk(n.body, plus(scope, lexicalNames(n.body)));
      case 'SwitchStatement': {
        walk(n.discriminant, scope);
        return walk(n.cases, plus(scope, lexicalNames(n.cases.flatMap((c) => c.consequent))));
      }
      case 'ForStatement':
      case 'ForInStatement':
      case 'ForOfStatement': {
        const head = n.type === 'ForStatement' ? n.init : n.left;
        return children(n, head?.type === 'VariableDeclaration' && head.kind !== 'var' ? plus(scope, lexicalNames([head])) : scope);
      }
      case 'CatchClause': {
        const inner = plus(scope, patternNames(n.param));
        pattern(n.param, inner);
        return walk(n.body, inner);
      }
      case 'ClassExpression':
        return children(n, n.id ? plus(scope, [n.id.name]) : scope);
      case 'VariableDeclarator':
        pattern(n.id, scope);
        return walk(n.init, scope);
      case 'LabeledStatement':
        return walk(n.body, scope);
      case 'BreakStatement':
      case 'ContinueStatement':
      case 'PrivateName':
        return;
      default:
        return children(n, scope);
    }
  };

  walk(node, new Set());
  return out;
}
