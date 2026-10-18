import { prefDrawsNoControl } from './PrefWords';
import {
  filterPrefSubtree,
  isPrefLeaf,
  isPrefSection,
  prefGroupIsPage,
  type PrefGroup,
  type PrefLeaf,
  type PrefObject,
  type PrefSection,
  prefSectionLeaves,
} from '@weasel-js/prefs';

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
    if (prefDrawsNoControl(leaf)) return;
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

/** One entry in a {@link PrefsForm} rail: a page the reader can open. */
export interface PrefRailItem {
  /** Dotted path of the page's group. Empty for the entry holding loose root leaves. */
  path: string;
  name: string;
  /** How far the entry nests: 0 at the top, and one more than the nearest entry above it. */
  depth: number;
  /** Leaves surviving the active filter, counted over the whole subtree. */
  matches: number;
  /** Its page would draw nothing, so choosing it opens the first entry nested in it. */
  passes?: boolean;
}

/** Whether a group inside a page is drawn as a section of it or opens a page of its own: what a rail can list. A
 *  tab or a panel is found on its page instead. */
export function prefGroupNests(group: PrefGroup): boolean {
  return group.as === undefined || group.as === 'section' || group.as === 'page';
}

/** Whether a group inside a page opens a page of its own. A top-level group does unless it says otherwise
 *  (`prefGroupIsPage`); a nested one is a section unless it says so. */
export function prefGroupOpensPage(group: PrefGroup): boolean {
  return group.as === 'page';
}

/** Whether a group draws nothing of its own, so that what it holds is listed and drawn as its parent's. */
const isFragment = (group: PrefGroup): boolean => group.as === 'fragment';

/** Whether a group has anything a page of its own would draw: a leaf, or a group that opens no page itself. A
 *  fragment has what its children have. */
export function prefPageHasOwn(group: PrefGroup): boolean {
  return Object.values(group.children).some(
    (child) => isPrefLeaf(child) || (isFragment(child) ? prefPageHasOwn(child) : !prefGroupOpensPage(child)),
  );
}

/** Path of the group holding the one at `path`, or null for a top-level group's. */
export function prefRailParent(path: string): string | null {
  const at = path.lastIndexOf('.');
  return at < 0 ? null : path.slice(0, at);
}

/** Path of the rail entry the one at `path` nests under: the nearest page above it that `items` lists, since a
 *  section has no entry, and the root's for a page inside a section or a fragment of the root's own page. Null
 *  when there is none. */
export function prefRailAbove(items: readonly PrefRailItem[], path: string): string | null {
  for (let at = prefRailParent(path); at !== null; at = prefRailParent(at)) {
    if (items.some((i) => i.path === at)) return at;
  }
  return path.includes('.') && items.some((i) => i.path === '') ? '' : null;
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
 * The rail's model for a schema: each top-level page, followed by the pages nested in it, each followed by its
 * own. A group that is `as: 'page'` opens a page of its own and is listed at any depth, a section in between
 * included. A section has no entry: it is drawn on its page, under its heading. Nothing inside a tab or a panel is
 * listed. What a fragment holds is listed as its parent's.
 *
 * The root's own page leads the list under an entry named for the root itself: its loose leaves, which belong to
 * no group that could name them, and every top-level group that is not a page.
 */
export function prefRailItems(root: PrefGroup): PrefRailItem[] {
  const items: PrefRailItem[] = [];
  // The root's own page holds its leaves and every top-level group that is not a page itself.
  const loose = Object.values(root.children).filter((c) => isPrefLeaf(c) || !prefGroupIsPage(c));
  const passing = (group: PrefGroup): { passes?: true } =>
    Object.keys(group.children).length > 0 && !prefPageHasOwn(group) ? { passes: true } : {};
  const nest = (group: PrefGroup, path: string, depth: number): void => {
    for (const [key, sub] of Object.entries(group.children)) {
      if (isPrefLeaf(sub)) continue;
      const subPath = path === '' ? key : `${path}.${key}`;
      if (isFragment(sub)) {
        nest(sub, subPath, depth);
        continue;
      }
      if (!prefGroupNests(sub)) continue;
      // A top-level page is no part of the root's own page.
      if (path === '' && prefGroupIsPage(sub)) continue;
      const opens = prefGroupOpensPage(sub);
      if (opens) items.push({ path: subPath, name: sub.name, depth, matches: countPrefLeaves(sub), ...passing(sub) });
      nest(sub, subPath, opens ? depth + 1 : depth);
    }
  };
  if (loose.length > 0) {
    const matches = loose.reduce((n, c) => n + countPrefLeaves(c), 0);
    items.push({ path: '', name: looseEntryName(root.name), depth: 0, matches });
    nest(root, '', 1);
  }
  for (const [key, child] of Object.entries(root.children)) {
    if (isPrefLeaf(child) || !prefGroupIsPage(child)) continue;
    items.push({ path: key, name: child.name, depth: 0, matches: countPrefLeaves(child), ...passing(child) });
    nest(child, key, 1);
  }
  return items;
}

/**
 * A form's root narrowed to what a filter query leaves, or null when that is nothing. The root's own name is not
 * matched, where a group's is: it is the form's title, and a query that happened to lie in it would filter nothing.
 * An alias is matched as the leaf of `over` it shows.
 */
export function filterPrefRoot(
  root: PrefGroup, query: string, over: PrefGroup | PrefSection,
): PrefGroup | null {
  if (query.trim() === '') return root;
  const children: PrefGroup['children'] = {};
  for (const [key, child] of Object.entries(root.children)) {
    const kept = filterPrefSubtree(child, query, key, over);
    if (kept) children[key] = kept;
  }
  return Object.keys(children).length === 0 ? null : { ...root, children };
}
