import type { UnitTable } from '@weasel-js/quantity';
import { isPrefLeaf, type PrefGroup, type PrefLeaf, type PrefNumberUnit } from '@weasel-js/prefs';

/** What a unit leaf's field reads as typed text: its `accepts` table, and its
 *  `suffix` as the display unit itself. */
export function prefUnitAccepts(unit: PrefNumberUnit): Readonly<UnitTable> {
  return unit.suffix === undefined ? { ...unit.accepts } : { [unit.suffix]: 1, ...unit.accepts };
}

/** One field a `field` leaf may name: the path its value is read and written
 *  at, and what it is. */
export interface PrefFieldChoice {
  path: string;
  name: string;
  kind: string;
}

/**
 * Every leaf under `group` as a choice for a `field` leaf, in schema order —
 * an `object` leaf and each of its fields. `groupKeys` says whether a group's
 * key is part of its leaves' paths, which is the surface's rule: a prefs form
 * nests values by group, a node's property panel does not. Inside an object,
 * groups never contribute.
 */
export function prefFieldChoices(group: PrefGroup, groupKeys = true): PrefFieldChoice[] {
  const out: PrefFieldChoice[] = [];
  const walk = (node: PrefGroup, prefix: string, keysCount: boolean): void => {
    for (const [key, child] of Object.entries(node.children)) {
      if (!isPrefLeaf(child)) {
        walk(child, keysCount && prefix !== '' ? `${prefix}.${key}` : keysCount ? key : prefix, keysCount);
        continue;
      }
      const path = prefix === '' ? key : `${prefix}.${key}`;
      out.push({ path, name: child.name, kind: child.kind });
      if (child.kind === 'object') walk(child as unknown as PrefGroup, path, false);
    }
  };
  walk(group, '', groupKeys);
  return out;
}

/** One entry in a {@link PrefsForm} rail: a group the reader can navigate to. */
export interface PrefRailItem {
  /** Dotted path of the group. Empty for the entry holding loose root leaves. */
  path: string;
  name: string;
  /** 0 opens a pane; 1 scrolls within the open one. The rail goes no deeper. */
  depth: 0 | 1;
  /** Path of the depth-0 ancestor — its own path when `depth` is 0. */
  section: string;
  /** Leaves surviving the active filter, counted over the whole subtree. */
  matches: number;
}

/** What the rail and pane call a root's loose leaves: the root's name, or `General` when it has none. */
export function looseEntryName(rootName: string): string {
  return rootName === '' ? 'General' : rootName;
}

/** Leaves anywhere under `node`, counted. */
function countPrefLeaves(node: PrefLeaf | PrefGroup): number {
  if (isPrefLeaf(node)) return 1;
  let n = 0;
  for (const child of Object.values(node.children)) n += countPrefLeaves(child);
  return n;
}

/**
 * The rail's model for a schema: depth-0 groups, each followed by its depth-1
 * children. Deeper groups render inside a pane and get no entry — a schema
 * that nests ten deep still navigates two levels.
 *
 * Loose leaves directly under the root lead the list under an entry named for
 * the root itself, since they belong to no group that could name them.
 */
export function prefRailItems(root: PrefGroup): PrefRailItem[] {
  const items: PrefRailItem[] = [];
  const loose = Object.values(root.children).filter(isPrefLeaf).length;
  if (loose > 0) {
    items.push({ path: '', name: looseEntryName(root.name), depth: 0, section: '', matches: loose });
  }
  for (const [key, child] of Object.entries(root.children)) {
    if (isPrefLeaf(child)) continue;
    items.push({
      path: key,
      name: child.name,
      depth: 0,
      section: key,
      matches: countPrefLeaves(child),
    });
    for (const [subKey, sub] of Object.entries(child.children)) {
      if (isPrefLeaf(sub)) continue;
      items.push({
        path: `${key}.${subKey}`,
        name: sub.name,
        depth: 1,
        section: key,
        matches: countPrefLeaves(sub),
      });
    }
  }
  return items;
}
