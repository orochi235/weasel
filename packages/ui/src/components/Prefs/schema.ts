import { prefDrawsNoControl } from './PrefWords';
import type { UnitTable } from '@weasel-js/quantity';
import {
  filterPrefSubtree,
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

/** One entry in a {@link PrefsForm} rail: a group the reader can navigate to. */
export interface PrefRailItem {
  /** Dotted path of the group. Empty for the entry holding loose root leaves. */
  path: string;
  name: string;
  /** How far the entry nests: 0 at the top, and one more than the nearest entry above it. */
  depth: number;
  /** Path of the page the group is drawn on. Its own path: choosing the entry opens that page. Another's: the
   *  group is a section of that page, and choosing the entry scrolls the page to it. */
  page: string;
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

/** Path of the rail entry the one at `path` nests under: the nearest group above it that `items` lists, since a
 *  section inside a section has no entry, and the root's for a section of the root's own page. Null when there is
 *  none. */
export function prefRailAbove(items: readonly PrefRailItem[], path: string): string | null {
  for (let at = prefRailParent(path); at !== null; at = prefRailParent(at)) {
    if (items.some((i) => i.path === at)) return at;
  }
  if (path === '' || !items.some((i) => i.path === '')) return null;
  // A section of the root's own page, or a page inside a top-level fragment.
  return path.includes('.') || items.some((i) => i.path === path && i.page === '') ? '' : null;
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
 * The rail's model for a schema: each top-level page, followed by the entries nested in it, each followed by its
 * own. A group that is `as: 'page'` opens a page of its own and is listed at any depth. Any other nested group is
 * a section, listed only when it sits directly on a page; a section inside a section is drawn on that page with
 * no entry. Nothing inside a tab or a panel is listed. What a fragment holds is listed as its parent's.
 *
 * The root's own page leads the list under an entry named for the root itself: its loose leaves, which belong to
 * no group that could name them, and every top-level group that is not a page. A top-level section is a section
 * of that page and nests under its entry, as one does on any other page.
 */
export function prefRailItems(root: PrefGroup): PrefRailItem[] {
  const items: PrefRailItem[] = [];
  // The root's own page holds its leaves and every top-level group that is not a page itself.
  const loose = Object.values(root.children).filter((c) => isPrefLeaf(c) || !prefGroupIsPage(c));
  const passing = (group: PrefGroup): { passes?: true } =>
    Object.keys(group.children).length > 0 && !prefPageHasOwn(group) ? { passes: true } : {};
  /** `direct`: `group`'s children sit directly on `page`, where a section is listed. */
  const nest = (group: PrefGroup, path: string, depth: number, page: string, direct: boolean): void => {
    for (const [key, sub] of Object.entries(group.children)) {
      if (isPrefLeaf(sub)) continue;
      const subPath = path === '' ? key : `${path}.${key}`;
      if (isFragment(sub)) {
        nest(sub, subPath, depth, page, direct);
        continue;
      }
      if (!prefGroupNests(sub)) continue;
      // A top-level page is no part of the root's own page.
      if (path === '' && prefGroupIsPage(sub)) continue;
      const opens = prefGroupOpensPage(sub);
      const listed = opens || direct;
      const on = opens ? subPath : page;
      if (listed) items.push({ path: subPath, name: sub.name, depth, page: on, matches: countPrefLeaves(sub), ...(opens ? passing(sub) : {}) });
      nest(sub, subPath, listed ? depth + 1 : depth, on, opens);
    }
  };
  if (loose.length > 0) {
    const matches = loose.reduce((n, c) => n + countPrefLeaves(c), 0);
    items.push({ path: '', name: looseEntryName(root.name), depth: 0, page: '', matches });
    nest(root, '', 1, '', true);
  }
  for (const [key, child] of Object.entries(root.children)) {
    if (isPrefLeaf(child) || !prefGroupIsPage(child)) continue;
    items.push({ path: key, name: child.name, depth: 0, page: key, matches: countPrefLeaves(child), ...passing(child) });
    nest(child, key, 1, key, true);
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
