import type { PrefGroup, PrefSection } from './groups';
import { isPrefLeaf } from './helpers';
import { isBuiltinPref, type PrefLeaf } from './schema';

/** Whether a leaf's control fits beside a heading's words: a built-in `boolean`'s or `enum`'s does. */
export function prefFitsHeading(leaf: PrefLeaf): boolean {
  return (leaf.kind === 'boolean' || leaf.kind === 'enum') && isBuiltinPref(leaf);
}

/**
 * The key of the leaf a group or a section draws in its heading: the first
 * directly in it that is marked `heading` and whose control fits there.
 * Undefined for a node with no name, which has no heading to draw it in.
 */
export function prefHeadingKey(node: PrefGroup | PrefSection): string | undefined {
  if (node.name === '') return undefined;
  const held = 'members' in node ? node.members : node.children;
  for (const [key, child] of Object.entries(held)) {
    if (isPrefLeaf(child) && child.heading === true && prefFitsHeading(child)) return key;
  }
  return undefined;
}
