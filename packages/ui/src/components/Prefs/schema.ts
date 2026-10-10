import type { UnitTable } from '@weasel-js/quantity';
import {
  isPrefLeaf,
  isPrefSection,
  prefGroupIsPage,
  type PrefGroup,
  type PrefLeaf,
  type PrefNumberUnit,
  type PrefObject,
  type PrefSection,
  prefSectionLeaves,
} from '@weasel-js/prefs';

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
 * Every leaf under `schema` as a choice for a `field` leaf, in schema order —
 * an `object` leaf and each of its fields. The schema's own shape says how a
 * path is built: a `PrefGroup`'s key is a segment of its leaves' paths, a
 * `PrefSection`'s is not.
 */
export function prefFieldChoices(schema: PrefGroup | PrefSection): PrefFieldChoice[] {
  const out: PrefFieldChoice[] = [];
  const add = (path: string, leaf: PrefLeaf): void => {
    out.push({ path, name: leaf.name, kind: leaf.kind });
    if (leaf.kind !== 'object') return;
    for (const [key, field] of prefSectionLeaves((leaf as PrefObject).children)) add(`${path}.${key}`, field);
  };
  const walk = (group: PrefGroup, prefix: string): void => {
    for (const [key, child] of Object.entries(group.children)) {
      const path = prefix === '' ? key : `${prefix}.${key}`;
      if (isPrefLeaf(child)) add(path, child);
      else walk(child, path);
    }
  };
  if (isPrefSection(schema)) for (const [key, leaf] of prefSectionLeaves(schema.members)) add(key, leaf);
  else walk(schema, '');
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
  // The root's own page holds its leaves and every top-level group that is not a page itself.
  const loose = Object.values(root.children).filter((c) => isPrefLeaf(c) || !prefGroupIsPage(c));
  if (loose.length > 0) {
    const matches = loose.reduce((n, c) => n + countPrefLeaves(c), 0);
    items.push({ path: '', name: looseEntryName(root.name), depth: 0, section: '', matches });
  }
  for (const [key, child] of Object.entries(root.children)) {
    if (isPrefLeaf(child) || !prefGroupIsPage(child)) continue;
    items.push({
      path: key,
      name: child.name,
      depth: 0,
      section: key,
      matches: countPrefLeaves(child),
    });
    for (const [subKey, sub] of Object.entries(child.children)) {
      // A tab or a panel is found on its page, not scrolled to from the rail.
      if (isPrefLeaf(sub) || (sub.as !== undefined && sub.as !== 'section')) continue;
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
