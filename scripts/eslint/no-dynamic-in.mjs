/**
 * Reports `key in object` where `key` is not a string literal. `in` walks the prototype chain, so a key read
 * from a user, a file, or a schema that names an `Object.prototype` member (`constructor`, `toString`) tests
 * present on every plain object. `Object.hasOwn`, or registry's `hasOwnKey` where the test narrows the key,
 * counts only the object's own keys. A literal key (`'touches' in e`) is a shape test and stays.
 */

const isLiteralKey = (node) =>
  (node.type === 'Literal' && typeof node.value === 'string') ||
  (node.type === 'TemplateLiteral' && node.expressions.length === 0) ||
  node.type === 'PrivateIdentifier';

export default {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow `in` with a computed key, which finds Object.prototype members too.' },
    schema: [],
    messages: {
      dynamic:
        '`key in object` is true for `constructor`, `toString` and every other Object.prototype member. ' +
        "Use Object.hasOwn(object, key), or hasOwnKey from '@weasel-js/registry' to narrow the key.",
    },
  },
  create(context) {
    return {
      BinaryExpression(node) {
        if (node.operator === 'in' && !isLiteralKey(node.left)) context.report({ node, messageId: 'dynamic' });
      },
    };
  },
};
