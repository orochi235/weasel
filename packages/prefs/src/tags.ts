import { hasTag } from '@weasel-js/registry';
import type { PrefGroup, PrefSection } from './groups';
import { isPrefLeaf, isPrefSection } from './helpers';
import type { PrefLeaf } from './schema';

/** Every leaf with the tags it carries: those of each group or section above
 *  it, outermost first, then its own. Keyed as `prefLeafAt` reads paths. */
function taggedLeaves(schema: PrefGroup | PrefSection): [path: string, leaf: PrefLeaf, tags: readonly string[]][] {
  const out: [string, PrefLeaf, readonly string[]][] = [];
  const walk = (node: PrefGroup | PrefSection, prefix: string, above: readonly string[]): void => {
    const section = isPrefSection(node);
    for (const [key, child] of Object.entries(section ? node.members : node.children)) {
      const path = section || prefix === '' ? key : `${prefix}.${key}`;
      const tags = child.tags ? [...above, ...child.tags] : above;
      if (isPrefLeaf(child)) out.push([path, child, tags]);
      else walk(child, section ? prefix : path, tags);
    }
  };
  walk(schema, '', schema.tags ?? []);
  return out;
}

/** The leaves carrying `tag`, themselves or through a group above them, by
 *  path, in schema order. */
export function prefLeavesTagged(schema: PrefGroup | PrefSection, tag: string): Map<string, PrefLeaf> {
  return new Map(taggedLeaves(schema).filter(([, , tags]) => hasTag(tags, tag)).map(([path, leaf]) => [path, leaf]));
}

/** The tags the leaf at `path` carries: each group's above it, outermost
 *  first, then its own. Empty for a path that names no leaf. */
export function prefLeafTags(schema: PrefGroup | PrefSection, path: string): readonly string[] {
  return taggedLeaves(schema).find(([p]) => p === path)?.[2] ?? [];
}
