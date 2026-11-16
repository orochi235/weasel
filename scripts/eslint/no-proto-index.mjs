/**
 * Reports `record[key]` and `record[key] = value` where `record`'s type has a `string` index signature and
 * `key` is typed `string`. Such a read goes through `Object.prototype`, so a key from a user, a file or a
 * schema that names `toString` or `constructor` finds a built-in function, and a write to `__proto__` changes
 * the prototype instead. A key typed as a union of literals, a `Map`, an array and a numeric index are not
 * reported, and neither is an access guarded by an own-key test (a write, by `key !== '__proto__'`) or keyed by
 * the record's own keys.
 *
 * Type-aware: the decision is `protoIndexAccess`, on TypeScript's own nodes, so a script can run it outside
 * ESLint over a whole program.
 */
import ts from 'typescript';

const OWN_TESTS = new Set(['hasOwnKey', 'hasOwn', 'hasOwnProperty']);
const KEY_LISTS = new Set(['keys', 'entries', 'getOwnPropertyNames']);
const ITERATORS = new Set(['forEach', 'map', 'flatMap', 'filter', 'some', 'every', 'find', 'findIndex', 'reduce']);

const text = (node) => node.getText().replace(/\s+/g, '');
const unwrap = (node) => {
  while (ts.isParenthesizedExpression(node) || ts.isNonNullExpression(node) || ts.isAsExpression(node)
    || ts.isSatisfiesExpression(node)) node = node.expression;
  return node;
};

/** A key type that admits any string: `string` itself, or a union, intersection or constraint holding it. */
function admitsAnyString(checker, type) {
  if (type.flags & ts.TypeFlags.String) return true;
  if (type.flags & ts.TypeFlags.TypeParameter || type.flags & ts.TypeFlags.Index) {
    const constraint = checker.getBaseConstraintOfType(type);
    return constraint != null && constraint !== type && admitsAnyString(checker, constraint);
  }
  if (type.isUnion()) return type.types.some((t) => admitsAnyString(checker, t));
  if (type.isIntersection()) return type.types.some((t) => t.flags & ts.TypeFlags.String);
  return false;
}

/** A record type answering every string key: one with a `string` index signature, in any union member. */
function hasStringIndex(checker, type) {
  if (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) return false;
  const apparent = checker.getApparentType(checker.getNonNullableType(type));
  const members = apparent.isUnion() ? apparent.types : [apparent];
  return members.some((t) => checker.getIndexInfosOfType(t).some((info) => info.keyType.flags & ts.TypeFlags.String));
}

/** `Object.hasOwn(o, k)`, `hasOwnKey(o, k)`, `o.hasOwnProperty(k)` or `Object.prototype.hasOwnProperty.call(o, k)`. */
function ownTest(expr, obj, key) {
  expr = unwrap(expr);
  if (!ts.isCallExpression(expr)) return false;
  const callee = expr.expression;
  const name = ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : '';
  let args = expr.arguments.map((a) => text(unwrap(a)));
  if (name === 'call' && ts.isPropertyAccessExpression(callee) && text(callee.expression).endsWith('hasOwnProperty')) {
    return args[0] === obj && args[1] === key;
  }
  if (!OWN_TESTS.has(name)) return false;
  if (name === 'hasOwnProperty' && ts.isPropertyAccessExpression(callee)) args = [text(unwrap(callee.expression)), ...args];
  return args[0] === obj && args[1] === key;
}

/** `key !== '__proto__'` (or, with `negated`, `key === '__proto__'`): the one key a write may not take. */
function notProto(expr, key, negated) {
  if (!ts.isBinaryExpression(expr)) return false;
  const op = expr.operatorToken.kind;
  const sides = [expr.left, expr.right].map((n) => unwrap(n));
  const named = sides.some((n) => ts.isStringLiteralLike(n) && n.text === '__proto__') && sides.some((n) => text(n) === key);
  const differs = op === ts.SyntaxKind.ExclamationEqualsEqualsToken || op === ts.SyntaxKind.ExclamationEqualsToken;
  const same = op === ts.SyntaxKind.EqualsEqualsEqualsToken || op === ts.SyntaxKind.EqualsEqualsToken;
  return named && (negated ? same : differs);
}

