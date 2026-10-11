import { outermost, rekeyed, removeNode, shiftNodes, type SchemaRoot, type SchemaTarget } from './schemaEdit';

// A layout's pointers name value paths in its dialog, which no path in the layout's own tree is. `renameKey`,
// `moveNodes`, and `removeNodes` take one for the other, and rewrite or remove pointers that named something else.

export function renameLayoutKey<R extends SchemaRoot>(layout: R, path: string, next: string): R {
  return rekeyed(layout, path, next);
}

/** As `moveNodes`: the tree, `layout` itself when nothing ends up anywhere new, and each moved node's old path in `from` beside its new one in `paths`. */
export function moveLayoutNodes<R extends SchemaRoot>(
  layout: R, paths: readonly string[], target: SchemaTarget,
): { root: R; from: string[]; paths: string[] } {
  return shiftNodes(layout, paths, target);
}

/** `layout` without the nodes at `paths`; one beneath another goes with it. */
export function removeLayoutNodes<R extends SchemaRoot>(layout: R, paths: readonly string[]): R {
  return outermost(paths).reduce((root, path) => removeNode(root, path), layout);
}
