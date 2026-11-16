import {
  asNodeId,
  type BooleansAdapter,
  defaultCommitAdapter,
  type Path,
  pathInWorld,
  pathNode,
  type PathPaint,
  pathPaintOf,
  type NodeOutline,
  sceneNodeOutline,
  type SelectionApi,
} from '@weasel-js/core';
import { carriedData, type DrawScene, type WeaselDrawData, type WeaselDrawLayer } from './drawDocument';

/** The outline of a leaf that is not a path — a text node's glyphs — as its painter gives it. */
export function outlineAt(scene: DrawScene, id: string): NodeOutline | undefined {
  return scene.get(asNodeId(id))?.data.path ? undefined : sceneNodeOutline(scene, id);
}

/** A path leaf's geometry in world space. */
export function worldPathOf(scene: DrawScene, id: string): Path | undefined {
  const node = scene.get(asNodeId(id));
  if (!node || node.kind !== 'mark' || !node.data.path) return undefined;
  return pathInWorld(node.data.path, node.pose);
}

/** The paint a path leaf wears. */
export function pathPaintAt(scene: DrawScene, id: string): PathPaint | undefined {
  const node = scene.get(asNodeId(id));
  if (!node || node.kind !== 'mark' || !node.data.path) return undefined;
  return pathPaintOf(node.data);
}

/** The adapter the kit's Pathfinder actions run WeaselDraw's boolean ops
 *  through. The scene-backed commit adapter supplies the reorder contract, so
 *  the kit places each result in its topmost source's slot. */
export function drawBooleansAdapter(
  scene: DrawScene,
  selection: SelectionApi['adapterMethods'],
): BooleansAdapter {
  const a: BooleansAdapter = {
    ...defaultCommitAdapter(scene, selection),
    getWorldPath: (id) => worldPathOf(scene, id),
    getPaint: (id) => pathPaintAt(scene, id),
    getOutline: (id) => outlineAt(scene, id),
    compareZ: (x, y) => {
      const order = [...scene.renderOrder()];
      return order.indexOf(asNodeId(x)) - order.indexOf(asNodeId(y));
    },
    createPathNode: (path, _op, sourceId, paint) => {
      // The result continues the source it stands in for: that node's paint, and
      // whatever else it carried.
      const source = scene.get(sourceId);
      const template = source?.data;
      const data: WeaselDrawData = {
        ...carriedData(template),
        ...(paint ?? {
          ...(template?.fill !== undefined ? { fill: template.fill } : {}),
          ...(template?.stroke !== undefined ? { stroke: template.stroke } : {}),
        }),
      };
      return pathNode<WeaselDrawData, WeaselDrawLayer>(scene.mintId(), path, data, { parent: source?.parent ?? null });
    },
    applyOps: (ops, label) => {
      scene.applyBatch(ops, label ?? 'Booleans', a);
    },
  };
  return a;
}
