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
  /** 0 opens a pane. Deeper, an entry nests under the entry its path extends: it scrolls within the open pane at
   *  1, the deepest a rail goes unless asked for more, and opens a pane of its own under `subPages`. */
  depth: number;
  /** Path of the depth-0 ancestor — its own path when `depth` is 0. */
  section: string;
  /** Leaves surviving the active filter, counted over the whole subtree. */
  matches: number;
  /** Under `subPages`: its page would draw nothing, so choosing it opens the first entry nested in it. */
  passes?: boolean;
}

/**
 * Whether a group inside a page gets a rail entry. A tab or a panel is found on its page instead. Under `subPages`
 * an entry is a page of its own, so only a group that is a page gets one, and a section is drawn on its parent's.
 */
export function prefGroupNests(group: PrefGroup, subPages = false): boolean {
  return subPages ? prefGroupIsPage(group) : group.as === undefined || group.as === 'section';
}

/** Path of the rail entry the one at `path` nests under, or null for a depth-0 entry's. */
export function prefRailParent(path: string): string | null {
  const at = path.lastIndexOf('.');
  return at < 0 ? null : path.slice(0, at);
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
 * The rail's model for a schema: depth-0 groups, each followed by the groups nested in it. That is one level of
 * them, the rest rendering inside a pane with no entry, so a schema that nests ten deep still navigates two
 * levels. `deep` lists every level, each entry followed by its own, for a rail whose every entry opens a pane.
 *
 * Loose leaves directly under the root lead the list under an entry named for
 * the root itself, since they belong to no group that could name them.
 */
export function prefRailItems(root: PrefGroup, deep = false): PrefRailItem[] {
  const items: PrefRailItem[] = [];
  // The root's own page holds its leaves and every top-level group that is not a page itself.
  const loose = Object.values(root.children).filter((c) => isPrefLeaf(c) || !prefGroupIsPage(c));
  if (loose.length > 0) {
    const matches = loose.reduce((n, c) => n + countPrefLeaves(c), 0);
    items.push({ path: '', name: looseEntryName(root.name), depth: 0, section: '', matches });
  }
  const passing = (group: PrefGroup): { passes?: true } => {
    const kids = Object.values(group.children);
    return deep && kids.length > 0 && kids.every((c) => !isPrefLeaf(c) && prefGroupNests(c, true)) ? { passes: true } : {};
  };
  const nest = (group: PrefGroup, path: string, depth: number, section: string): void => {
    for (const [key, sub] of Object.entries(group.children)) {
      if (isPrefLeaf(sub) || !prefGroupNests(sub, deep)) continue;
      const subPath = `${path}.${key}`;
      items.push({ path: subPath, name: sub.name, depth, section, matches: countPrefLeaves(sub), ...passing(sub) });
      if (deep) nest(sub, subPath, depth + 1, section);
    }
  };
  for (const [key, child] of Object.entries(root.children)) {
    if (isPrefLeaf(child) || !prefGroupIsPage(child)) continue;
    items.push({ path: key, name: child.name, depth: 0, section: key, matches: countPrefLeaves(child), ...passing(child) });
    nest(child, key, 1, key);
  }
  return items;
}
