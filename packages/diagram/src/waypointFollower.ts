/**
 * Waypoints ride along with a move: when a whole-node transform carries both
 * ends of an edge by the same offset, the edge's waypoints go with them.
 * Otherwise they stay put — a route the author placed is not bent by moving
 * one end.
 */
import {
  AUTO_POSE_DESCRIPTOR,
  createSetDataOp,
  writtenBy,
  type PoseDescriptor,
  type Scene,
  type TransformFollower,
  type TransformPreviewNode,
} from '@weasel-js/core';
import type { Vec2 } from '@weasel-js/core/math';
import { diagramEdgeOf, samePoints, type DiagramEdge } from './edgeTrait';

type AnyScene = Scene<unknown, string, unknown>;

const EPS = 1e-6;

/** The offset carrying `before` to `after`, read off their bounds. */
function offsetOf(geometry: PoseDescriptor<unknown>, before: unknown, after: unknown): Vec2 {
  const a = geometry.getBounds(before);
  const b = geometry.getBounds(after);
  return { x: b.x - a.x, y: b.y - a.y };
}

/** `edge` with its waypoints moved by `d`, and layout's mark moved with them while layout still owns them. */
function carried(edge: DiagramEdge, d: Vec2): DiagramEdge {
  const move = (points: readonly Vec2[]) => points.map((p) => ({ x: p.x + d.x, y: p.y + d.y }));
  const waypoints = move(edge.waypoints ?? []);
  const owned = edge.laidOut !== undefined && samePoints(edge.waypoints ?? [], edge.laidOut);
  return { ...edge, waypoints, ...(owned ? { laidOut: waypoints } : {}) };
}

/** Each edge whose two ends `frame` moves by one offset, with its data as
 *  that offset leaves it. `frame` holds the poses the transform gives the
 *  nodes it moves. */
function followers(sc: AnyScene, geometry: PoseDescriptor<unknown>, frame: ReadonlyMap<string, unknown>): TransformPreviewNode[] {
  const out: TransformPreviewNode[] = [];
  for (const node of sc.renderOrderNodes()) {
    const edge = diagramEdgeOf(node);
    const ends = node.dependsOn;
    if (edge === null || (edge.waypoints ?? []).length === 0 || !Array.isArray(ends) || ends.length !== 2) continue;
    const [from, to] = ends.map((id) => sc.get(id));
    const fromAfter = frame.get(ends[0]!);
    const toAfter = frame.get(ends[1]!);
    if (from === undefined || to === undefined || fromAfter === undefined || toAfter === undefined) continue;
    const d = offsetOf(geometry, from.pose, fromAfter);
    const e = offsetOf(geometry, to.pose, toAfter);
    if (Math.abs(d.x - e.x) > EPS || Math.abs(d.y - e.y) > EPS || (d.x === 0 && d.y === 0)) continue;
    const data = node.data as Record<string, unknown>;
    out.push({ id: node.id, pose: node.pose, data: { ...data, diagram: carried(edge, d) } });
  }
  return out;
}

/** The poses `ops` change, by node id. */
export function posesMovedBy(sc: AnyScene, ops: Parameters<TransformFollower['finish']>[0]): Map<string, unknown> | null {
  const written = writtenBy(sc, ops);
  if (written === null) return null;
  const moved = new Map<string, unknown>();
  for (const [id, w] of written) if (w.pose !== sc.get(id as never)?.pose) moved.set(id, w.pose);
  return moved;
}

/**
 * The transform follower that carries waypoints along with a move, for the
 * `transformFollowers` dep (`useTransformFollower`). `geometry` reads a pose's
 * bounds; default `AUTO_POSE_DESCRIPTOR`.
 */
export function waypointFollower<TPose>(
  scene: Scene<unknown, string, TPose>,
  geometry: PoseDescriptor<TPose> = AUTO_POSE_DESCRIPTOR as PoseDescriptor<TPose>,
): TransformFollower {
  const sc = scene as unknown as AnyScene;
  const geo = geometry as PoseDescriptor<unknown>;
  return {
    preview: (frame) => (frame.size < 2 ? [] : followers(sc, geo, frame)),
    finish(ops, label) {
      const moved = posesMovedBy(sc, ops);
      if (moved === null || moved.size < 2) return [...ops];
      const changes = followers(sc, geo, moved).map((c) => createSetDataOp({
        id: c.id, from: sc.get(c.id as never)!.data, to: c.data, label,
      }));
      return [...ops, ...changes];
    },
  };
}
