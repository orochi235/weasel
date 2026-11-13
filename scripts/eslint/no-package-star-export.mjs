/**
 * Reports `export * from '<another package>'` in shipped source. A star re-export of an external
 * package survives the typecheck and the unit suite, then binds nothing in a consumer's bundle
 * (`No matching export in core/dist/index.js`): the bundler cannot see through the package
 * boundary to enumerate the names. Only `npm run test:smoke:consumer` would otherwise catch it.
 *
 * `internal` lists the bare prefixes that are path aliases into the package's own source
 * (core's `interactions/`), which are not packages.
 */

export default {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow `export *` from another package; re-export its names explicitly.' },
    schema: [
      {
        type: 'object',
        properties: { internal: { type: 'array', items: { type: 'string' } } },
        additionalProperties: false,
      },
    ],
    messages: {
      star:
        "`export * from '{{spec}}'` binds nothing in a consumer's bundle, since the bundler cannot list another " +
        "package's names through it. Re-export them by name: `export { A, B } from '{{spec}}'`.",
    },
  },
  create(context) {
    const internal = context.options[0]?.internal ?? [];
    const isPackage = (spec) => !spec.startsWith('.') && !spec.startsWith('/') && !internal.some((p) => spec.startsWith(p));
    return {
      ExportAllDeclaration(node) {
        const spec = node.source.value;
        if (node.exportKind === 'type' || node.exported || !isPackage(spec)) return;
        context.report({ node, messageId: 'star', data: { spec } });
      },
    };
  },
};
