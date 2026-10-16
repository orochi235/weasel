import type { PrefGroup } from './groups';
import { isPrefLeaf } from './helpers';
import type { PrefLeaf } from './schema';

type Child = PrefLeaf | PrefGroup;

function mergeChildren(into: Record<string, Child>, from: Record<string, Child>, at: string): void {
  for (const [key, child] of Object.entries(from)) {
    const path = at === '' ? key : `${at}.${key}`;
    const held = into[key];
    if (held === undefined) {
      into[key] = child;
    } else if (!isPrefLeaf(held) && !isPrefLeaf(child)) {
      const children = { ...held.children };
      mergeChildren(children, child.children, path);
      into[key] = { ...held, children };
    } else {
      throw new Error(`mergePrefGroups: two groups give "${path}", and one of them is a leaf`);
    }
  }
}

/**
 * One group named `name` holding every child of `groups`. Groups at the same
 * key merge, the first one's own fields kept; a leaf meeting anything at the
 * same key throws. Composes schemas that each add to the same areas, such as
 * the kit settings groups that `ui` and `core` both give a `targets` group.
 */
export function mergePrefGroups(name: string, ...groups: readonly PrefGroup[]): PrefGroup {
  const children: Record<string, Child> = {};
  for (const group of groups) mergeChildren(children, group.children, '');
  return { name, children };
}
