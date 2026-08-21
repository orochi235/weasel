// Pure selection→panel derivations for SelectionPanel. Kept free of
// React so intersection/aggregation semantics are unit-testable.
//
// Path convention (see core `NodePropertiesEntry`): a leaf's OWN KEY in
// the schema is its node path — a dotted path of any depth rooted at
// `pose` or `data` (`pose.x`, `data.fill`, `data.style.fontSize`). Group
// keys are organizational only.

import {
  MIXED,
  type Mixed,
  type NodePropertiesEntry,
  type NodeRoutingEntry,
  type SceneNode,
  type ToolPrefGroup,
  type ToolPrefLeaf,
} from '@weasel-js/core';

// Re-exported under its existing public name here: the kit-wide "these
// values disagree" sentinel (`@weasel-js/core`'s `MIXED`) also covers
// multi-node aggregation, so this panel doesn't get its own symbol.
export { MIXED };
export type { Mixed };

export type AnyNode = SceneNode<unknown, string, unknown>;

/**
 * One editable property in a {@link SelectionPanel}, paired with the dotted
 * node path it reads and writes.
 */
export interface PanelLeaf {
  /** Dotted node path — the leaf's key in the schema. */
  path: string;
  leaf: ToolPrefLeaf;
}

/**
 * One labeled row of a panel section. Holds several leaves when the schema
 * paired them.
 */
export interface PanelRow {
  label: string;
  leaves: PanelLeaf[];
}

/**
 * A titled block of rows, derived from one top-level group of a properties
 * schema. `key` is that group's schema key.
 */
export interface PanelSection {
  key: string;
  name: string;
  rows: PanelRow[];
}

/** Derive a node's kind: containers are `'group'`; leaves classify their
 *  `data` through the routing entries (first match wins, `'unknown'`
 *  otherwise) — same semantics as core's `NodeRouting.classify`. */
export function classifyKind(
  node: AnyNode,
  routing: readonly NodeRoutingEntry[],
): string {
  if (node.kind === 'container') return 'group';
  for (const entry of routing) {
    if (entry.matches(node.data)) return entry.name;
  }
  return 'unknown';
}

function isGroup(n: ToolPrefLeaf | ToolPrefGroup): n is ToolPrefGroup {
  return !('kind' in n);
}

/** Flatten a schema to sections of leaves. Nested groups fold into their
 *  top-level section; top-level leaves get an untitled leading section. */
function flatten(schema: ToolPrefGroup): PanelSection[] {
  const sections: PanelSection[] = [];
  const untitled: PanelLeaf[] = [];

  const collect = (group: ToolPrefGroup, into: PanelLeaf[]): void => {
    for (const [key, child] of Object.entries(group.children)) {
      if (isGroup(child)) collect(child, into);
      else into.push({ path: key, leaf: child });
    }
  };

  for (const [key, child] of Object.entries(schema.children)) {
    if (isGroup(child)) {
      const leaves: PanelLeaf[] = [];
      collect(child, leaves);
      sections.push({ key, name: child.name, rows: pairRows(leaves) });
    } else {
      untitled.push({ path: key, leaf: child });
    }
  }
  if (untitled.length > 0) {
    sections.unshift({ key: '', name: '', rows: pairRows(untitled) });
  }
  return sections;
}

/** Merge consecutive leaves sharing a `pair` id into one labeled row. */
function pairRows(leaves: readonly PanelLeaf[]): PanelRow[] {
  const rows: PanelRow[] = [];
  for (const item of leaves) {
    const pair = item.leaf.pair;
    const prev = rows[rows.length - 1];
    if (pair !== undefined && prev !== undefined && prev.label === pair) {
      prev.leaves.push(item);
    } else {
      rows.push({ label: pair ?? item.leaf.name, leaves: [item] });
    }
  }
  return rows;
}

/**
 * The schema the panel shows for a set of kinds: one kind → its full
 * schema; several → the intersection by (path, leaf kind), shaped by the
 * first kind's section/row layout. Kinds without a registered schema
 * contribute nothing, so their presence collapses the intersection.
 */
export function effectiveSections(
  kinds: readonly string[],
  entries: readonly NodePropertiesEntry[],
): PanelSection[] {
  const uniq = [...new Set(kinds)];
  if (uniq.length === 0) return [];
  const byName = new Map(entries.map((e) => [e.name, e]));
  const schemas = uniq.map((k) => byName.get(k)?.schema);
  if (schemas.some((s) => s === undefined)) return [];
  const [first, ...rest] = schemas as ToolPrefGroup[];

  const flatFirst = flatten(first);
  if (rest.length === 0) return flatFirst;

  // '\0' delimiter: path and kind strings are unconstrained, so a
  // printable separator could collide with real content.
  const leafKey = (l: PanelLeaf): string => `${l.path}\0${l.leaf.kind}`;
  const restKeys = rest.map(
    (schema) =>
      new Set(
        flatten(schema)
          .flatMap((s) => s.rows)
          .flatMap((r) => r.leaves)
          .map(leafKey),
      ),
  );
  const keep = (l: PanelLeaf): boolean =>
    restKeys.every((set) => set.has(leafKey(l)));

  return flatFirst
    .map((section) => ({
      ...section,
      rows: section.rows
        .map((row) => ({ ...row, leaves: row.leaves.filter(keep) }))
        .filter((row) => row.leaves.length > 0),
    }))
    .filter((section) => section.rows.length > 0);
}

/** Read a node value at a dotted path of any depth (`pose.x`,
 *  `data.style.fontSize`, `data.style.fill.color`). Returns `undefined` if
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

/** Aggregate a path across nodes: the shared value, or `MIXED`. */
export function aggregateValue(
  nodes: readonly AnyNode[],
  path: string,
): unknown | Mixed {
  let value: unknown;
  let first = true;
  for (const node of nodes) {
    const v = nodeValueAt(node, path);
    if (first) {
      value = v;
      first = false;
    } else if (!Object.is(v, value)) {
      return MIXED;
    }
  }
  return value;
}

/** `'rect ×2 · text'` — kinds in first-seen order with counts. */
export function kindBreakdown(kinds: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const k of kinds) counts.set(k, (counts.get(k) ?? 0) + 1);
  return [...counts.entries()]
    .map(([k, n]) => (n > 1 ? `${k} ×${n}` : k))
    .join(' · ');
}