/** Whether `expr` being true (or, with `negated`, false) makes `leaf` hold of one of its conjuncts. */
function asserts(expr, leaf, negated) {
  expr = unwrap(expr);
  if (ts.isPrefixUnaryExpression(expr) && expr.operator === ts.SyntaxKind.ExclamationToken) {
    return asserts(expr.operand, leaf, !negated);
  }
  if (ts.isBinaryExpression(expr)
    && expr.operatorToken.kind === (negated ? ts.SyntaxKind.BarBarToken : ts.SyntaxKind.AmpersandAmpersandToken)) {
    return asserts(expr.left, leaf, negated) || asserts(expr.right, leaf, negated);
  }
  return leaf(expr, negated);
}

const exits = (stmt) => {
  if (ts.isBlock(stmt)) return stmt.statements.length > 0 && exits(stmt.statements[stmt.statements.length - 1]);
  return ts.isReturnStatement(stmt) || ts.isThrowStatement(stmt) || ts.isContinueStatement(stmt) || ts.isBreakStatement(stmt);
};

/** A test on the path from `node` up to its function making `leaf` hold: an enclosing branch, or an earlier early exit. */
function guarded(node, leaf) {
  for (let child = node, parent = node.parent; parent; child = parent, parent = parent.parent) {
    if (ts.isIfStatement(parent) && child === parent.thenStatement && asserts(parent.expression, leaf, false)) return true;
    if (ts.isIfStatement(parent) && child === parent.elseStatement && asserts(parent.expression, leaf, true)) return true;
    if (ts.isConditionalExpression(parent) && child === parent.whenTrue && asserts(parent.condition, leaf, false)) return true;
    if (ts.isConditionalExpression(parent) && child === parent.whenFalse && asserts(parent.condition, leaf, true)) return true;
    if (ts.isBinaryExpression(parent) && child === parent.right) {
      const op = parent.operatorToken.kind;
      if (op === ts.SyntaxKind.AmpersandAmpersandToken && asserts(parent.left, leaf, false)) return true;
      if (op === ts.SyntaxKind.BarBarToken && asserts(parent.left, leaf, true)) return true;
    }
    if (ts.isBlock(parent) || ts.isSourceFile(parent) || ts.isCaseClause(parent) || ts.isDefaultClause(parent)) {
      for (const stmt of parent.statements) {
        if (stmt === child) break;
        if (ts.isIfStatement(stmt) && !stmt.elseStatement && exits(stmt.thenStatement)
          && asserts(stmt.expression, leaf, true)) return true;
      }
    }
    if (ts.isFunctionLike(parent)) return false;
  }
  return false;
}

const SUBLISTS = new Set(['filter', 'sort', 'toSorted', 'slice', 'reverse', 'toReversed']);

/**
 * `Object.keys(o)`, `Object.entries(o)` or `Object.getOwnPropertyNames(o)`, answering `o`'s text: called in place,
 * narrowed by `filter`, `sort` or `slice`, or held in a `const`.
 */
function keyListOf(checker, expr) {
  expr = unwrap(expr);
  if (ts.isIdentifier(expr)) {
    const decl = checker.getSymbolAtLocation(expr)?.valueDeclaration;
    const constant = decl && ts.isVariableDeclaration(decl) && decl.initializer
      && ts.isVariableDeclarationList(decl.parent) && decl.parent.flags & ts.NodeFlags.Const;
    return constant ? keyListOf(checker, decl.initializer) : null;
  }
  if (!ts.isCallExpression(expr) || !ts.isPropertyAccessExpression(expr.expression)) return null;
  const { expression: target, name } = expr.expression;
  if (SUBLISTS.has(name.text)) return keyListOf(checker, target);
  if (!ts.isIdentifier(target) || target.text !== 'Object' || !KEY_LISTS.has(name.text) || expr.arguments.length !== 1) return null;
  return { of: text(unwrap(expr.arguments[0])), entries: name.text === 'entries' };
}

