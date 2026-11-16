/**
 * Reports an effect that subscribes, listens, observes, registers or starts an interval and returns
 * nothing: what it set up outlives the component, and StrictMode's rehearsal unmount doubles it.
 * `react-hooks/exhaustive-deps` checks what an effect reads, never what it leaves behind.
 */

const EFFECTS = new Set(['useEffect', 'useLayoutEffect', 'useInsertionEffect']);
const SETS_UP = /^(subscribe\w*|addEventListener|setInterval|observe|register[A-Z]\w*|watch[A-Z]\w*)$/;

const calleeName = (callee) => {
  if (callee.type === 'Identifier') return callee.name;
  if (callee.type === 'MemberExpression' && !callee.computed && callee.property.type === 'Identifier') return callee.property.name;
  return null;
};

const isFunction = (node) =>
  node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression' || node.type === 'FunctionDeclaration';

/** The calls and returns of `node`'s own body, not those of functions nested in it. */
function walk(node, found) {
  if (!node || typeof node.type !== 'string') return;
  if (node.type === 'CallExpression') {
    const name = calleeName(node.callee);
    if (name && SETS_UP.test(name)) found.setUp ??= node;
  }
  if (node.type === 'ReturnStatement' && node.argument) found.returns = true;
  for (const key of Object.keys(node)) {
    if (key === 'parent') continue;
    const child = node[key];
    if (Array.isArray(child)) {
      for (const c of child) if (c && typeof c.type === 'string' && !isFunction(c)) walk(c, found);
    } else if (child && typeof child.type === 'string' && !isFunction(child)) {
      walk(child, found);
    }
  }
}

export default {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow an effect that sets something up and returns no cleanup.' },
    schema: [],
    messages: {
      leak:
        'This effect calls {{name}} and returns no cleanup, so what it sets up outlives the component. ' +
        'Return the call\'s disposer (or a function that undoes it).',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const name = calleeName(node.callee);
        if (!name || !EFFECTS.has(name)) return;
        const fn = node.arguments[0];
        if (!fn || (fn.type !== 'ArrowFunctionExpression' && fn.type !== 'FunctionExpression')) return;
        if (fn.body.type !== 'BlockStatement') return;
        const found = { setUp: null, returns: false };
        walk(fn.body, found);
        if (found.setUp && !found.returns) {
          context.report({ node: found.setUp, messageId: 'leak', data: { name: calleeName(found.setUp.callee) } });
        }
      },
    };
  },
};
