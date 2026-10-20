/**
 * Routes for a data-backed diagram: the specs `diagramScene` builds, with
 * every edge routed around the shapes. The routes derive from the data, so
 * they live in the specs and are never reported back to the host.
 */
import type { RectPose } from '@weasel-js/core';
import type { Vec2 } from '@weasel-js/core/math';
import { diagramContainerOf, headerBox } from '../containers/trait';
import { diagramEdgeOf, type DiagramEdge } from '../edgeTrait';
import type { DiagramSpec } from '../fromData';
import { portSitesOf, portsOf } from '../ports';
import { diagramNodeOf } from '../trait';
import type { Port } from '../types';
import { createAvoidRouter } from './router';
import { headerIdOf } from './sceneInput';
import type { AvoidEdge, AvoidObstacle, AvoidOptions, AvoidPort } from './types';

const facing = (ports: readonly Port[]): AvoidPort[] =>
  ports.flatMap((p) => (p.normal === null ? [] : [{ point: p.point, normal: p.normal }]));

/** The obstacles specs make, as `avoidSceneInput` reads a scene: a shape's box; a
 *  container's or pool's box as a region holding what is inside it, and its header;
 *  a lane's header alone. A derived box, a group's, is none. */
function obstaclesOf(specs: readonly DiagramSpec[]): AvoidObstacle[] {
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
    const header = region === null ? null : headerBox(spec.pose, region.header);
    if (header !== null) out.push({ id: headerIdOf(node.id), kind: 'shape', box: header });
    if (region?.role === 'lane') continue;
    out.push(region === null
      ? { id: node.id, kind: 'shape', box: spec.pose }
      : { id: node.id, kind: 'region', box: spec.pose, members: inside(node.id, new Set()) });
  }
  return out;
}

/**
 * A function from specs to the same specs with each edge on `avoid` and
 * holding its route. It holds one router across calls, so each call reroutes
 * only the edges the change since the last one disturbed.
 */
export function createSpecRouter(options: AvoidOptions = {}): (specs: readonly DiagramSpec[]) => DiagramSpec[] {
  const router = createAvoidRouter(options);
  let held = new Map<string, Vec2[] | null>();
  return (specs) => {
    const byId = new Map(specs.map((s) => [s.id as string, s]));
    const obstacles = obstaclesOf(specs);
    const edges: AvoidEdge[] = [];
    for (const spec of specs) {
      const edge = diagramEdgeOf(spec);
      if (edge === null) continue;
      const ends = Array.isArray(spec.dependsOn) ? spec.dependsOn.map((id) => byId.get(id as string)) : [];
      const [a, b] = ends;
      if (a === undefined || b === undefined || a === b) continue;
      const portsAt = (s: DiagramSpec, port: string | undefined) => {
        const n = { id: s.id as string, kind: s.kind, data: s.data };
        return facing(port === undefined ? portsOf(n, s.pose as RectPose) : portSitesOf(n, s.pose as RectPose, port));
      };
      const route = held.get(spec.id as string);
      edges.push({
        id: spec.id as string,
        from: { node: a.id as string, ports: portsAt(a, edge.from.port) },
        to: { node: b.id as string, ports: portsAt(b, edge.to.port) },
        ...(edge.waypoints !== undefined && edge.waypoints.length > 0 ? { waypoints: edge.waypoints } : {}),
        ...(route != null ? { route } : {}),
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
