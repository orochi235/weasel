/**
 * Reports a test `wrapper` written as an arrow function that renders `<StrictMode>`. Under one,
 * `renderHook` and `render` mount with no double effect, so a test written to catch a missing
 * cleanup passes either way; `wrapper: StrictMode` and `reactStrictMode: true` run it twice
 * (measured 2026-11-12, React 19.2).
 */

const isStrictMode = (name) =>
  (name.type === 'JSXIdentifier' && name.name === 'StrictMode') ||
  (name.type === 'JSXMemberExpression' && name.property.name === 'StrictMode');

const rendered = (fn) => {
  if (fn.body.type !== 'BlockStatement') return fn.body;
  const ret = fn.body.body.find((s) => s.type === 'ReturnStatement');
  return ret?.argument ?? null;
};

export default {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow an arrow-function test wrapper around <StrictMode>.' },
    schema: [],
    messages: {
      arrow:
        'An arrow wrapper around <StrictMode> mounts without its double effect, so the test cannot catch a ' +
        'missing cleanup. Pass `wrapper: StrictMode`, or `reactStrictMode: true`.',
    },
  },
  create(context) {
    return {
      Property(node) {
        if (node.computed || node.key.type !== 'Identifier' || node.key.name !== 'wrapper') return;
        const fn = node.value;
        if (fn.type !== 'ArrowFunctionExpression' && fn.type !== 'FunctionExpression') return;
        const out = rendered(fn);
        if (out?.type === 'JSXElement' && isStrictMode(out.openingElement.name)) context.report({ node: fn, messageId: 'arrow' });
      },
    };
  },
};
