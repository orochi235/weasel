// Scene nodes as panel records: a node's kind, and its value at a leaf's path.

import type { AnyNode } from '@weasel-js/core';
import { sharedValue, type Mixed } from '@weasel-js/ui/components/PanelCells';
import { declaredField, nodeRoot } from './declaredFields';

/** A scene node of any data, layer, and pose. */
export type { AnyNode };

/** Read a node value at a dotted path of any depth (`pose.x`,
 *  `data.style.fontSize`, `data.style.fill.paint.color`), or at a field the
 *  node declares for its children (`clip`, `units.unit`). Returns `undefined`
 *  for a bare `pose` or `data` (mirrors `commit`'s no-op on a malformed schema
 *  key) or if any intermediate segment is missing or not an object. */
export function nodeValueAt(node: AnyNode, path: string): unknown {
  const segments = path.split('.');
  const head = segments[0];
  if (segments.length < 2 && !declaredField(head)) return undefined;
  let cursor: unknown = nodeRoot(node, head);
  for (let i = 1; i < segments.length; i++) {
    if (cursor == null || typeof cursor !== 'object' || !Object.hasOwn(cursor, segments[i]!)) return undefined;
    cursor = (cursor as Record<string, unknown>)[segments[i]!];
  }
  return cursor;
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
