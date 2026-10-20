// Pure selection→panel derivations for SelectionPanel. Kept free of
// React so intersection/aggregation semantics are unit-testable.
//
// Path convention (see core `NodePropertiesEntry`): a node's property
// schema is a `PrefSection`, so a leaf's OWN KEY is its node path — a dotted
// path of any depth rooted at `pose` or `data` (`pose.x`, `data.fill`,
// `data.style.fontSize`) — and a section's key is no part of it. A
// preferences schema (`PrefGroup`) reads the other way and is not accepted.

import {
  MIXED,
  routeKind,
  type Mixed,
  type NodePropertiesEntry,
  type NodeRoutingEntry,
  type SceneNode,
} from '@weasel-js/core';
import type { IconRef } from '@weasel-js/icons';
import {
  isPrefLeaf,
  pairRuns,
  prefAliasTargets,
  prefHeadingKey,
  prefLeafValue,
  prefSectionLeaves,
  type PrefAlias,
  type PrefAliasTargets,
  type PrefBarLead,
  type PrefBarOverflow,
  type PrefLeaf,
  type PrefSection,
  type PrefSectionAs,
} from '@weasel-js/prefs';
import { deepEqual } from '@weasel-js/registry';

// Re-exported under its existing public name here: the kit-wide "these
// values disagree" sentinel (`@weasel-js/core`'s `MIXED`) also covers
// multi-node aggregation, so this panel doesn't get its own symbol.
export { MIXED };
export type { Mixed };

/** A scene node of any data, layer, and pose. */
export type AnyNode = SceneNode<unknown, string, unknown>;

/**
 * One editable property in a {@link SelectionPanel}, paired with the dotted
 * node path it reads and writes.
 */
export interface PanelLeaf {
  /** Dotted node path the value is read and written at: the leaf's key in the schema, or for an alias its
   *  target's. */
  path: string;
  leaf: PrefLeaf;
  /** An alias's own key in the schema, where `path` is its target's. */
  own?: string;
}

/** What tells one leaf of a panel from another: two aliases of one leaf share a `path`. */
export const panelLeafKey = (leaf: PanelLeaf): string => leaf.own ?? leaf.path;

/**
 * One labeled row of a panel section. Holds several leaves when the schema
 * paired them.
 */
export interface PanelRow {
  label: string;
  leaves: PanelLeaf[];
  /** The path of the leaf whose `pair` made the row, when one did. */
  pair?: string;
}

/**
 * A titled block of rows, derived from one top-level section of a properties
 * schema. `key` is that section's schema key.
 */
export interface PanelSection {
  key: string;
  name: string;
  /** How the section is drawn; unset, a heading over its rows. */
  as?: PrefSectionAs;
  /** Drawn as a bar: what happens to the cells its line has no room for. */
  overflow?: PrefBarOverflow;
  /** Drawn as a bar: what its line starts with. */
  lead?: PrefBarLead;
  /** The glyph naming it, which a bar can start its line with. */
  icon?: IconRef;
  /** The key of the leaf drawn in its heading, which stays among `rows` until it is drawn there. */
  heading?: string;
  rows: PanelRow[];
}

/** A node's routing kind under `routing`, as a canvas given the same table names it. A
 *  container is `'group'` only when the table carries `groupNodeRouting`. */
export function classifyKind(
  node: AnyNode,
  routing: readonly NodeRoutingEntry[],
): string {
  return routeKind(routing, node.data, node);
}

const ALWAYS = (): boolean => true;

/** Flatten a schema to sections of leaves. Nested sections fold into their
 *  top-level section; top-level leaves get an untitled leading section. An
 *  alias becomes the leaf of `targets` it points at, as a form draws it,
 *  unless `rawAliases` keeps it for a renderer of the kind; an alias of
 *  nothing stays an alias either way. Without `targets` an alias points
 *  into `schema` itself. */
