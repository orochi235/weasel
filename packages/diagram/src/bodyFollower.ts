/**
 * A resized body's rows go with it: a whole-node transform that changes a
 * built body's size stacks its rows again inside the new box, the way
 * `layoutBody` would, from the row heights its trait records.
 */
import {
  AUTO_POSE_DESCRIPTOR,
  createTransformOp,
  type PoseDescriptor,
  type Scene,
  type TransformFollower,
  type TransformPreviewNode,
} from '@weasel-js/core';
import { layoutBody } from './body';
import { recordedRows } from './bodyRelayout';
import type { Bounds } from './outline';
import { diagramNodeOf } from './trait';
import { posesMovedBy } from './waypointFollower';

type AnyScene = Scene<unknown, string, unknown>;

/** Each row node of every body `frame` resizes, at the pose the new size puts it in. */
function restacked(sc: AnyScene, geometry: PoseDescriptor<unknown>, frame: ReadonlyMap<string, unknown>): TransformPreviewNode[] {
  const out: TransformPreviewNode[] = [];
  for (const [id, pose] of frame) {
    const node = sc.get(id as never);
    const trait = node === undefined ? null : diagramNodeOf(node);
    const layout = trait?.body;
    if (node === undefined || layout === undefined || trait?.outline === undefined) continue;
    const before = geometry.getBounds(node.pose);
    const after = geometry.getBounds(pose);
    if (before.width === after.width && before.height === after.height) continue;
    const rows = recordedRows(layout);
    if (rows === null) continue;
    const boxes = layoutBody({ outline: trait.outline, rows, padding: layout.padding, gap: layout.gap, verticalAlign: layout.verticalAlign }, after);
    for (const child of sc.childrenOf(id as never)) {
      const c = sc.get(child)!;
      const index = (c.data as { bodyRow?: unknown } | null)?.bodyRow;
      const box = typeof index === 'number' ? boxes[index] : undefined;
      if (box !== undefined) out.push({ id: child as string, pose: { ...(c.pose as Bounds), x: box.x, y: box.y, width: box.width, height: box.height } });
    }
  }
  return out;
}

/**
 * The transform follower that lays a resized body's rows out again, for the
 * `transformFollowers` dep (`useTransformFollower`). A body saved before its
 * row heights were recorded is left as it is. `geometry` reads a pose's
 * bounds; default `AUTO_POSE_DESCRIPTOR`.
 */
export function bodyFollower<TPose>(
  scene: Scene<unknown, string, TPose>,
  geometry: PoseDescriptor<TPose> = AUTO_POSE_DESCRIPTOR as PoseDescriptor<TPose>,
): TransformFollower {
  const sc = scene as unknown as AnyScene;
  const geo = geometry as PoseDescriptor<unknown>;
  return {
    preview: (frame) => restacked(sc, geo, frame),
    finish(ops, label) {
      const moved = posesMovedBy(sc, ops);
      if (moved === null || moved.size === 0) return [...ops];
      const rows = restacked(sc, geo, moved).map((r) => createTransformOp({ id: r.id, from: sc.get(r.id as never)!.pose, to: r.pose, label }));
      return [...ops, ...rows];
    },
  };
}
