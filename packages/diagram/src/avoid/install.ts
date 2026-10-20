/**
 * Obstacle-avoiding routing on a live scene: a scene edit pass that reroutes
 * whatever an edit disturbed, in that edit's own history entry, and a
 * transform follower that reroutes the connectors near a dragged shape each
 * frame.
 */
import {
  AUTO_POSE_DESCRIPTOR,
  createSetDataOp,
  documentPose,
  type Op,
  type PoseDescriptor,
  type Scene,
  type SceneEditSummary,
  type TransformFollower,
  type TransformPreviewNode,
} from '@weasel-js/core';
import type { Vec2 } from '@weasel-js/core/math';
import { diagramEdgeOf, samePoints, type DiagramEdge } from '../edgeTrait';
import { DIAGRAM_PASS_ORDER } from '../passOrder';
import { createAvoidRouter, type AvoidRouter, type AvoidRoutes } from './router';
import { avoidSceneInput, type AvoidSceneOptions } from './sceneInput';
import type { AvoidInput, AvoidOptions } from './types';

/** Options for {@link installAvoidRouting} and `useAvoidRouting`. */
export interface AvoidRoutingOptions<TPose> extends AvoidSceneOptions<TPose>, AvoidOptions {
  /** World units one screen pixel covers now. A drag frame that moves
   *  nothing further than this does no work. Default 1. */
  pixelSize?: () => number;
  /** Milliseconds one drag frame may spend rerouting. Default 4. */
  frameBudgetMs?: number;
}

/** Routing installed on a scene. */
export interface AvoidRouting {
  router: AvoidRouter;
  /** The drag half, for the `transformFollowers` dep (`useTransformFollower`). */
  follower: TransformFollower;
  /** Remove the edit pass. */
  dispose(): void;
}

type AnyScene = Scene<unknown, string, unknown>;

/** `data` with its edge trait holding `route`, or no route when null. */
function withRoute(data: unknown, edge: DiagramEdge, route: readonly Vec2[] | null): Record<string, unknown> {
  const { route: _r, ...rest } = edge;
  return { ...(data as Record<string, unknown>), diagram: route === null ? rest : { ...rest, route } };
}

/** The data writes that store `routes` on their edges, skipping any unchanged. */
export function routeDataOps(scene: Scene<unknown, string, unknown>, routes: AvoidRoutes): Op[] {
  const ops: Op[] = [];
  for (const [id, route] of routes) {
    const node = scene.get(id as never);
    const edge = node === undefined ? null : diagramEdgeOf(node);
    if (node === undefined || edge === null) continue;
    const had = edge.route;
    if (route === null ? had === undefined : had !== undefined && samePoints(had, route)) continue;
    ops.push(createSetDataOp({ id, from: node.data, to: withRoute(node.data, edge, route), label: 'Route' }));
  }
  return ops;
}

const touched = (s: SceneEditSummary): boolean =>
  s.added.size + s.removed.size + s.posed.size + s.reparented.size + s.dataChanged.size > 0;

/** The offset carrying `before` to `after`, read off their bounds. */
function offsetOf(geometry: PoseDescriptor<unknown>, before: unknown, after: unknown): Vec2 {
  const a = geometry.getBounds(before);
  const b = geometry.getBounds(after);
  return { x: b.x - a.x, y: b.y - a.y };
}

/** `input` with the waypoints of each edge whose two ends `frame` moves by one
 *  offset carried along, as `waypointFollower` carries them. */
function carried(sc: AnyScene, geometry: PoseDescriptor<unknown>, frame: ReadonlyMap<string, unknown>, input: AvoidInput): AvoidInput {
  const offset = (id: string): Vec2 | null => {
    const node = sc.get(id as never);
    const to = frame.get(id);
    return node === undefined || to === undefined ? null : offsetOf(geometry, documentPose(sc, node as never), to);
  };
  const edges = input.edges.map((e) => {
    if (e.waypoints === undefined) return e;
    const d = offset(e.from.node);
    const f = offset(e.to.node);
    if (d === null || f === null || d.x !== f.x || d.y !== f.y) return e;
    return { ...e, waypoints: e.waypoints.map((p) => ({ x: p.x + d.x, y: p.y + d.y })) };
  });
  return { obstacles: input.obstacles, edges };
}

/** The drag half: each frame previews the reroutes near what moved. */
function avoidFollower<TPose>(scene: Scene<unknown, string, TPose>, router: AvoidRouter, opts: AvoidRoutingOptions<TPose>): TransformFollower {
  const sc = scene as unknown as AnyScene;
  const geometry = (opts.geometry ?? AUTO_POSE_DESCRIPTOR) as PoseDescriptor<unknown>;
  let last: { frame: ReadonlyMap<string, unknown>; out: TransformPreviewNode[] } | null = null;
  const still = (frame: ReadonlyMap<string, unknown>): boolean => {
    if (last === null || last.frame.size !== frame.size) return false;
    const px = opts.pixelSize?.() ?? 1;
    for (const [id, pose] of frame) {
      const was = last.frame.get(id);
      if (was === undefined) return false;
      const d = offsetOf(geometry, was, pose);
      if (Math.abs(d.x) >= px || Math.abs(d.y) >= px) return false;
    }
    return true;
  };
  return {
    preview(frame) {
      if (frame.size === 0) return [];
      if (still(frame)) return last!.out;
      const input = carried(sc, geometry, frame, avoidSceneInput(scene, opts, (id) => frame.get(id) as TPose | undefined));
      const routes = router.update(input, { preview: true, budgetMs: opts.frameBudgetMs ?? 4 });
      const waypoints = new Map(input.edges.map((e) => [e.id, e.waypoints]));
      const out: TransformPreviewNode[] = [];
      for (const [id, route] of routes) {
        const node = sc.get(id as never);
        const edge = node === undefined ? null : diagramEdgeOf(node);
        if (node === undefined || edge === null) continue;
        const moved = waypoints.get(id);
        const trait = moved === undefined ? edge : { ...edge, waypoints: moved };
        out.push({ id, pose: node.pose, data: withRoute(node.data, trait, route) });
      }
      last = { frame, out };
      return out;
    },
    finish: (ops) => [...ops],
  };
}

/**
 * Route `scene`'s `avoid` connectors around its shapes from now on. Every
 * live edit reroutes what it disturbed, in its own history entry; on install
 * nothing reroutes, and the routes the scene holds stand. A host without
 * React calls this; a component calls `useAvoidRouting`.
 */
export function installAvoidRouting<TPose>(
  scene: Scene<unknown, string, TPose>,
  opts: AvoidRoutingOptions<TPose> = {},
): AvoidRouting {
  const sc = scene as unknown as AnyScene;
  const router = createAvoidRouter(opts);
  router.seed(avoidSceneInput(scene, opts));
  const dispose = scene.addEditPass((summary) => {
    if (!touched(summary)) return null;
    const ops = routeDataOps(sc, router.update(avoidSceneInput(scene, opts)));
    return ops.length === 0 ? null : ops;
  }, { order: DIAGRAM_PASS_ORDER.avoid });
  return { router, follower: avoidFollower(scene, router, opts), dispose };
}
