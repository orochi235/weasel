import { boundsOfPath, type Path } from '@weasel-js/geom';
import type { PathPaint } from 'canvas/nodeShapes/nodePaint';
import { createInsertOp } from 'core/ops/create';
import { createDeleteOp } from 'core/ops/delete';
import { createSetSelectionOp } from 'core/ops/select';
import { locateChild } from 'core/ops/slot';
import { unionBounds } from 'core/geometry/unionBounds';
import type { Op } from 'core/ops/types';
import type { NodeId } from 'core/scene/types';
import { dispatchApplyBatch } from 'core/applyOps';
import type { CreateOutlinesAdapter, OutlinePathSpec } from './createOutlines';

/** A world-space path and the paint it is to wear. */
export interface PaintedPath extends PathPaint {
  path: Path;
}

/**
 * Replace each node in `converted` with its `paths`, back to front, as one
 * batch under `label`: in the node's own slot, inside a container when it has
 * several paths and the adapter mints one. The rest of `sel` stays selected.
 * Answers what took each node's place at its level.
 */
export function replaceWithPaths(
  adapter: CreateOutlinesAdapter,
  sel: readonly NodeId[],
  converted: readonly { id: NodeId; paths: readonly PaintedPath[] }[],
  label: string,
): Map<NodeId, string[]> {
  const ops: Op[] = [];
  const replaced = new Map<NodeId, string[]>();
  // Replacements in the same parent are inserted top slot first, so an
  // earlier one widening the sibling list cannot shift a later one's index.
  const located = converted.map((c) => ({ ...c, at: locateChild(adapter, c.id) }));
  const order = [...located].sort((a, b) => (b.at?.index ?? -1) - (a.at?.index ?? -1));
  for (const { id, paths, at } of order) {
    const node = adapter.getNode(id) ?? { id };
    const index = at?.index ?? -1;
    const parent = at?.parentId ?? adapter.getParent(id);
    const place = (created: { id: string }, i: number) =>
      createInsertOp(index >= 0 ? { node: created, index: index + i } : { node: created });
    ops.push(createDeleteOp({ node, index }));

    const container = paths.length > 1
      ? adapter.createContainerNode?.(id, { parent, bounds: unionBounds(paths.map((p) => boundsOfPath(p.path)))! })
      : undefined;
    if (container) {
      ops.push(place(container, 0));
      for (const p of paths) {
        ops.push(createInsertOp({ node: adapter.createPathNode(p.path, id, specOf(p, container.id)) }));
      }
      replaced.set(id, [container.id]);
    } else {
      const created = paths.map((p) => adapter.createPathNode(p.path, id, specOf(p, parent)));
      created.forEach((n, i) => ops.push(place(n, i)));
      replaced.set(id, created.map((n) => n.id));
    }
  }
  ops.push(createSetSelectionOp({
    from: [...sel],
    to: sel.flatMap((id) => (replaced.get(id) ?? [id]) as NodeId[]),
  }));
  dispatchApplyBatch(adapter, ops, label);
  return replaced;
}

function specOf(p: PaintedPath, parent: string | null): OutlinePathSpec {
  return p.stroke !== undefined ? { fill: p.fill, stroke: p.stroke, parent } : { fill: p.fill, parent };
}
