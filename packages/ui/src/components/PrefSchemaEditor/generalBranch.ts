import { isPrefLeaf, isPrefSection, prefGroupIsPage, type PrefGroup } from '@weasel-js/prefs';
import { nodeAt, type SchemaRoot, type SchemaTarget } from './schemaEdit';

/**
 * The tree's row for a group root's own leaves, which a preferences form files under one entry of its rail.
 * No key holds a `/`, so no node's path is this.
 */
export const GENERAL = '/';

/** Whether a child of a group root is drawn on the root's own page: a leaf, or a group that is not a page. */
function onRootPage(node: PrefGroup['children'][string]): boolean {
  return isPrefLeaf(node) || !prefGroupIsPage(node);
}

/** The keys a group root's own page holds; none for a section root, whose leaves a properties panel draws bare. */
export function generalKeys(root: SchemaRoot): string[] {
  return isPrefSection(root) ? [] : Object.keys(root.children).filter((k) => onRootPage(root.children[k]!));
}

/** Whether the nodes at `paths` may be dropped under tree row `parentId`, as far as the General row decides it. */
export function generalAllows(root: SchemaRoot, paths: readonly string[], parentId: string | null): boolean | undefined {
  if (paths.includes(GENERAL)) return false;
  const general = generalKeys(root);
  if (isPrefSection(root) || (parentId !== null && parentId !== GENERAL)) return undefined;
  // General holds what the root's own page draws, and the tree's top level holds the pages.
  const loose = (path: string): boolean => {
    const node = nodeAt(root, path);
    return node !== undefined && !isPrefSection(node) && onRootPage(node);
  };
  if (parentId === GENERAL) return paths.every(loose);
  return general.length === 0 ? undefined : paths.every((p) => !loose(p));
}

/** Where a drop on the tree lands in the schema: the tree lists what a group root's own page holds under General, then its pages. */
export function schemaTarget(root: SchemaRoot, parentId: string | null, index: number): SchemaTarget {
  if (isPrefSection(root) || (parentId !== null && parentId !== GENERAL)) return { parentPath: parentId, index };
  const keys = Object.keys(root.children);
  const leaves = generalKeys(root);
  if (parentId === GENERAL) {
    const at = leaves[index];
    if (at !== undefined) return { parentPath: null, index: keys.indexOf(at) };
    const last = leaves.at(-1);
    return { parentPath: null, index: last === undefined ? 0 : keys.indexOf(last) + 1 };
  }
  const groups = keys.filter((k) => !leaves.includes(k));
  const at = groups[Math.max(0, index - (leaves.length > 0 ? 1 : 0))];
  return { parentPath: null, index: at === undefined ? keys.length : keys.indexOf(at) };
}
