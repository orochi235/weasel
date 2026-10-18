/**
 * `DiagramView`'s two-way sync with the data it was built from: new specs are
 * reconciled into the scene, and what a drag or a layout run changed is
 * reported back, so a consumer keeping the diagram as data can store it.
 * `diagramLayoutOf` reads the same report off a `diagramScene` build.
 */
import { reconcileSpecs, useLatest, type RectPose, type Scene } from '@weasel-js/core';
import type { Vec2 } from '@weasel-js/core/math';
import { useEffect, useRef } from 'react';
import { diagramEdgeOf, layoutOwnsRoute, samePoints, type DiagramEdge, type EdgeEnd } from './edgeTrait';
import type { DiagramSceneData, DiagramSpec } from './fromData';
import { diagramGroupOf } from './group';
import type { LayoutPorts } from './layout';
import { isPinned } from './trait';

/** Where a moved node now stands. */
export interface NodeMove { id: string; x: number; y: number }

/** An edge whose route or ports a layout run rewrote. `id` is the edge's
 *  scene id, `edgeIdOf` of its data edge; `waypoints` is empty when the run
 *  took a route away and left the edge straight, and `ports` names the ends
 *  layout owns. Store them as the data edge's `routed` and `routedPorts`,
 *  which stay layout's, not as `waypoints`, `fromPort` and `toPort`, which
 *  would be the author's and rename the edge. */
export interface EdgeRoute { id: string; waypoints: readonly Vec2[]; ports: LayoutPorts }

type DiagramScene = Scene<DiagramSceneData, 'main', RectPose>;

interface Route { waypoints: readonly Vec2[]; ports: LayoutPorts }

interface Standing {
  nodes: Map<string, { x: number; y: number }>;
  routes: Map<string, Route>;
}

const NONE: readonly Vec2[] = [];

/** The port layout owns at `end`, if it named one. */
const laidPort = (end: EdgeEnd) => (end.laidOut !== undefined && end.port === end.laidOut ? end.laidOut : undefined);

function portsOf(from: EdgeEnd, to: EdgeEnd): LayoutPorts {
  const f = laidPort(from);
  const t = laidPort(to);
  return { ...(f !== undefined ? { from: f } : {}), ...(t !== undefined ? { to: t } : {}) };
}

const samePorts = (a: LayoutPorts, b: LayoutPorts) => a.from === b.from && a.to === b.to;

const routeOf = (edge: DiagramEdge): Route => ({ waypoints: edge.waypoints ?? NONE, ports: portsOf(edge.from, edge.to) });

function readScene(scene: DiagramScene): Standing {
  const nodes = new Map<string, { x: number; y: number }>();
  const routes = new Map<string, Route>();
  for (const n of scene.renderOrderNodes()) {
    if (n.kind === 'container') {
      nodes.set(n.id, { x: n.pose.x, y: n.pose.y });
      continue;
    }
    const edge = diagramEdgeOf(n);
    if (edge !== null) routes.set(n.id, routeOf(edge));
  }
  return { nodes, routes };
}

/** What layout placed in a `diagramScene` build, in the shape `DiagramView`'s
 *  `onMove` reports: every node not pinned, where it stands, and every edge
 *  whose route or ports layout wrote. Store them the way `onMove` says and
 *  the next build leaves those nodes where they are. */
export function diagramLayoutOf(specs: readonly DiagramSpec[]): { moves: NodeMove[]; routes: EdgeRoute[] } {
  const moves: NodeMove[] = [];
  const routes: EdgeRoute[] = [];
  for (const s of specs) {
    const id = s.id;
    if (id === undefined) continue;
    if (s.kind === 'container') {
      if (diagramGroupOf(s) === null && !isPinned({ id, kind: s.kind, data: s.data })) moves.push({ id, x: s.pose.x, y: s.pose.y });
      continue;
    }
    const edge = diagramEdgeOf(s);
    if (edge === null) continue;
    const route = routeOf(edge);
    const laid = edge.laidOut !== undefined && route.waypoints.length > 0 && layoutOwnsRoute(edge);
    if (laid || route.ports.from !== undefined || route.ports.to !== undefined) {
      routes.push({ id, waypoints: laid ? route.waypoints : NONE, ports: route.ports });
    }
  }
  return { moves, routes };
}

function changes(was: Standing, now: Standing): { moves: NodeMove[]; routes: EdgeRoute[] } {
  const moves: NodeMove[] = [];
  for (const [id, at] of now.nodes) {
    const before = was.nodes.get(id);
    if (before !== undefined && (before.x !== at.x || before.y !== at.y)) moves.push({ id, ...at });
  }
  const routes: EdgeRoute[] = [];
  for (const [id, after] of now.routes) {
    const before = was.routes.get(id);
    if (before === undefined) continue;
    const moved = before.waypoints !== after.waypoints && !samePoints(before.waypoints, after.waypoints);
    if (moved || !samePorts(before.ports, after.ports)) routes.push({ id, ...after });
  }
  return { moves, routes };
}

/** Reconcile `specs` into `scene` as they change, and report every move and
 *  route change that did not come from a reconcile to `onMove`. */
export function useSceneSync(
  scene: DiagramScene,
  specs: readonly DiagramSpec[],
  onMove: ((moves: readonly NodeMove[], routes: readonly EdgeRoute[]) => void) | undefined,
): void {
  const onMoveRef = useLatest(onMove);
  const syncing = useRef(false);
  const applied = useRef(specs);
  useEffect(() => {
    let known = readScene(scene);
    return scene.subscribe(() => {
      const now = readScene(scene);
      const found = syncing.current ? null : changes(known, now);
      known = now;
      if (found !== null && (found.moves.length > 0 || found.routes.length > 0)) {
        onMoveRef.current?.(found.moves, found.routes);
      }
    });
  }, [scene, onMoveRef]);
  useEffect(() => {
    if (applied.current === specs) return;
    syncing.current = true;
    try {
      reconcileSpecs(scene, applied.current as DiagramSpec[], specs as DiagramSpec[]);
    } finally {
      syncing.current = false;
    }
    applied.current = specs;
  }, [scene, specs]);
}