function flatten(schema: PrefSection, rawAliases: boolean, targets?: PrefAliasTargets): PanelSection[] {
  const sections: PanelSection[] = [];
  const untitled: PanelLeaf[] = [];
  const into = targets ?? prefAliasTargets(schema, () => ALWAYS, { showHidden: true });
  const shown = (key: string, leaf: PrefLeaf): PanelLeaf => {
    const target = leaf.kind === 'alias' && !rawAliases ? into.shown(leaf as PrefAlias) : undefined;
    return target ? { ...target, own: key } : { path: key, leaf };
  };

  for (const [key, child] of Object.entries(schema.members)) {
    if (isPrefLeaf(child)) {
      untitled.push(shown(key, child));
    } else {
      const leaves = prefSectionLeaves(child.members).map(([path, leaf]) => shown(path, leaf));
      const heading = prefHeadingKey(child);
      sections.push({ key, name: child.name, ...(child.as ? { as: child.as } : {}), ...(child.overflow ? { overflow: child.overflow } : {}), ...(child.lead ? { lead: child.lead } : {}), ...(child.icon ? { icon: child.icon } : {}), ...(heading ? { heading } : {}), rows: pairRows(leaves) });
    }
  }
  if (untitled.length > 0) {
    sections.unshift({ key: '', name: '', rows: pairRows(untitled) });
  }
  return sections;
}

/** Merge each leaf a `pair` names into the row of the leaf that names it,
 *  where they run consecutively, labeled as the pair says. */
export function pairRows(leaves: readonly PanelLeaf[]): PanelRow[] {
  return pairRuns(leaves, (item) => [panelLeafKey(item), item.leaf] as const).map(({ items, pair }) => ({
    label: pair?.label ?? items[0]!.leaf.name,
    leaves: items,
    ...(pair ? { pair: pair.key } : {}),
  }));
}

const NOTHING: PrefSection = { name: '', members: {} };

/** One kind's schema as a panel draws it now. */
export interface PanelShown {
  /** The schema narrowed to what is drawn. Null is nothing. */
  schema: PrefSection | null;
  /** What the schema's aliases are drawn from. Default: the schema as handed back. */
  targets?: PrefAliasTargets;
}

/**
 * The schema the panel shows for a set of kinds: one kind → its full
 * schema; several → the intersection by (path, leaf kind), shaped by the
 * first kind's section/row layout. Kinds without a registered schema
 * contribute nothing, so their presence collapses the intersection.
 * `rawAliases` leaves each alias leaf as it is written, for a caller that
 * draws the kind itself. `shownOf` narrows each kind's schema before it is
 * read, to what that kind draws now, and says where its aliases point.
 */
export function effectiveSections(
  kinds: readonly string[],
  entries: readonly NodePropertiesEntry[],
  rawAliases = false,
  shownOf?: (schema: PrefSection) => PanelShown,
): PanelSection[] {
  const uniq = [...new Set(kinds)];
  if (uniq.length === 0) return [];
  const byName = new Map(entries.map((e) => [e.name, e]));
  const schemas = uniq.map((k) => byName.get(k)?.schema);
  if (schemas.some((s) => s === undefined)) return [];
  const [flatFirst, ...rest] = (schemas as PrefSection[]).map((schema) => {
    const shown: PanelShown = shownOf ? shownOf(schema) : { schema };
    return flatten(shown.schema ?? NOTHING, rawAliases, shown.targets);
  });

  if (rest.length === 0) return flatFirst;

  // '\0' delimiter: path and kind strings are unconstrained, so a
  // printable separator could collide with real content.
  const leafKey = (l: PanelLeaf): string => `${panelLeafKey(l)}\0${l.leaf.kind}`;
  const restKeys = rest.map(
    (flat) =>
      new Set(
        flat
          .flatMap((s) => s.rows)
          .flatMap((r) => r.leaves)
          .map(leafKey),
      ),
  );
  const keep = (l: PanelLeaf): boolean =>
    restKeys.every((set) => set.has(leafKey(l)));

  return flatFirst
    // Paired again, since a pair may have lost a leaf to the other kinds.
    .map((section) => ({ ...section, rows: pairRows(section.rows.flatMap((row) => row.leaves).filter(keep)) }))
    .filter((section) => section.rows.length > 0);
}

