/**
 * `DiagramView`'s two-way sync with the data it was built from: new specs are
 * reconciled into the scene, and what a drag or a layout run changed is
 * reported back, so a consumer keeping the diagram as data can store it.
 * `diagramLayoutOf` reads the same report off a `diagramScene` build.
 */
import { reconcileSpecs, useLatest, type RectPose, type Scene } from '@weasel-js/core';
import type { Vec2 } from '@weasel-js/core/math';
import { useEffect, useRef } from 'react';
import { diagramContainerOf } from './containers/trait';
import { diagramEdgeOf, layoutOwnsRoute, samePoints, type DiagramEdge, type EdgeEnd } from './edgeTrait';
import type { DiagramSceneData, DiagramSpec } from './fromData';
import { diagramGroupOf } from './group';
import type { LayoutPorts } from './layout';
import { readRegions, regionChanges, type ContainerEdit, type RegionStanding } from './regionSync';
import { isPinned } from './trait';

export type { ContainerEdit };

/** Where a moved node now stands. `parent` is present when a drop changed
 *  the region it is in: that container's or lane's id, or `null` for the top
 *  level. The host moves the id from one `members` list to the other. */
export interface NodeMove { id: string; x: number; y: number; parent?: string | null }

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
  nodes: Map<string, { x: number; y: number; parent: string | null }>;
  routes: Map<string, Route>;
  regions: RegionStanding;
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
  const nodes = new Map<string, { x: number; y: number; parent: string | null }>();
  const routes = new Map<string, Route>();
  for (const n of scene.renderOrderNodes()) {
    if (n.kind === 'group') {
      if (diagramContainerOf(n) === null) nodes.set(n.id, { x: n.pose.x, y: n.pose.y, parent: n.parent });
      continue;
    }
    const edge = diagramEdgeOf(n);
    if (edge !== null) routes.set(n.id, routeOf(edge));
  }
  return { nodes, routes, regions: readRegions(scene as never) };
}

/** What layout placed in a `diagramScene` build, in the shapes `DiagramView`
 *  reports: every node not pinned, where it stands, every edge whose route
 *  or ports layout wrote, and the box of every container and pool not pinned
 *  whose box is its own rather than fitted. Store them the way `onMove` and
 *  `onEditContainer` say and the next build leaves them where they are. */
export function diagramLayoutOf(specs: readonly DiagramSpec[]): { moves: NodeMove[]; routes: EdgeRoute[]; containers: ContainerEdit[] } {
  const moves: NodeMove[] = [];
  const routes: EdgeRoute[] = [];
  const containers: ContainerEdit[] = [];
  for (const s of specs) {
    const id = s.id;
    if (id === undefined) continue;
    if (s.kind === 'group') {
      const region = diagramContainerOf(s);
      const pinned = isPinned({ id, kind: s.kind, data: s.data });
      if (region !== null) {
        if (!pinned && region.role !== 'lane' && region.fitted !== true) {
          const { x, y, width, height } = s.pose;
          containers.push({ kind: 'box', id, box: { x, y, width, height } });
        }
      } else if (diagramGroupOf(s) === null && !pinned) moves.push({ id, x: s.pose.x, y: s.pose.y });
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
  return { moves, routes, containers };
}

interface Changes { moves: NodeMove[]; routes: EdgeRoute[]; containers: ContainerEdit[] }

function changes(was: Standing, now: Standing): Changes {
  const moves: NodeMove[] = [];
  for (const [id, { x, y, parent }] of now.nodes) {
    const before = was.nodes.get(id);
    if (before === undefined) continue;
    const reparented = before.parent !== parent;
    if (before.x !== x || before.y !== y || reparented) moves.push({ id, x, y, ...(reparented ? { parent } : {}) });
  }
  const routes: EdgeRoute[] = [];
  for (const [id, after] of now.routes) {
    const before = was.routes.get(id);
    if (before === undefined) continue;
    const moved = before.waypoints !== after.waypoints && !samePoints(before.waypoints, after.waypoints);
    if (moved || !samePorts(before.ports, after.ports)) routes.push({ id, ...after });
  }
  return { moves, routes, containers: regionChanges(was.regions, now.regions) };
}

/** The callbacks {@link useSceneSync} reports to. */
export interface SceneSyncReports {
  onMove?: ((moves: readonly NodeMove[], routes: readonly EdgeRoute[]) => void) | undefined;
  onEditContainer?: ((edit: ContainerEdit) => void) | undefined;
}

/** Reconcile `specs` into `scene` as they change, and report every move and
 *  route change that did not come from a reconcile to `onMove`, and every
 *  region change to `onEditContainer`. */
export function useSceneSync(scene: DiagramScene, specs: readonly DiagramSpec[], reports: SceneSyncReports): void {
  const reportsRef = useLatest(reports);
  const syncing = useRef(false);
  const applied = useRef(specs);
  useEffect(() => {
    let known = readScene(scene);
    return scene.subscribe(() => {
      const now = readScene(scene);
      const found = syncing.current ? null : changes(known, now);
      known = now;
      if (found === null) return;
      if (found.moves.length > 0 || found.routes.length > 0) reportsRef.current.onMove?.(found.moves, found.routes);
      for (const edit of found.containers) reportsRef.current.onEditContainer?.(edit);
    });
  }, [scene, reportsRef]);
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
