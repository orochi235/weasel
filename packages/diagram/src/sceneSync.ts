/**
 * `DiagramView`'s two-way sync with the data it was built from: new specs are
 * reconciled into the scene, and what a drag or a layout run changed is
 * reported back, so a consumer keeping the diagram as data can store it.
 */
import { reconcileSpecs, useLatest, type RectPose, type Scene } from '@weasel-js/core';
import type { Vec2 } from '@weasel-js/core/math';
import { useEffect, useRef } from 'react';
import { diagramEdgeOf, samePoints } from './edge';
import type { DiagramSceneData, DiagramSpec } from './fromData';

/** Where a moved node now stands. */
export interface NodeMove { id: string; x: number; y: number }

/** An edge whose route a layout run rewrote. `id` is the edge's scene id,
 *  `edgeIdOf` of its data edge; `waypoints` is empty when the run took a
 *  route away and left the edge straight. */
export interface EdgeRoute { id: string; waypoints: readonly Vec2[] }

type DiagramScene = Scene<DiagramSceneData, 'main', RectPose>;

interface Standing {
  nodes: Map<string, { x: number; y: number }>;
  routes: Map<string, readonly Vec2[] | undefined>;
}

const NONE: readonly Vec2[] = [];

function readScene(scene: DiagramScene): Standing {
  const nodes = new Map<string, { x: number; y: number }>();
  const routes = new Map<string, readonly Vec2[] | undefined>();
  for (const n of scene.renderOrderNodes()) {
    if (n.kind === 'container') {
      nodes.set(n.id, { x: n.pose.x, y: n.pose.y });
      continue;
    }
    const edge = diagramEdgeOf(n);
    if (edge !== null) routes.set(n.id, edge.waypoints);
  }
  return { nodes, routes };
}

function changes(was: Standing, now: Standing): { moves: NodeMove[]; routes: EdgeRoute[] } {
  const moves: NodeMove[] = [];
  for (const [id, at] of now.nodes) {
    const before = was.nodes.get(id);
    if (before !== undefined && (before.x !== at.x || before.y !== at.y)) moves.push({ id, ...at });
  }
  const routes: EdgeRoute[] = [];
  for (const [id, waypoints] of now.routes) {
    if (!was.routes.has(id)) continue;
    const before = was.routes.get(id) ?? NONE;
    const after = waypoints ?? NONE;
    if (before !== after && !samePoints(before, after)) routes.push({ id, waypoints: after });
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
