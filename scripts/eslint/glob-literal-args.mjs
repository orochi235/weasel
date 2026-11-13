/**
 * Reports an `import.meta.glob` call whose patterns or options are anything but literals written
 * in the call. Vite reads both by static analysis: a pattern or options object hoisted into a
 * `const` is unreadable to it, so `eager` is dropped without a word and every matched file becomes
 * its own dynamic chunk.
 */

const isStatic = (node) => {
  switch (node.type) {
    case 'Literal':
      return true;
    case 'TemplateLiteral':
      return node.expressions.length === 0;
    case 'ArrayExpression':
      return node.elements.every((el) => el !== null && isStatic(el));
    case 'ObjectExpression':
      return node.properties.every((p) => p.type === 'Property' && !p.computed && isStatic(p.value));
    case 'UnaryExpression':
      return node.operator === '!' && isStatic(node.argument);
    default:
      return false;
  }
};

const isGlob = (callee) =>
  callee.type === 'MemberExpression' &&
  callee.object.type === 'MetaProperty' &&
  callee.object.meta.name === 'import' &&
  callee.object.property.name === 'meta' &&
  !callee.computed &&
  callee.property.type === 'Identifier' &&
  callee.property.name === 'glob';

export default {
  meta: {
    type: 'problem',
    docs: { description: "Require import.meta.glob's arguments to be literals written in the call." },
    schema: [],
    messages: {
      dynamic:
        "import.meta.glob's {{which}} must be written inline as a literal: vite reads it by static analysis, " +
        'and a hoisted or computed one silently loses `eager` and splits every match into its own chunk.',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isGlob(node.callee)) return;
        const [patterns, options] = node.arguments;
        if (patterns && !isStatic(patterns)) context.report({ node: patterns, messageId: 'dynamic', data: { which: 'patterns' } });
        if (options && !isStatic(options)) context.report({ node: options, messageId: 'dynamic', data: { which: 'options' } });
      },
    };
  },
};
