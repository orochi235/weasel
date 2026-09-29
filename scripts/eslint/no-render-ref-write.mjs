/**
 * Reports a write to `<x>.current` (or through it, `<x>.current.y = …`) that
 * runs during render: in a component or hook body, in a block nested in one,
 * in an IIFE there, or in a callback React calls while rendering (`useMemo`,
 * a `useState`/`useReducer` initializer, a reducer, a `useSyncExternalStore`
 * snapshot). A callback that runs later — an effect, an event handler,
 * `useCallback`, any other nested function — is out of scope, and reads are
 * never reported.
 *
 * One render-time write is allowed: lazy initialization, exactly
 * `if (r.current == null) r.current = make();` (also `=== null`,
 * `=== undefined`, `!r.current`, `r.current ??= make()`) with nothing else in
 * the branch and no `else`. It fills an empty ref once, so an abandoned render
 * leaves either nothing or the same kind of value the next render would write.
 *
 * Components are functions named in PascalCase or passed to `forwardRef` /
 * `memo`; hooks are functions named `use*`.
 */

const RENDER_TIME_ARGS = {
  useMemo: [0],
  useState: [0],
  useReducer: [0, 2],
  useSyncExternalStore: [1, 2],
};
const COMPONENT_WRAPPERS = new Set(['forwardRef', 'memo']);

const calleeName = (callee) => {
  if (callee.type === 'Identifier') return callee.name;
  if (callee.type === 'MemberExpression' && !callee.computed && callee.property.type === 'Identifier') {
    return callee.property.name;
  }
  return null;
};

const isCurrent = (node) =>
  node.type === 'MemberExpression' && !node.computed
  && node.property.type === 'Identifier' && node.property.name === 'current';

/** The `.current` member a write goes through, or null. */
function refTarget(left) {
  let n = left;
  while (n && n.type === 'MemberExpression') {
    if (isCurrent(n)) return n;
    n = n.object;
  }
  return null;
}

function functionName(fn) {
  if (fn.id) return fn.id.name;
  const p = fn.parent;
  if (p.type === 'VariableDeclarator' && p.id.type === 'Identifier') return p.id.name;
  return null;
}

/** 'render' | 'transparent' | 'deferred' for the function enclosing a write. */
function classify(fn) {
  const p = fn.parent;
  if (p.type === 'CallExpression') {
    if (p.callee === fn) return 'transparent';
    const name = calleeName(p.callee);
    const idx = p.arguments.indexOf(fn);
    if (name && RENDER_TIME_ARGS[name]?.includes(idx)) return 'transparent';
    if (name && COMPONENT_WRAPPERS.has(name)) return 'render';
    return 'deferred';
  }
  const name = functionName(fn);
  if (name && (/^[A-Z]/.test(name) || /^use[A-Z0-9]/.test(name))) return 'render';
  return 'deferred';
}

const FUNCTION_TYPES = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);

function inRender(node) {
  for (let n = node.parent; n; n = n.parent) {
    if (!FUNCTION_TYPES.has(n.type)) continue;
    const kind = classify(n);
    if (kind === 'render') return true;
    if (kind === 'deferred') return false;
  }
  return false;
}

/** `r.current == null`, `=== null`, `=== undefined`, `== undefined`, `!r.current`. */
function emptyTestOf(test, text) {
  if (test.type === 'UnaryExpression' && test.operator === '!') return text(test.argument);
  if (test.type === 'BinaryExpression' && (test.operator === '==' || test.operator === '===')) {
    const isEmpty = (e) =>
      (e.type === 'Literal' && e.value === null)
      || (e.type === 'Identifier' && e.name === 'undefined');
    if (isEmpty(test.right)) return text(test.left);
    if (isEmpty(test.left)) return text(test.right);
  }
  return null;
}

function isLazyInit(assign, text) {
  if (assign.type !== 'AssignmentExpression' || !isCurrent(assign.left)) return false;
  if (assign.operator === '??=') return true;
  if (assign.operator !== '=') return false;
  const stmt = assign.parent;
  if (stmt.type !== 'ExpressionStatement') return false;
  let branch = stmt;
  if (stmt.parent.type === 'BlockStatement') {
    if (stmt.parent.body.length !== 1) return false;
    branch = stmt.parent;
  }
  const ifs = branch.parent;
  if (ifs.type !== 'IfStatement' || ifs.consequent !== branch || ifs.alternate) return false;
  return emptyTestOf(ifs.test, text) === text(assign.left);
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow writing a ref during render; an abandoned render leaves its value behind.',
    },
    schema: [],
    messages: {
      renderWrite:
        '`{{target}}` is written during render, so a render React abandons leaves its value behind. '
        + 'Mirror a value with `useLatest(value)`, or write it from an effect or handler.',
    },
  },
  create(context) {
    const src = context.sourceCode;
    const text = (n) => src.getText(n);
    const check = (node, left) => {
      const target = refTarget(left);
      if (!target) return;
      if (!inRender(node)) return;
      if (isLazyInit(node, text)) return;
      context.report({ node, messageId: 'renderWrite', data: { target: text(target) } });
    };
    return {
      AssignmentExpression(node) { check(node, node.left); },
      UpdateExpression(node) { check(node, node.argument); },
    };
  },
};
