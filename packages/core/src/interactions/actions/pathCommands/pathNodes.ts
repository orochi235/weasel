/**
 * What the path commands share: reading the selected path nodes, and writing
 * new geometry back into a node or into a copy of one. A node's geometry is
 * stored where it already lives (`storeEditablePath`); a shape generator, and
 * the data in `GEOMETRY_BOUND_DATA`, which no longer make it or name anchors
 * it no longer has, are dropped.
 */
import type { ActionDeps } from '@weasel-js/routing';
import type { PolygonPath } from '@weasel-js/geom';
import type { Node, NodeId, Scene } from 'core/scene/types';
import type { Op } from 'core/ops/types';
import { createTransformOp } from 'core/ops/transform';
import { createSetDataOp } from 'core/ops/setData';
import { createInsertOp } from 'core/ops/create';
import { createDeleteOp } from 'core/ops/delete';
import { resolveEditablePathOf, storeEditablePath } from 'features/paths/editablePath';
import { withoutShapeGenerator } from 'features/paths/shapeGenerator';
import { withoutGeometryBoundData } from 'features/paths/pathEditExtension';


/** A selected node with an editable polygon, and that polygon in world space. */
export interface PathNode {
  id: NodeId;
  node: Node<unknown, string, unknown>;
  path: PolygonPath;
}

/** The selected leaves that hold an editable polygon, in selection order. */
export function selectedPathNodes(deps: ActionDeps | undefined): PathNode[] {
  const scene = deps?.scene as Scene<unknown, string, unknown> | undefined;
  return scene ? pathNodesOf(scene, deps?.selection?.get() ?? []) : [];
}

/** The leaves among `ids` that hold an editable polygon, in the order given.
 *  `shapeOf` stands in a node's pose and data, as an in-flight gesture would
 *  leave them, for its own. */
export function pathNodesOf(
  scene: Pick<Scene<unknown, string, unknown>, 'get'>,
  ids: readonly string[],
  shapeOf?: (id: string) => { pose: unknown; data: unknown } | undefined,
): PathNode[] {
  const out: PathNode[] = [];
  for (const id of ids) {
    const found = scene.get(id as NodeId);
    if (!found || found.kind !== 'mark') continue;
    const shape = shapeOf?.(id);
    const node = shape ? ({ ...found, pose: shape.pose, data: shape.data } as Node<unknown, string, unknown>) : found;
    const path = resolveEditablePathOf(node);
    if (path) out.push({ id: id as NodeId, node, path });
  }
  return out;
}

/** Per node, the last path `withPath` stored and what it made of it. */
const lastStored = new WeakMap<object, { path: PolygonPath; shape: { pose: unknown; data: unknown } | null }>();

/** `node` storing `worldPath` as plain geometry, or null when it holds no
 *  editable polygon. The same object while the node and the path are, so a
 *  gesture previewing through it keeps its preview's identity between frames. */
export function withPath(node: Node<unknown, string, unknown>, worldPath: PolygonPath): { pose: unknown; data: unknown } | null {
  const held = lastStored.get(node);
  if (held?.path === worldPath) return held.shape;
  const stored = storeEditablePath(node, worldPath);
  const shape = stored ? { pose: stored.pose, data: withoutGeometryBoundData(withoutShapeGenerator(stored.data)) } : null;
  lastStored.set(node, { path: worldPath, shape });
  return shape;
}

/** The ops that give `node` the geometry `worldPath`, labeled `label`. */
export function reshapeOps(node: Node<unknown, string, unknown>, worldPath: PolygonPath, label: string): Op[] {
  const next = withPath(node, worldPath);
  return next ? reshapeTo(node, next, label) : [];
}

/** The ops taking `node` from what it is to `next`, labeled `label`. */
export function reshapeTo(node: Node<unknown, string, unknown>, next: { pose: unknown; data: unknown }, label: string): Op[] {
  const ops: Op[] = [];
  if (next.pose !== node.pose) ops.push(createTransformOp({ id: node.id, from: node.pose, to: next.pose, label }));
  if (next.data !== node.data) ops.push(createSetDataOp({ id: node.id, from: node.data, to: next.data, label }));
  return ops;
}

/** A copy of `node` under a fresh id, holding `worldPath`. */
export function pathCopy(scene: Scene<unknown, string, unknown>, node: Node<unknown, string, unknown>, worldPath: PolygonPath): Node<unknown, string, unknown> | null {
  const next = withPath(node, worldPath);
  if (!next) return null;
  return { ...node, id: scene.mintId(), pose: next.pose, data: next.data } as Node<unknown, string, unknown>;
}

/** Where `id` sits among its siblings, back to front. */
export function slotOf(scene: Scene<unknown, string, unknown>, id: NodeId): number {
  const parent = scene.get(id)?.parent ?? null;
  const siblings = parent === null ? scene.roots : scene.childrenOf(parent);
  return siblings.indexOf(id);
}

/** Insert `node` at `index` among its parent's children. */
export function insertAt(node: Node<unknown, string, unknown>, index: number, label: string): Op {
  return createInsertOp(index >= 0 ? { node, index, label } : { node, label });
}

/** Delete `node`, remembering its slot for undo. */
export function deleteNode(scene: Scene<unknown, string, unknown>, node: Node<unknown, string, unknown>, label: string): Op {
  return createDeleteOp({ node, index: slotOf(scene, node.id), label });
}
