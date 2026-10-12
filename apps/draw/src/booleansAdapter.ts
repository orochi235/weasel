import {
  asNodeId,
  type BooleansAdapter,
  boundsOfPath,
  DEFAULT_SHAPE_FILL,
  defaultCommitAdapter,
  type NodeId,
  type Path,
  pathInWorld,
  type PathPaint,
  pathPaintOf,
  type Scene,
  type SelectionApi,
  type TextNodeSource,
} from '@weasel-js/core';
import type { WeaselDrawData, WeaselDrawLayer, WeaselDrawPose } from './drawDocument';

export type DrawScene = Scene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>;

/** A text leaf as the kit's outline extraction reads it. */
export function textSourceOf(scene: DrawScene, id: string): TextNodeSource | undefined {
  const node = scene.get(asNodeId(id));
  if (!node || node.kind !== 'leaf') return undefined;
  const { text, runs, style, verticalAlign, path, fill, stroke } = node.data;
  if (text === undefined || path) return undefined;
  return { data: { text, runs, style, verticalAlign, fill, stroke }, pose: node.pose };
}

/** A path leaf's geometry in world space. */
export function worldPathOf(scene: DrawScene, id: string): Path | undefined {
  const node = scene.get(asNodeId(id));
  if (!node || node.kind !== 'leaf' || !node.data.path) return undefined;
  return pathInWorld(node.data.path, node.pose);
}

/** The paint a path leaf wears. */
export function pathPaintAt(scene: DrawScene, id: string): PathPaint | undefined {
  const node = scene.get(asNodeId(id));
  if (!node || node.kind !== 'leaf' || !node.data.path) return undefined;
  return pathPaintOf(node.data);
}

/** The adapter the kit's Pathfinder actions run WeaselDraw's boolean ops
 *  through. The scene-backed commit adapter supplies the reorder contract, so
 *  the kit places each result in its topmost source's slot. */
export function drawBooleansAdapter(
  scene: DrawScene,
  selection: SelectionApi['adapterMethods'],
): BooleansAdapter {
  let idCounter = 0;
  const a: BooleansAdapter = {
    ...defaultCommitAdapter(scene, selection),
    getWorldPath: (id) => worldPathOf(scene, id),
    getPaint: (id) => pathPaintAt(scene, id),
    getTextSource: (id) => textSourceOf(scene, id),
    compareZ: (x, y) => {
      const order = [...scene.renderOrder()];
      return order.indexOf(asNodeId(x)) - order.indexOf(asNodeId(y));
    },
    createPathNode: (path, _op, sourceId, paint) => {
      // Mint convention: pose = boundsOfPath(path); geometry lives in data.path.
      // Booleans, slice (sliceCommit.ts), and release-compound (onReleaseCompound)
      // all follow this same convention — the data payload that varies per site
      // is too context-specific (style inheritance source) to share a helper.
      // The result wears the paint of the source it stands in for.
      const source = scene.get(sourceId);
      const template = source?.kind === 'leaf' ? source.data : undefined;
      const b = boundsOfPath(path);
      // Ids restart with the session, and a reloaded document keeps the last
      // session's.
      let id: string;
      do id = `b-${idCounter++}`; while (scene.get(asNodeId(id)));
      const node: { id: string; kind: 'leaf'; layer: WeaselDrawLayer; pose: WeaselDrawPose; data: WeaselDrawData; parent: NodeId | null } = {
        id,
        kind: 'leaf',
        layer: 'default',
        pose: { x: b.x, y: b.y, width: b.width, height: b.height },
        data: paint ? { path, ...paint } : {
          path,
          fill: template?.fill !== undefined ? template.fill : DEFAULT_SHAPE_FILL,
          ...(template?.stroke !== undefined ? { stroke: template.stroke } : {}),
        },
        parent: scene.get(sourceId)?.parent ?? null,
      };
      return node;
    },
    applyOps: (ops, label) => {
      scene.applyBatch(ops, label ?? 'Booleans', a);
    },
  };
  return a;
}
