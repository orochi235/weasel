// Pure selection→panel derivations for SelectionPanel. Kept free of
// React so intersection/aggregation semantics are unit-testable.
//
// Path convention (see core `NodePropertiesEntry`): a leaf's OWN KEY in
// the schema is its node path — two dotted segments rooted at `pose` or
// `data` (`pose.x`, `data.fill`). Group keys are organizational only.

import type {
  NodePropertiesEntry,
  NodeRoutingEntry,
  SceneNode,
  ToolPrefGroup,
  ToolPrefLeaf,
} from '@weasel-js/core';

/** Sentinel for "selected nodes disagree at this path". */
export const MIXED: unique symbol = Symbol('weasel-ui:mixed');
export type Mixed = typeof MIXED;

export type AnyNode = SceneNode<unknown, string, unknown>;

export interface PanelLeaf {
  /** Dotted node path — the leaf's key in the schema. */
  path: string;
  leaf: ToolPrefLeaf;
}

export interface PanelRow {
  label: string;
  leaves: PanelLeaf[];
}

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

  const restKeys = rest.map(
    (schema) =>
      new Set(
        flatten(schema)
          .flatMap((s) => s.rows)
          .flatMap((r) => r.leaves)
          .map((l) => `${l.path} ${l.leaf.kind}`),
      ),
  );
  const keep = (l: PanelLeaf): boolean =>
    restKeys.every((set) => set.has(`${l.path} ${l.leaf.kind}`));

  return flatFirst
    .map((section) => ({
      ...section,
      rows: section.rows
        .map((row) => ({ ...row, leaves: row.leaves.filter(keep) }))
        .filter((row) => row.leaves.length > 0),
    }))
    .filter((section) => section.rows.length > 0);
}

/** Read a node value at a two-segment path (`pose.x` / `data.fill`). */
export function nodeValueAt(node: AnyNode, path: string): unknown {
  const dot = path.indexOf('.');
  if (dot < 0) return undefined;
  const head = path.slice(0, dot);
  const key = path.slice(dot + 1);
  const root = head === 'pose' ? node.pose : head === 'data' ? node.data : undefined;
  if (root == null || typeof root !== 'object') return undefined;
  return (root as Record<string, unknown>)[key];
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
