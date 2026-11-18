import {
  asNodeId, AUTO_POSE_DESCRIPTOR, defaultCommitAdapter, drawnPose, type NodeId, type Path, pathInWorld, pathNode, type PathPaint,
  pathPaintOf, type NodeOutline, renderOrderCompare, sceneNodeOutline, scenePoseFrame, type Scene, type SelectionApi,
} from '@weasel-js/core';
import { carriedData, type DrawScene, type WeaselDrawData, type WeaselDrawLayer, type WeaselDrawPose } from './drawDocument';
import { type BooleansAdapter } from '@weasel-js/editing';

/** The outline of a leaf that is not a path — a text node's glyphs — as its painter gives it. */
export function outlineAt(scene: DrawScene, id: string): NodeOutline | undefined {
  return scene.get(asNodeId(id))?.data.path ? undefined : sceneNodeOutline(scene, id);
}

/** A path leaf's geometry in world space: its stored pose folded through the
 *  frames above it, a page's among them. */
export function worldPathOf(scene: DrawScene, id: string): Path | undefined {
  const node = scene.get(asNodeId(id));
  if (!node || node.kind !== 'mark' || !node.data.path) return undefined;
  const drawn = drawnPose(AUTO_POSE_DESCRIPTOR, scenePoseFrame(scene as unknown as Scene<unknown, string, unknown>).world(node.id));
  return drawn ? pathInWorld(node.data.path, drawn.box) : undefined;
}

/** `spec`, posed at world bounds by `pathNode`, with its pose restated in
 *  `parent`'s frame: what a node minted under `parent` stores. Throws where that
 *  frame is singular, since no stored pose there shows the result. */
export function inFrameOf<S extends { pose: WeaselDrawPose }>(scene: DrawScene, parent: string | null, spec: S): S {
  const local = scenePoseFrame(scene as unknown as Scene<unknown, string, unknown>)
    .localUnder(parent as NodeId | null, spec.pose);
  if (local === null) throw new Error(`[draw] no pose under ${parent} shows ${JSON.stringify(spec.pose)}`);
  return { ...spec, pose: local as WeaselDrawPose };
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
    compareZ: renderOrderCompare(scene),
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
      const parent = source?.parent ?? null;
      return inFrameOf(scene, parent, pathNode<WeaselDrawData, WeaselDrawLayer>(scene.mintId(), path, data, { parent }));
    },
    applyOps: (ops, label) => {
      scene.applyBatch(ops, label ?? 'Booleans', a);
    },
  };
  return a;
}
