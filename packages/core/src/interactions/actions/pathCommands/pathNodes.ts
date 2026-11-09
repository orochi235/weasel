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
import { resolveEditablePathOf, storeEditablePath } from 'domains/paths/editablePath';
import { nodeFrameOf, shownIn } from 'domains/paths/nodeFrame';
import { withoutShapeGenerator } from 'domains/paths/shapeGenerator';
import { withoutGeometryBoundData } from 'domains/paths/pathEditExtension';


/** A selected node with an editable polygon, and that polygon in world space. */
export interface PathNode {
  id: NodeId;
  /** The node as stored, its pose in its parent's frame. */
  node: Node<unknown, string, unknown>;
  /** The node with its world pose: what `path` is read from, and what a
   *  world-space edit is stored against. `node` itself at the root. */
  shown: Node<unknown, string, unknown>;
  path: PolygonPath;
  /** A world pose of `shown`'s kind as the pose `node` stores. */
  local(worldPose: unknown): unknown;
}

const asStored = (pose: unknown): unknown => pose;

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
    const frame = nodeFrameOf(scene, node);
    const shown = shownIn(frame, node);
    const path = resolveEditablePathOf(shown);
    if (path) out.push({ id: id as NodeId, node, shown, path, local: frame ? frame.local : asStored });
  }
  return out;
}

/** Per node, the last path `withPath` stored and what it made of it. */
const lastStored = new WeakMap<object, { path: PolygonPath; shape: { pose: unknown; data: unknown } | null }>();

/** `target`'s node storing `worldPath` as plain geometry at its world pose:
 *  the shape `target.shown` takes. Null when it holds no editable polygon. */
export function withShownPath(target: Pick<PathNode, 'shown'>, worldPath: PolygonPath): { pose: unknown; data: unknown } | null {
  const stored = storeEditablePath(target.shown, worldPath);
  return stored ? { pose: stored.pose, data: withoutGeometryBoundData(withoutShapeGenerator(stored.data)) } : null;
}

/** `target`'s node storing `worldPath` as plain geometry, in the node's own
 *  frame, or null when it holds no editable polygon. The same object while
 *  the node and the path are, so a gesture previewing through it keeps its
 *  preview's identity between frames. */
export function withPath(target: PathNode, worldPath: PolygonPath): { pose: unknown; data: unknown } | null {
  const held = lastStored.get(target.node);
  if (held?.path === worldPath) return held.shape;
  const shown = withShownPath(target, worldPath);
  const shape = shown ? { pose: target.local(shown.pose), data: shown.data } : null;
  lastStored.set(target.node, { path: worldPath, shape });
  return shape;
}

/** The ops that give `target` the geometry `worldPath`, labeled `label`. */
export function reshapeOps(target: PathNode, worldPath: PolygonPath, label: string): Op[] {
  const next = withPath(target, worldPath);
  return next ? reshapeTo(target.node, next, label) : [];
}

/** The ops taking `node` from what it is to `next`, labeled `label`. */
export function reshapeTo(node: Node<unknown, string, unknown>, next: { pose: unknown; data: unknown }, label: string): Op[] {
  const ops: Op[] = [];
  if (next.pose !== node.pose) ops.push(createTransformOp({ id: node.id, from: node.pose, to: next.pose, label }));
  if (next.data !== node.data) ops.push(createSetDataOp({ id: node.id, from: node.data, to: next.data, label }));
  return ops;
}

/** A copy of `target`'s node under a fresh id and the same parent, holding `worldPath`. */
export function pathCopy(scene: Scene<unknown, string, unknown>, target: PathNode, worldPath: PolygonPath): Node<unknown, string, unknown> | null {
  const next = withPath(target, worldPath);
  if (!next) return null;
  return { ...target.node, id: scene.mintId(), pose: next.pose, data: next.data } as Node<unknown, string, unknown>;
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
