import { visitorKeys, type Program } from 'oxc-parser';

interface Node {
  readonly type: string;
  readonly [key: string]: unknown;
}

type Scope = ReadonlySet<string>;

const FUNCTIONS = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);
/** Nodes a `var` does not hoist out of. */
const VAR_BARRIERS = new Set([...FUNCTIONS, 'ClassBody', 'TSModuleDeclaration']);
const LEXICAL_DECLARATIONS = new Set(['ClassDeclaration', 'FunctionDeclaration', 'TSEnumDeclaration', 'TSModuleDeclaration']);

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

/** The names `let`, `const`, `class` and `function` declarations directly in `statements` bind. */
function lexicalNames(statements: readonly Node[]): string[] {
  const out: string[] = [];
  for (const s of statements) {
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
  for (const key of visitorKeys[node.type] ?? []) varNames(node[key], out);
  return out;
}

/**
 * Calls `onCall` on each call whose callee is one of `names` and resolves to the module-level
 * binding: a parameter or local declaration of the same name in an enclosing scope hides it.
 */
export function unshadowedCalls(program: Program, names: ReadonlySet<string>, onCall: (node: Node) => void): void {
  const scope = (outer: Scope, declared: readonly string[]): Scope => {
    const hidden = declared.filter((n) => names.has(n) && !outer.has(n));
    return hidden.length === 0 ? outer : new Set([...outer, ...hidden]);
  };
  const children = (node: Node, hidden: Scope, skip?: ReadonlySet<string>) => {
    for (const key of visitorKeys[node.type] ?? []) if (!skip?.has(key)) visit(node[key], hidden);
  };
  const visit = (value: unknown, hidden: Scope): void => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item, hidden);
      return;
    }
    if (!isNode(value)) return;
    const node = value;
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
        const callee = node.callee as Node;
        if (callee.type === 'Identifier' && names.has(callee.name as string) && !hidden.has(callee.name as string)) onCall(node);
        break;
      }
      case 'BlockStatement':
      case 'StaticBlock':
        return visit(node.body, scope(hidden, lexicalNames(node.body as Node[])));
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
    children(node, hidden);
  };
  visit(program.body, new Set());
}