/** Read a node value at a dotted path of any depth (`pose.x`,
 *  `data.style.fontSize`, `data.style.fill.paint.color`). Returns `undefined` if
 *  the path is dotless (mirrors `commit`'s no-op on a malformed schema
 *  key) or if any intermediate segment is missing or not an object. */
export function nodeValueAt(node: AnyNode, path: string): unknown {
  const segments = path.split('.');
  if (segments.length < 2) return undefined;
  const head = segments[0];
  let cursor: unknown = head === 'pose' ? node.pose : head === 'data' ? node.data : undefined;
  for (let i = 1; i < segments.length; i++) {
    if (cursor == null || typeof cursor !== 'object') return undefined;
    cursor = (cursor as Record<string, unknown>)[segments[i]];
  }
  return cursor;
}

/** Immutably set `value` at a dotted path within `root`, cloning each level
 *  on the way down so React sees new object identities. Arrays stay arrays
 *  (an array intermediate is shallow-copied, not flattened into `{0: ...}`)
 *  — this is the write-side twin of `nodeValueAt`, so a schema author who
 *  gets a working read gets a working write. */
export function setAtPath(root: object, segments: readonly string[], value: unknown): object {
  const [head, ...rest] = segments;
  if (rest.length === 0) {
    return Array.isArray(root)
      ? Object.assign([...root], { [head]: value })
      : { ...root, [head]: value };
  }
  const child = (root as Record<string, unknown>)[head];
  const childObj = Array.isArray(child)
    ? [...child]
    : child != null && typeof child === 'object'
      ? { ...child }
      : {};
  const nested = setAtPath(childObj, rest, value);
  return Array.isArray(root)
    ? Object.assign([...root], { [head]: nested })
    : { ...root, [head]: nested };
}

/** What a node holding `held` at a leaf's path shows there ({@link prefLeafValue}). Holding nothing reads as the
 *  leaf's default only where it says absence means that, else as `undefined`, which a panel draws as unset. */
export const nodeLeafValue = (leaf: PrefLeaf, held: unknown): unknown =>
  prefLeafValue(leaf, held, { unset: leaf.absentIsDefault !== true });

/** {@link aggregateValue} for the leaf at `path`: each node's value as {@link nodeLeafValue} shows it. */
export function aggregateLeaf(nodes: readonly AnyNode[], path: string, leaf: PrefLeaf): unknown | Mixed {
  return sharedValue(nodes.map((node) => nodeLeafValue(leaf, nodeValueAt(node, path))));
}

/** Aggregate a path across nodes: the shared value, or `MIXED`. A node
 *  holding nothing there reads as `absent`. */
export function aggregateValue(
  nodes: readonly AnyNode[],
  path: string,
  absent?: unknown,
): unknown | Mixed {
  return sharedValue(
    nodes.map((node) => {
      const held = nodeValueAt(node, path);
      return held === undefined ? absent : held;
    }),
  );
}

/** The one value `values` all are, or `MIXED`. */
export function sharedValue(values: readonly unknown[]): unknown | Mixed {
  const [first, ...rest] = values;
  return rest.every((v) => deepEqual(v, first, { undefinedAsAbsent: true })) ? first : MIXED;
}

/** Whether two stored values are one value: identical, or arrays and plain
 *  objects alike all the way down. Two nodes loaded from a file hold equal
 *  paints as separate objects. */
/** `'rect ×2 · text'` — kinds in first-seen order with counts. */
export function kindBreakdown(kinds: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const k of kinds) counts.set(k, (counts.get(k) ?? 0) + 1);
  return [...counts.entries()]
    .map(([k, n]) => (n > 1 ? `${k} ×${n}` : k))
    .join(' · ');
}
