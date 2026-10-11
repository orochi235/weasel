import { isPrefLeaf, isPrefSection, prefGroupIsPage, type PrefGroup } from '@weasel-js/prefs';
import { nodeAt, type SchemaNode, type SchemaRoot, type SchemaTarget } from './schemaEdit';

/** Whether a node sitting under a group root would be on no page: a leaf, or a group that is not a page. */
export function isLoose(node: SchemaNode): boolean {
  return !isPrefSection(node) && (isPrefLeaf(node) || !prefGroupIsPage(node));
}

/**
 * The keys a group root holds outside any page, which the editor lists as unplaced and leaves out of the tree and
 * the preview. None for a section root, whose leaves a properties panel draws bare.
 */
export function looseKeys(root: SchemaRoot): string[] {
  return isPrefSection(root) ? [] : Object.keys(root.children).filter((k) => isLoose(root.children[k]!));
}

/** A group root less what it holds outside any page; the root itself with nothing loose. */
export function placedOnly(root: PrefGroup): PrefGroup {
  const loose = new Set(looseKeys(root));
  if (loose.size === 0) return root;
  return { ...root, children: Object.fromEntries(Object.entries(root.children).filter(([k]) => !loose.has(k))) };
}

/**
 * Whether the nodes at `paths` may be dropped at the tree's top level, which under a group root holds pages only.
 * Undefined where the top level does not decide it: under a row, or under a section root.
 */
export function topLevelAllows(root: SchemaRoot, paths: readonly string[], parentId: string | null): boolean | undefined {
  if (isPrefSection(root) || parentId !== null) return undefined;
  return paths.every((p) => {
    const node = nodeAt(root, p);
    return node !== undefined && !isLoose(node);
  });
}

/** Where a drop on the tree lands in the schema: under a group root the tree's top level lists the pages alone. */
export function schemaTarget(root: SchemaRoot, parentId: string | null, index: number): SchemaTarget {
  if (isPrefSection(root) || parentId !== null) return { parentPath: parentId, index };
  const keys = Object.keys(root.children);
  const loose = new Set(looseKeys(root));
  const at = keys.filter((k) => !loose.has(k))[index];
  return { parentPath: null, index: at === undefined ? keys.length : keys.indexOf(at) };
}

/** Where a node taken off its page lands: the end of the root, where it is loose. */
export function looseTarget(root: SchemaRoot): SchemaTarget {
  return { parentPath: null, index: Object.keys(isPrefSection(root) ? root.members : root.children).length };
}
