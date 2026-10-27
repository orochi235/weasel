/**
 * Routes for a data-backed diagram: the specs `diagramScene` builds, with
 * every edge routed around the shapes. The routes derive from the data, so
 * they live in the specs and are never reported back to the host.
 */
import { RIGID_POSE_COMPOSITION, worldPosesOf, type PoseComposition, type RectPose } from '@weasel-js/core';
import type { Vec2 } from '@weasel-js/core/math';
import { diagramContainerOf, headerBox } from '../containers/trait';
import { diagramEdgeOf, type DiagramEdge } from '../edgeTrait';
import type { DiagramSpec } from '../fromData';
import { diagramLabelOf } from '../labelTrait';
import { portSitesOf, portsOf } from '../ports';
import { diagramNodeOf } from '../trait';
import type { Port } from '../types';
import { createAvoidRouter } from './router';
import { headerIdOf } from './sceneInput';
import type { AvoidEdge, AvoidLabel, AvoidObstacle, AvoidOptions, AvoidPort } from './types';

const facing = (ports: readonly Port[]): AvoidPort[] =>
  ports.flatMap((p) => (p.normal === null ? [] : [{ point: p.point, normal: p.normal }]));

/** The obstacles specs make, as `avoidSceneInput` reads a scene: a shape's box; a
 *  container's or pool's box as a region holding what is inside it, and its header;
 *  a lane's header alone. A derived box, a group's, is none. */
function obstaclesOf(specs: readonly DiagramSpec[], world: ReadonlyMap<string, RectPose>): AvoidObstacle[] {
  const children = new Map<string, string[]>();
  for (const s of specs) {
    if (s.parent == null) continue;
    children.set(s.parent as string, [...(children.get(s.parent as string) ?? []), s.id as string]);
  }
  const inside = (id: string, into: Set<string>): Set<string> => {
    for (const child of children.get(id) ?? []) {
      into.add(child);
      inside(child, into);
    }
    return into;
  };
  const out: AvoidObstacle[] = [];
  for (const spec of specs) {
    const node = { id: spec.id as string, kind: spec.kind, data: spec.data };
    if (spec.derivePose !== undefined || diagramEdgeOf(spec) !== null) continue;
    const region = diagramContainerOf(spec);
    if (diagramNodeOf(node) === null && region?.role !== 'lane') continue;
    const box = world.get(node.id) ?? (spec.pose as RectPose);
    const header = region === null ? null : headerBox(box, region.header);
    if (header !== null) out.push({ id: headerIdOf(node.id), kind: 'shape', box: header });
    if (region?.role === 'lane') continue;
    out.push(region === null
      ? { id: node.id, kind: 'shape', box }
      : { id: node.id, kind: 'region', box, members: inside(node.id, new Set()) });
  }
  return out;
}

/** Each edge's label spec, by the edge it labels. */
function labelsOf(specs: readonly DiagramSpec[]): Map<string, AvoidLabel> {
  const out = new Map<string, AvoidLabel>();
  for (const spec of specs) {
    const label = diagramLabelOf(spec);
    const owner = Array.isArray(spec.dependsOn) ? spec.dependsOn[0] as string | undefined : undefined;
    if (label === null || owner === undefined || out.has(owner)) continue;
    const { width, height } = spec.pose as RectPose;
    out.set(owner, { id: spec.id as string, placement: label, size: { width, height } });
  }
  return out;
}

/** How {@link createSpecRouter} routes: the router's own options, and the composition the specs' poses are stored
 *  under, which must be the one `diagramScene` was given. Default {@link RIGID_POSE_COMPOSITION}, as there. */
export interface SpecRouterOptions extends AvoidOptions {
  composition?: PoseComposition<RectPose>;
}

/**
 * A function from specs to the same specs with each edge on `avoid` and
 * holding its route. It holds one router across calls, so each call reroutes
 * only the edges the change since the last one disturbed. Shapes and ports are
 * read where they draw, each pose folded through the containers above it.
 */
export function createSpecRouter(options: SpecRouterOptions = {}): (specs: readonly DiagramSpec[]) => DiagramSpec[] {
  const { composition = RIGID_POSE_COMPOSITION, ...avoid } = options;
  const router = createAvoidRouter(avoid);
  let held = new Map<string, Vec2[] | null>();
  return (specs) => {
    const byId = new Map(specs.map((s) => [s.id as string, s]));
    const labels = labelsOf(specs);
    const world = worldPosesOf(specs as never, composition) as Map<string, RectPose>;
    const obstacles = obstaclesOf(specs, world);
    const edges: AvoidEdge[] = [];
    for (const spec of specs) {
      const edge = diagramEdgeOf(spec);
      if (edge === null || edge.offPage !== undefined) continue;
      const ends = Array.isArray(spec.dependsOn) ? spec.dependsOn.map((id) => byId.get(id as string)) : [];
      const [a, b] = ends;
      if (a === undefined || b === undefined || a === b) continue;
      const portsAt = (s: DiagramSpec, port: string | undefined) => {
        const n = { id: s.id as string, kind: s.kind, data: s.data };
        const pose = world.get(n.id) ?? (s.pose as RectPose);
        return facing(port === undefined ? portsOf(n, pose) : portSitesOf(n, pose, port));
      };
      const route = held.get(spec.id as string);
      edges.push({
        id: spec.id as string,
        from: { node: a.id as string, ports: portsAt(a, edge.from.port) },
        to: { node: b.id as string, ports: portsAt(b, edge.to.port) },
        ...(edge.waypoints !== undefined && edge.waypoints.length > 0 ? { waypoints: edge.waypoints } : {}),
        ...(route != null ? { route } : {}),
        ...(labels.has(spec.id as string) ? { label: labels.get(spec.id as string)! } : {}),
      });
    }
    if (edges.length === 0) return [...specs];
    const next = new Map(held);
    for (const [id, route] of router.update({ obstacles, edges })) next.set(id, route);
    held = new Map(edges.map((e) => [e.id, next.get(e.id) ?? null]));
    return specs.map((spec) => {
      const edge = diagramEdgeOf(spec);
      if (edge === null || !held.has(spec.id as string)) return spec;
      const route = held.get(spec.id as string);
      const { route: _r, ...rest } = edge;
      const diagram: DiagramEdge = { ...rest, router: 'avoid', ...(route != null ? { route } : {}) };
      return { ...spec, data: { ...spec.data, diagram } };
    });
  };
}
