import type { Program } from 'oxc-parser';
import { child, childKeys } from './walk.ts';

interface Node {
  readonly type: string;
  readonly [key: string]: unknown;
}

type Scope = ReadonlySet<string>;

const FUNCTIONS = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
  // Bodiless: an overload, a `declare function` and an abstract or overloaded method.
  'TSDeclareFunction',
  'TSEmptyBodyFunctionExpression',
]);
/** Nodes a `var` does not hoist out of. */
const VAR_BARRIERS = new Set([...FUNCTIONS, 'ClassBody', 'StaticBlock', 'TSModuleDeclaration']);
/** Bodies that are a `var` scope of their own, as a function body is. */
const VAR_SCOPES = new Set(['StaticBlock', 'TSModuleBlock']);
const LEXICAL_DECLARATIONS = new Set(['ClassDeclaration', 'FunctionDeclaration', 'TSDeclareFunction', 'TSEnumDeclaration', 'TSModuleDeclaration', 'TSImportEqualsDeclaration']);

const isNode = (value: unknown): value is Node =>
  value !== null && typeof value === 'object' && typeof (value as { type?: unknown }).type === 'string';

/** Every name a binding pattern declares. */
function bindingNames(pattern: unknown, out: string[] = []): string[] {
  if (!isNode(pattern)) return out;
  switch (pattern.type) {
    case 'Identifier':
      out.push(pattern.name as string);
      break;
    case 'ObjectPattern':
      for (const p of pattern.properties as Node[]) bindingNames(p.type === 'RestElement' ? p : p.value, out);
      break;
    case 'ArrayPattern':
      for (const e of pattern.elements as unknown[]) bindingNames(e, out);
      break;
    case 'RestElement':
      bindingNames(pattern.argument, out);
      break;
    case 'AssignmentPattern':
      bindingNames(pattern.left, out);
      break;
    case 'TSParameterProperty':
      bindingNames(pattern.parameter, out);
      break;
  }
  return out;
}

const declaratorNames = (decl: Node) => (decl.declarations as Node[]).flatMap((d) => bindingNames(d.id));

/** The names `let`, `const`, `class` and `function` declarations directly in `statements` bind, exported ones included. */
function lexicalNames(statements: readonly Node[]): string[] {
  const out: string[] = [];
  for (const statement of statements) {
    const s = statement.type === 'ExportNamedDeclaration' && isNode(statement.declaration) ? statement.declaration : statement;
    if (s.type === 'VariableDeclaration' && s.kind !== 'var') out.push(...declaratorNames(s));
    else if (LEXICAL_DECLARATIONS.has(s.type) && isNode(s.id) && s.id.type === 'Identifier') out.push(s.id.name as string);
  }
  return out;
}

/** The names `var` declarations anywhere in a function body bind, nested functions aside. */
function varNames(node: unknown, out: string[] = []): string[] {
  if (Array.isArray(node)) {
    for (const n of node) varNames(n, out);
    return out;
  }
  if (!isNode(node) || VAR_BARRIERS.has(node.type)) return out;
  if (node.type === 'VariableDeclaration' && node.kind === 'var') out.push(...declaratorNames(node));
  for (const key of childKeys(node.type)) varNames(child(node, key), out);
  return out;
}

/** Nodes whose non-computed `key` names a property, not a binding. */
const KEYED = new Set([
  'Property',
  'MethodDefinition',
  'PropertyDefinition',
  'AccessorProperty',
  'TSAbstractMethodDefinition',
  'TSAbstractPropertyDefinition',
  'TSAbstractAccessorProperty',
  'TSPropertySignature',
  'TSMethodSignature',
]);
/** Type-level nodes and module syntax the caller reads itself: no value reference sits under them. */
const OPAQUE = new Set([
  'ImportDeclaration',
  'ExportAllDeclaration',
  'MetaProperty',
  'TSTypeAnnotation',
  'TSTypeAliasDeclaration',
  'TSInterfaceDeclaration',
  'TSTypeParameterDeclaration',
  'TSTypeParameterInstantiation',
  'TSClassImplements',
  'TSIndexSignature',
  'JSXClosingElement',
]);
/** Keys holding a bare type, or a name that is no reference, under a node that is otherwise read. */
const NON_VALUE_KEYS: Record<string, ReadonlySet<string>> = {
  TSAsExpression: new Set(['typeAnnotation']),
  TSSatisfiesExpression: new Set(['typeAnnotation']),
  TSTypeAssertion: new Set(['typeAnnotation']),
  TSEnumMember: new Set(['id']),
  JSXAttribute: new Set(['name']),
};

