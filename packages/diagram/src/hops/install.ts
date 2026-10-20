/**
 * Line jumps on a live scene: an edit pass that recomputes the hops an edit
 * disturbed, in that edit's own history entry, while the document's
 * line-jump setting is on.
 */
import type { Scene, SceneEditSummary, TransformFollower } from '@weasel-js/core';
import type { Vec2 } from '@weasel-js/core/math';
import type { EdgeRouteOptions } from '../edge';
import { DIAGRAM_PASS_ORDER } from '../passOrder';
import { samePoints } from '../edgeTrait';
import { edgeHops } from './crossings';
import { hopFollower } from './follower';
import { edgePolylines, hopDataOps, inOrUnder, sceneEdges, type AnyScene, type SceneEdge } from './sceneEdges';
import { HOPS_DOC_KEY, type HopsDocValue } from './types';

/** Options for {@link installHops} and `useHops`: how a connector routes, as
 *  its own `derivePath` does. */
export type HopsOptions<TPose> = EdgeRouteOptions<TPose>;

/** Line jumps installed on a scene. */
export interface Hops {
  /** The drag half, for the `transformFollowers` dep (`useTransformFollower`). */
  follower: TransformFollower;
  /** Remove the edit pass. */
  dispose(): void;
}

interface Box { x0: number; y0: number; x1: number; y1: number }

function boxOf(points: readonly Vec2[], pad: number): Box {
  const b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (const p of points) {
    b.x0 = Math.min(b.x0, p.x - pad);
    b.y0 = Math.min(b.y0, p.y - pad);
    b.x1 = Math.max(b.x1, p.x + pad);
    b.y1 = Math.max(b.y1, p.y + pad);
  }
  return b;
}

const meets = (a: Box, b: Box): boolean => a.x0 <= b.x1 && b.x0 <= a.x1 && a.y0 <= b.y1 && b.y0 <= a.y1;

/** Whether the ids `before` and `now` share stand in a different order. */
function reordered(before: readonly string[], now: readonly string[]): boolean {
  const was = new Set(before);
  const is = new Set(now);
  const a = before.filter((id) => is.has(id));
  const b = now.filter((id) => was.has(id));
  return a.some((id, i) => id !== b[i]);
}

/** What the pass holds between edits: each connector's last route, and the
 *  order and radius it computed against. */
interface Held {
  polylines: Map<string, Vec2[]>;
  order: string[];
  r: number;
}

/** Every connector's route, by id. */
function allPolylines(edges: readonly SceneEdge[], polylineOf: (e: SceneEdge) => Vec2[] | null): Map<string, Vec2[]> {
  const out = new Map<string, Vec2[]>();
  for (const e of edges) {
    const p = polylineOf(e);
    if (p !== null) out.set(e.node.id, p);
  }
  return out;
}

/** The connectors an edit may have rerouted: changed themselves, new, or
 *  attached to a changed node or one inside it, or to a node whose pose
 *  derives from others. */
function candidates(sc: AnyScene, edges: readonly SceneEdge[], held: Held, s: SceneEditSummary): SceneEdge[] {
  const changed = new Set<string>([...s.added, ...s.removed, ...s.posed, ...s.reparented, ...s.dataChanged]);
  const derived = (id: string) => sc.get(id as never)?.derivePose !== undefined;
  return edges.filter((e) => changed.has(e.node.id) || !held.polylines.has(e.node.id)
    || e.ends.some((end) => inOrUnder(sc, end, changed) || derived(end)));
}

/**
 * Hop `scene`'s crossing connectors while its `HOPS_DOC_KEY` value is set.
 * Turning the value on or off, or changing its size, recomputes or clears
 * every connector in that same entry; any other edit recomputes the
 * connectors it rerouted and those whose routes meet theirs. Installing
 * writes nothing. A host without React calls this; a component calls `useHops`.
 */
export function installHops<TPose>(scene: Scene<unknown, string, TPose>, opts: HopsOptions<TPose> = {}): Hops {
  const sc = scene as unknown as AnyScene;
  const polylineOf = edgePolylines(sc, opts);
  let held: Held | null = null;

  const full = (edges: SceneEdge[], r: number) => {
    const order = edges.map((e) => e.node.id);
    held = { polylines: allPolylines(edges, polylineOf), order, r };
    return hopDataOps(sc, edgeHops(held.polylines, order, r));
  };

  const pass = (summary: SceneEditSummary) => {
    const value = sc.doc.get<HopsDocValue>(HOPS_DOC_KEY);
    const keyed = summary.docChanged.has(HOPS_DOC_KEY);
    if (value === undefined) {
      held = null;
      return keyed ? hopDataOps(sc, new Map(sceneEdges(sc).map((e) => [e.node.id, []]))) : null;
    }
    const edges = sceneEdges(sc);
    const order = edges.map((e) => e.node.id);
    if (keyed || held === null || held.r !== value.size || reordered(held.order, order)) return full(edges, value.size);
    const h: Held = held;
    const r = h.r;
    const boxes: Box[] = [];
    const dirty = new Set<string>();
    for (const e of candidates(sc, edges, h, summary)) {
      const was = h.polylines.get(e.node.id);
      const now = polylineOf(e);
      if (was !== undefined && now !== null && samePoints(was, now)) continue;
      dirty.add(e.node.id);
      if (was !== undefined) boxes.push(boxOf(was, r));
      if (now === null) h.polylines.delete(e.node.id);
      else {
        boxes.push(boxOf(now, r));
        h.polylines.set(e.node.id, now);
      }
    }
    const present = new Set<string>(order);
    for (const [id, was] of h.polylines) {
      if (present.has(id)) continue;
      boxes.push(boxOf(was, r));
      h.polylines.delete(id);
    }
    h.order = order;
    if (boxes.length === 0) return null;
    const affected = new Set(dirty);
    for (const [id, points] of h.polylines) {
      if (affected.has(id)) continue;
      const box = boxOf(points, 0);
      if (boxes.some((b) => meets(box, b))) affected.add(id);
    }
    const ops = hopDataOps(sc, edgeHops(h.polylines, order, r, affected));
    return ops.length === 0 ? null : ops;
  };

  const on = sc.doc.get<HopsDocValue>(HOPS_DOC_KEY);
  if (on !== undefined) {
    const edges = sceneEdges(sc);
    held = { polylines: allPolylines(edges, polylineOf), order: edges.map((e) => e.node.id), r: on.size };
  }
  const dispose = scene.addEditPass(pass, { order: DIAGRAM_PASS_ORDER.hops });
  return { follower: hopFollower(scene), dispose };
}
