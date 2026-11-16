/**
 * Reports `a + (b - a) * t` written by hand. At `t = 1` it can miss `b` by an ulp (0.7 + (0.1 - 0.7) * 1 is
 * 0.09999999999999998), and the miss reads downstream as a real change. geom's `lerp` returns `b` there.
 */

const unparen = (n) => (n.type === 'TSAsExpression' || n.type === 'TSNonNullExpression' ? unparen(n.expression) : n);

const same = (src, a, b) => src.getText(unparen(a)) === src.getText(unparen(b));

/** A factor built from number literals alone, like `2`, `0.5` or `2 / 3`, can never be 1 at run time. */
const constant = (n) => {
  n = unparen(n);
  if (n.type === 'Literal') return typeof n.value === 'number';
  if (n.type === 'UnaryExpression') return constant(n.argument);
  return n.type === 'BinaryExpression' && constant(n.left) && constant(n.right);
};

/** The `(b - a)` factor of a product whose other factor can vary, or null. */
const difference = (n) => {
  n = unparen(n);
  if (n.type !== 'BinaryExpression' || n.operator !== '*') return null;
  const l = unparen(n.left), r = unparen(n.right);
  if (l.type === 'BinaryExpression' && l.operator === '-' && !constant(r)) return l;
  if (r.type === 'BinaryExpression' && r.operator === '-' && !constant(l)) return r;
  return null;
};

export default {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow a hand-written `a + (b - a) * t`, which can miss `b` at `t = 1`.' },
    schema: [],
    messages: {
      lerp:
        '`a + (b - a) * t` can miss `b` by an ulp at `t = 1`. Call `lerp` from @weasel-js/geom, which returns `b` ' +
        "there (paint and audio, which import nothing, each keep a copy in src/lerp.ts).",
    },
  },
  create(context) {
    const src = context.sourceCode;
    return {
      BinaryExpression(node) {
        if (node.operator !== '+') return;
        for (const [base, product] of [[node.left, node.right], [node.right, node.left]]) {
          const d = difference(product);
          if (d && same(src, d.right, base)) {
            context.report({ node, messageId: 'lerp' });
            return;
          }
        }
      },
    };
  },
};
