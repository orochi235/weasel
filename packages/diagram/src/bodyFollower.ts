/**
 * A resized body's rows go with it: a whole-node transform that changes a
 * built body's size stacks its rows again inside the new box, the way
 * `layoutBody` would, from the row heights its trait records.
 */
import {
  type Scene,
  type TransformFollower,
  type TransformPreviewNode,
  type AnyScene,
} from '@weasel-js/core';
import { recordedLayout } from './bodyRelayout';
import { AUTO_LAYOUT_FRAME, type LayoutFrame } from './layoutFrame';
import type { Bounds } from './outline';
import { diagramNodeOf } from './trait';
import { posesMovedBy } from './waypointFollower';
import * as coreOps from '@weasel-js/core/ops';

/** Each row node of every body `frame` resizes, at the pose the new size puts it in. */
function restacked(sc: AnyScene, plane: LayoutFrame<unknown>, frame: ReadonlyMap<string, unknown>): TransformPreviewNode[] {
  const out: TransformPreviewNode[] = [];
  for (const [id, pose] of frame) {
    const node = sc.get(id as never);
    const trait = node === undefined ? null : diagramNodeOf(node);
    if (node === undefined || trait?.body === undefined || trait.outline === undefined) continue;
    const before = plane.box(node.pose);
    const after = plane.box(pose);
    if (before.width === after.width && before.height === after.height) continue;
    // Rows are stored in the body's own frame.
    const boxes = recordedLayout(trait, { x: 0, y: 0, width: after.width, height: after.height });
    if (boxes === null) continue;
    for (const child of sc.childrenOf(id as never)) {
      const c = sc.get(child)!;
      const data = c.data as { bodyRow?: unknown; bodyAside?: unknown } | null;
      const row = typeof data?.bodyRow === 'number' ? boxes[data.bodyRow] : undefined;
      const box = data?.bodyAside === true ? row?.aside : row;
      if (box !== undefined) out.push({ id: child as string, pose: { ...(c.pose as Bounds), x: box.x, y: box.y, width: box.width, height: box.height } });
    }
  }
  return out;
}

/**
 * The transform follower that lays a resized body's rows out again, for the
 * `transformFollowers` dep (`useTransformFollower`). A body saved before its
 * row heights were recorded is left as it is. `plane` reads a pose's box;
 * default {@link AUTO_LAYOUT_FRAME}.
 */
export function bodyFollower<TPose>(
  scene: Scene<unknown, string, TPose>,
  plane: LayoutFrame<TPose> = AUTO_LAYOUT_FRAME as LayoutFrame<TPose>,
): TransformFollower {
  const sc = scene as unknown as AnyScene;
  const geo = plane as LayoutFrame<unknown>;
  return {
    preview: (frame) => restacked(sc, geo, frame),
    finish(ops, label) {
      const moved = posesMovedBy(sc, ops);
      if (moved === null || moved.size === 0) return [...ops];
      const rows = restacked(sc, geo, moved).map((r) => coreOps.setPose({ id: r.id, from: sc.get(r.id as never)!.pose, to: r.pose, label }));
      return [...ops, ...rows];
    },
  };
}