/** The text of the object whose own keys `binding` iterates, or null when it is bound some other way. */
function keysSource(checker, binding) {
  let decl = binding.parent;
  let entryIndex = -1;
  if (ts.isBindingElement(decl) && ts.isArrayBindingPattern(decl.parent)) {
    entryIndex = decl.parent.elements.indexOf(decl);
    decl = decl.parent.parent;
  }
  if (ts.isVariableDeclaration(decl) && ts.isVariableDeclarationList(decl.parent)) {
    const loop = decl.parent.parent;
    if (ts.isForInStatement(loop) && entryIndex < 0) return text(unwrap(loop.expression));
    if (ts.isForOfStatement(loop)) {
      const list = keyListOf(checker, loop.expression);
      if (list && (list.entries ? entryIndex === 0 : entryIndex < 0)) return list.of;
    }
    return null;
  }
  if (ts.isParameter(decl) && decl.parent.parameters[0] === decl) {
    const fn = decl.parent;
    const call = fn.parent;
    if (!ts.isCallExpression(call) || call.arguments[0] !== fn || !ts.isPropertyAccessExpression(call.expression)) return null;
    if (!ITERATORS.has(call.expression.name.text)) return null;
    const list = keyListOf(checker, call.expression.expression);
    if (list && (list.entries ? entryIndex === 0 : entryIndex < 0)) return list.of;
  }
  return null;
}

function ownKeyOf(checker, keyNode, obj) {
  if (!ts.isIdentifier(keyNode)) return false;
  const symbol = checker.getSymbolAtLocation(keyNode);
  const decl = symbol?.valueDeclaration ?? symbol?.declarations?.[0];
  if (!decl || !(ts.isVariableDeclaration(decl) || ts.isParameter(decl) || ts.isBindingElement(decl))) return false;
  if (!ts.isIdentifier(decl.name)) return false;
  return keysSource(checker, decl.name) === obj;
}

/** `'read'`, `'write'` or `null`: what `node`, an element access, does through the prototype chain, if anything. */
export function protoIndexAccess(checker, node) {
  const keyNode = unwrap(node.argumentExpression);
  if (ts.isStringLiteralLike(keyNode) || ts.isNumericLiteral(keyNode)) return null;
  let outer = node;
  while (ts.isParenthesizedExpression(outer.parent) || ts.isNonNullExpression(outer.parent)) outer = outer.parent;
  const parent = outer.parent;
  if (ts.isDeleteExpression(parent)) return null;
  if (!admitsAnyString(checker, checker.getTypeAtLocation(keyNode))) return null;
  if (!hasStringIndex(checker, checker.getTypeAtLocation(node.expression))) return null;
  const obj = text(unwrap(node.expression));
  const key = text(keyNode);
  const write = ts.isBinaryExpression(parent) && parent.left === outer
    && parent.operatorToken.kind === ts.SyntaxKind.EqualsToken;
  const own = (expr, negated) => !negated && ownTest(expr, obj, key);
  const leaf = write ? (expr, negated) => own(expr, negated) || notProto(expr, key, negated) : own;
  if (ownKeyOf(checker, keyNode, obj) || guarded(node, leaf)) return null;
  return write ? 'write' : 'read';
}

export default {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow indexing a string-keyed record with a `string` key, which reaches Object.prototype.' },
    schema: [],
    messages: {
      read:
        '`record[key]` finds `toString`, `constructor` and every other Object.prototype member when the key names one. ' +
        "Read it with getOwn, or test it with hasOwnKey, from '@weasel-js/registry' (Object.hasOwn where registry is out of reach), " +
        'or type the key as the union of names it can be.',
      write:
        "`record[key] = value` with a key of `__proto__` changes the record's prototype. Write it with setOwn from " +
        "'@weasel-js/registry', keep the record in a Map, or type the key as the union of names it can be.",
    },
  },
  create(context) {
    const services = context.sourceCode.parserServices;
    if (!services?.program) throw new Error('weasel/no-proto-index needs typed parsing (parserOptions.projectService).');
    const checker = services.program.getTypeChecker();
    return {
      'MemberExpression[computed=true]'(node) {
        const tsNode = services.esTreeNodeToTSNodeMap.get(node);
        if (!tsNode || !ts.isElementAccessExpression(tsNode)) return;
        const access = protoIndexAccess(checker, tsNode);
        if (access) context.report({ node, messageId: access });
      },
    };
  },
};