/** The value a JSX element name reads, if any: the root of a member name, or an identifier that is not an intrinsic tag. */
function jsxReference(name: Node): Node | undefined {
  let n = name;
  while (n.type === 'JSXMemberExpression') n = n.object as Node;
  if (n.type !== 'JSXIdentifier') return undefined;
  return n === name && /^[a-z]|-/.test(n.name as string) ? undefined : n;
}
const LABELED = new Set(['LabeledStatement', 'BreakStatement', 'ContinueStatement']);
const one = (key: string): ReadonlySet<string> => new Set([key]);

/** The identifier a callee names through any parentheses and non-null assertions around it. */
function calleeName(callee: Node): string | undefined {
  let n = callee;
  while (n.type === 'ParenthesizedExpression' || n.type === 'TSNonNullExpression') n = n.expression as Node;
  return n.type === 'Identifier' ? (n.name as string) : undefined;
}

/**
 * Calls `onCall` on each call whose callee is one of `names` and resolves to the module-level
 * binding, and `onOther` on each other value reference to that binding: a parameter or local
 * declaration of the same name in an enclosing scope hides it. Export specifiers are left to the caller.
 */
export function unshadowedUses(
  program: Program,
  names: ReadonlySet<string>,
  onCall: (node: Node, name: string) => void,
  onOther: (node: Node) => void,
): void {
  const scope = (outer: Scope, declared: readonly string[]): Scope => {
    const hidden = declared.filter((n) => names.has(n) && !outer.has(n));
    return hidden.length === 0 ? outer : new Set([...outer, ...hidden]);
  };
  const children = (node: Node, hidden: Scope, skip?: ReadonlySet<string>) => {
    for (const key of childKeys(node.type)) if (!skip?.has(key)) visit(child(node, key), hidden);
  };
  const visit = (value: unknown, hidden: Scope): void => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item, hidden);
      return;
    }
    if (!isNode(value)) return;
    const node = value;
    if (OPAQUE.has(node.type)) return;
    const resolves = (name: string | undefined): name is string => name !== undefined && names.has(name) && !hidden.has(name);
    if (node.type === 'Identifier') {
      if (resolves(node.name as string)) onOther(node);
      return children(node, hidden);
    }
    if (FUNCTIONS.has(node.type)) {
      const self = node.type === 'FunctionExpression' && isNode(node.id) ? [node.id.name as string] : [];
      const params = scope(hidden, [...self, ...(node.params as Node[]).flatMap((p) => bindingNames(p))]);
      visit(node.params, params);
      const body = node.body as Node | null;
      if (body?.type === 'BlockStatement') {
        visit(body.body, scope(params, [...varNames(body.body), ...lexicalNames(body.body as Node[])]));
      } else visit(body, params);
      return;
    }
    switch (node.type) {
      case 'CallExpression': {
        const name = calleeName(node.callee as Node);
        if (!resolves(name)) break;
        onCall(node, name);
        return children(node, hidden, one('callee'));
      }
      case 'MemberExpression':
        return children(node, hidden, node.computed ? undefined : one('property'));
      case 'ExportNamedDeclaration':
        return children(node, hidden, one('specifiers'));
      case 'ExportDefaultDeclaration':
        if ((node.declaration as Node).type === 'Identifier') return;
        break;
      case 'TSModuleDeclaration':
        return children(node, hidden, one('id'));
      case 'JSXOpeningElement': {
        const ref = jsxReference(node.name as Node);
        if (ref && resolves(ref.name as string)) onOther(ref);
        return children(node, hidden, one('name'));
      }
      case 'BlockStatement':
      case 'StaticBlock':
      case 'TSModuleBlock': {
        const body = node.body as Node[];
        const vars = VAR_SCOPES.has(node.type) ? varNames(body) : [];
        return visit(body, scope(hidden, [...vars, ...lexicalNames(body)]));
      }
      case 'SwitchStatement': {
        visit(node.discriminant, hidden);
        const cases = node.cases as Node[];
        return visit(cases, scope(hidden, lexicalNames(cases.flatMap((c) => c.consequent as Node[]))));
      }
      case 'ForStatement':
      case 'ForInStatement':
      case 'ForOfStatement': {
        const head = (node.type === 'ForStatement' ? node.init : node.left) as Node | null;
        if (head?.type === 'VariableDeclaration' && head.kind !== 'var') return children(node, scope(hidden, declaratorNames(head)));
        break;
      }
      case 'CatchClause':
        return children(node, scope(hidden, bindingNames(node.param)));
      case 'ClassExpression':
        if (isNode(node.id)) return children(node, scope(hidden, [node.id.name as string]));
        break;
    }
    if (Object.hasOwn(NON_VALUE_KEYS, node.type)) return children(node, hidden, NON_VALUE_KEYS[node.type]);
    if (KEYED.has(node.type) && !node.computed) return children(node, hidden, one('key'));
    if (LABELED.has(node.type)) return children(node, hidden, one('label'));
    children(node, hidden);
  };
  visit(program.body, new Set());
}
