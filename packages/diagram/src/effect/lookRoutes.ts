/** Routes a person drew under `rack` and `lanes`, which place every stage
 *  themselves: each holds only while its wire's ends are where they were
 *  drawn from. */
import { RIGID_POSE_COMPOSITION, worldPosesOf } from '@weasel-js/core';
import type { Vec2 } from '@weasel-js/core/math';
import { diagramScene, edgeIdOf, type DiagramSpec } from '../fromData';
import { portOf } from '../ports';
import type { EditorLook, EditorScene } from './editorMapping';
import type { EffectDoc, LookRoute, LookRoutes } from './types';

/** The looks whose routes `lookRoutes` keeps. */
export type RoutedLook = keyof LookRoutes;

const EPS = 1e-3;
const near = (a: Vec2, b: Vec2) => Math.abs(a.x - b.x) <= EPS && Math.abs(a.y - b.y) <= EPS;
const copy = (p: Vec2): Vec2 => ({ x: p.x, y: p.y });

/** `doc` with `routes` as its look routes, leaving out what is empty. */
function withLookRoutes(doc: EffectDoc, routes: LookRoutes): EffectDoc {
  const kept = Object.fromEntries(Object.entries(routes).filter(([, r]) => r !== undefined && Object.keys(r).length > 0));
  const { lookRoutes: _was, ...rest } = doc;
  return Object.keys(kept).length > 0 ? { ...rest, lookRoutes: kept } : rest;
}

/** Routes wire `wire` through `waypoints` under `look`, for as long as its
 *  ends stay at `ends`, its from end first. No waypoints gives the wire back
 *  to the look. */
export function setLookRoute(
  doc: EffectDoc, look: RoutedLook, wire: string, waypoints: readonly Vec2[], ends: readonly [Vec2, Vec2],
): EffectDoc {
  const { [wire]: _was, ...rest } = doc.lookRoutes?.[look] ?? {};
  const route: LookRoute = { waypoints: waypoints.map(copy), ends: [copy(ends[0]), copy(ends[1])] };
  return withLookRoutes(doc, { ...doc.lookRoutes, [look]: waypoints.length > 0 ? { ...rest, [wire]: route } : rest });
}

/** `doc` without the look routes of wires it no longer has, or of the
 *  `rewired` ones, whose ends now join other ports. */
export function pruneLookRoutes(doc: EffectDoc, rewired: Iterable<string> = []): EffectDoc {
  if (doc.lookRoutes === undefined) return doc;
  const gone = new Set(rewired);
  const ids = new Set(doc.pipeline.wires.flatMap((w) => (w.id === undefined || gone.has(w.id) ? [] : [w.id])));
  const keep = (r: Readonly<Record<string, LookRoute>> | undefined) =>
    r === undefined ? undefined : Object.fromEntries(Object.entries(r).filter(([id]) => ids.has(id)));
  return withLookRoutes(doc, { rack: keep(doc.lookRoutes.rack), lanes: keep(doc.lookRoutes.lanes) });
}

type EdgeTrait = { from?: { port?: string }; to?: { port?: string } };

/** The points of the ports edge `edge` joins as `specs` draw it, from end
 *  first, or `undefined` when either end names no port. */
export function wireEnds(specs: readonly DiagramSpec[], edge: string): [Vec2, Vec2] | undefined {
  const spec = specs.find((s) => s.id === edge);
  const trait = (spec?.data as { diagram?: EdgeTrait } | undefined)?.diagram;
  const [from, to] = (spec?.dependsOn ?? []) as readonly string[];
  const world = worldPosesOf(specs, RIGID_POSE_COMPOSITION);
  const point = (node: string | undefined, port: string | undefined) => {
    const n = node === undefined || port === undefined ? undefined : specs.find((s) => s.id === node);
    return n === undefined ? undefined : portOf({ id: node!, kind: n.kind ?? 'mark', data: n.data }, world.get(node!)!, port!)?.point;
  };
  const a = point(from, trait?.from?.port);
  const b = point(to, trait?.to?.port);
  return a === undefined || b === undefined ? undefined : [a, b];
}

/** `specs`, drawn from `built`, with each wire `doc` routed under `look`
 *  drawn through its waypoints where its ends are still where they were. An
 *  edge's own waypoints win over the route a look worked out (`routed`), as
 *  for any `DataEdge`. `specs` itself when no route holds. */
export function applyLookRoutes(
  specs: readonly DiagramSpec[], doc: EffectDoc, look: EditorLook, built: EditorScene,
): readonly DiagramSpec[] {
  const routes = look === 'nodeGraph' ? undefined : doc.lookRoutes?.[look];
  if (routes === undefined) return specs;
  let held = false;
  const edges = built.data.edges.map((e) => {
    const id = edgeIdOf(e);
    const wire = built.wireOf(id);
    const route = wire === undefined ? undefined : routes[wire];
    const ends = route === undefined ? undefined : wireEnds(specs, id);
    if (route === undefined || ends === undefined || !near(ends[0], route.ends[0]) || !near(ends[1], route.ends[1])) return e;
    held = true;
    return { ...e, waypoints: route.waypoints };
  });
  return held ? diagramScene({ ...built.data, edges }, built.scene) : specs;
}
