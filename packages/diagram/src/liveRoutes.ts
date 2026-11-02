/**
 * The edge half of a live layout: each route the run will rewrite, eased from
 * where it ran to where the run puts it, frame by frame, alongside the nodes,
 * and drawn through the ports the run will name for its ends.
 *
 * Nothing here writes the document. A frame's route is published as the edge's
 * path on the scene's override channel, drawn by the edge's own `derivePath`
 * through the frame's waypoints and the poses its ends are drawn at; the
 * routes themselves are written once, when the run arrives (`routeWrites`).
 */
import { useEffect, useMemo, useRef } from 'react';
import {
  AUTO_POSE_DESCRIPTOR,
  derivedDepOf,
  type DerivedDep,
  type PoseDescriptor,
  type NodeId,
  type Path,
  type PoseOverride,
  type Scene,
} from '@weasel-js/core';
import type { Vec2 } from '@weasel-js/core/math';
import { lerpPoint } from '@weasel-js/geom';
import { diagramEdgeOf, layoutWritesRoute, type DiagramEdge } from './edgeTrait';
import type { Graph } from './graph';
import { routeWrites, type LayoutRoutes } from './routeWrites';

/** One route on its way from where it ran to where layout puts it. */
export interface RouteEasing {
  id: string;
  /** Point `k` of the route eases from `from[k]` to `to[k]`. */
  from: readonly Vec2[];
  /** As long as `from`, or `null` for a route layout takes away: it eases
   *  onto the straight line between its ends' centers where each frame draws
   *  them, and arrives with no waypoints at all. */
  to: readonly Vec2[] | null;
  /** The edge's ends as the run will write them, ports and all. */
  ends: Pick<DiagramEdge, 'from' | 'to'>;
}

/** The point `s` of the way along the polyline through `points`, 0 to 1. */
function along(points: readonly Vec2[], s: number): Vec2 {
  if (points.length === 1) return points[0]!;
  const lengths = points.slice(1).map((p, i) => Math.hypot(p.x - points[i]!.x, p.y - points[i]!.y));
  const total = lengths.reduce((a, b) => a + b, 0);
  let left = s * total;
  for (const [i, len] of lengths.entries()) {
    if (left <= len || i === lengths.length - 1) return lerpPoint(points[i]!, points[i + 1]!, len === 0 ? 0 : Math.min(left / len, 1));
    left -= len;
  }
  return points[points.length - 1]!;
}

/** `count` points spread evenly along the straight line from `start` to
 *  `end`, its ends left off. */
const straightRun = (count: number, start: Vec2, end: Vec2): Vec2[] =>
  Array.from({ length: count }, (_, k) => lerpPoint(start, end, (k + 1) / (count + 1)));

/** `points` as `count` points spread along the same run, its ends kept. A
 *  run of none is the straight line from `start` to `end`. */
function respread(points: readonly Vec2[], count: number, start: Vec2, end: Vec2): Vec2[] {
  if (points.length === count) return [...points];
  if (points.length === 0) return straightRun(count, start, end);
  return Array.from({ length: count }, (_, k) => along(points, count === 1 ? 0.5 : k / (count - 1)));
}

/**
 * The routes a run eases: every edge `routes` lays out that the run will
 * rewrite, whether its route or the ports its ends name. A route gaining
 * waypoints starts on the straight line between its ends' centers; one losing
 * them ends there.
 */
export function routeEasings<TPose>(
  scene: Scene<unknown, string, TPose>,
  graph: Graph,
  routes: LayoutRoutes,
): RouteEasing[] {
  const centerOf = (id: string): Vec2 | null => {
    const ids = graph.node(id) !== undefined ? [id] : graph.groups?.find((g) => g.id === id)?.members ?? [];
    const boxes = ids.flatMap((m) => graph.node(m)?.bounds ?? []);
    if (boxes.length === 0) return null;
    const x0 = Math.min(...boxes.map((b) => b.x));
    const y0 = Math.min(...boxes.map((b) => b.y));
    const x1 = Math.max(...boxes.map((b) => b.x + b.width));
    const y1 = Math.max(...boxes.map((b) => b.y + b.height));
    return { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
  };
  const writes = routeWrites(scene as never, routes);
  const out: RouteEasing[] = [];
  for (const id of routes.edges) {
    const node = scene.get(id as NodeId);
    const edge = node === undefined ? null : diagramEdgeOf(node);
    const written = writes.get(id);
    if (node === undefined || edge === null || written === undefined) continue;
    const next = diagramEdgeOf({ data: written });
    if (next === null) continue;
    const ends = { from: next.from, to: next.to };
    const was = edge.waypoints ?? [];
    if (!layoutWritesRoute(edge)) {
      out.push({ id, from: was, to: was, ends });
      continue;
    }
    const after = routes.waypoints.get(id) ?? [];
    if (after.length === 0) {
      out.push({ id, from: was, to: null, ends });
      continue;
    }
    const deps = Array.isArray(node.dependsOn) ? node.dependsOn : [];
    const [a, b] = deps.length === 2 ? [centerOf(deps[0]!), centerOf(deps[1]!)] : [null, null];
    if (a === null || b === null) continue;
    const count = Math.max(was.length, after.length);
    out.push({ id, from: respread(was, count, a, b), to: respread(after, count, a, b), ends });
  }
  return out;
}

/**
 * Each eased route's path `u` of the way there, drawn by the edge's own
 * `derivePath` with its ends where `poseOf` puts them. A node `poseOf` does
 * not place is drawn where the scene shows it, unless it derives its pose —
 * a group's box — when it is derived afresh from where this frame puts what
 * it depends on. An edge that derives no path is left out.
 */
export function easedPaths<TPose>(
  scene: Scene<unknown, string, TPose>,
  easings: readonly RouteEasing[],
  u: number,
  poseOf: (id: string) => TPose | undefined,
  geometry: PoseDescriptor<TPose> = AUTO_POSE_DESCRIPTOR as PoseDescriptor<TPose>,
): Map<string, Path> {
  const depOf = frameDeps(scene, poseOf);
  const centerOf = (dep: DerivedDep<TPose>): Vec2 => {
    const b = geometry.getBounds(dep.pose);
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };
  const out = new Map<string, Path>();
  for (const { id, from, to, ends } of easings) {
    const node = scene.get(id as NodeId);
    if (node?.derivePath === undefined || !Array.isArray(node.dependsOn)) continue;
    const deps = node.dependsOn.map(depOf);
    let target = to;
    if (target === null) {
      const [a, b] = deps;
      target = u >= 1 || a === undefined || b === undefined ? [] : straightRun(from.length, centerOf(a), centerOf(b));
    }
    const waypoints = target.length === 0 && u >= 1 ? [] : from.map((p, k) => lerpPoint(p, target[k]!, u));
    const data = node.data as { diagram: object };
    const diagram = { ...data.diagram, ...ends, waypoints };
    const path = node.derivePath({ ...node, data: { ...data, diagram } } as never, deps);
    if (path !== null) out.set(id, path);
  }
  return out;
}

/** Each node as this frame draws it: where `poseOf` puts it, else derived from
 *  where this frame puts its dependencies, else where the scene shows it. */
function frameDeps<TPose>(
  scene: Scene<unknown, string, TPose>,
  poseOf: (id: string) => TPose | undefined,
): (id: string) => DerivedDep<TPose> | undefined {
  const memo = new Map<string, DerivedDep<TPose> | undefined>();
  const depOf = (id: string): DerivedDep<TPose> | undefined => {
    if (memo.has(id)) return memo.get(id);
    // Closes a cycle at the scene's answer rather than recursing forever.
    memo.set(id, derivedDepOf(scene, id as NodeId));
    const shown = memo.get(id);
    if (shown === undefined) return undefined;
    const pose = poseOf(id) ?? derivedFromFrame(scene, shown, depOf) ?? shown.pose;
    const dep: DerivedDep<TPose> = { node: shown.node, pose, get path() { return shown.path; } };
    memo.set(id, dep);
    return dep;
  };
  return depOf;
}

/** `shown`'s pose derived from where this frame draws its dependencies, or
 *  `undefined` when it derives none or something else holds it this frame. */
function derivedFromFrame<TPose>(
  scene: Scene<unknown, string, TPose>,
  shown: DerivedDep<TPose>,
  depOf: (id: string) => DerivedDep<TPose> | undefined,
): TPose | undefined {
  const { node } = shown;
  if (node.derivePose === undefined || scene.overrides.read(node.id)?.pose !== undefined) return undefined;
  const ids = node.dependsOn === 'children' ? scene.childrenOf(node.id) : node.dependsOn ?? [];
  if (ids.length === 0) return undefined;
  return node.derivePose(node as never, ids.map(depOf)) ?? undefined;
}

/** A claim on some edges' paths in the override channel. */
export interface PathHold {
  /** Show these paths, and stop showing any other this hold showed. */
  show(paths: ReadonlyMap<string, Path>): void;
  /** Stop showing every path this hold shows, revealing whatever other
   *  writers' overrides lie under each. */
  drop(): void;
}

/** A {@link PathHold} on `scene`'s override channel. Its writes are published
 *  with the next `commit` of the channel, which the run's own pose frame makes. */
export function pathHold<TPose>(scene: Scene<unknown, string, TPose>): PathHold {
  const held = new Map<string, PoseOverride<TPose>>();
  const release = (id: string, entry: PoseOverride<TPose>) => {
    held.delete(id);
    scene.overrides.clear(id as NodeId, entry);
  };
  return {
    show(paths) {
      for (const [id, entry] of held) if (!paths.has(id)) release(id, entry);
      for (const [id, path] of paths) {
        const entry = held.get(id);
        if (entry !== undefined && scene.overrides.has(id as NodeId, entry)) {
          entry.path = path;
          continue;
        }
        const fresh: PoseOverride<TPose> = { path };
        held.set(id, fresh);
        scene.overrides.set(id as NodeId, fresh);
      }
    },
    drop() {
      for (const [id, entry] of held) release(id, entry);
    },
  };
}

/** The routes a live run eases, and where it shows them. Stable for the life
 *  of the component, and drops what it shows when the component unmounts. */
export interface EasedRoutes<TPose> {
  /** The routes the run now eases; any shown before stop showing. */
  set(easings: readonly RouteEasing[]): void;
  /** Show each route `u` of the way there, its ends where `poseOf` puts
   *  them; `null` shows none. `geometry` reads the poses' bounds. */
  show(
    scene: Scene<unknown, string, TPose>,
    u: number | null,
    poseOf: (id: string) => TPose | undefined,
    geometry?: PoseDescriptor<TPose>,
  ): void;
  /** Stop showing them. */
  drop(): void;
}

export function useEasedRoutes<TPose>(): EasedRoutes<TPose> {
  const easings = useRef<readonly RouteEasing[]>([]);
  const held = useRef<{ scene: Scene<unknown, string, TPose>; hold: PathHold } | null>(null);
  const routes = useMemo<EasedRoutes<TPose>>(() => ({
    set(next) {
      held.current?.hold.drop();
      easings.current = next;
    },
    show(scene, u, poseOf, geometry) {
      if (u === null) held.current?.hold.drop();
      if (u === null || easings.current.length === 0) return;
      if (held.current?.scene !== scene) {
        held.current?.hold.drop();
        held.current = { scene, hold: pathHold(scene) };
      }
      held.current.hold.show(easedPaths(scene, easings.current, u, poseOf, geometry));
    },
    drop() {
      held.current?.hold.drop();
    },
  }), []);
  useEffect(() => () => routes.drop(), [routes]);
  return routes;
}
