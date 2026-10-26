import {
  sceneBoxFrames, scenePoseFrame, sceneUnitScopes, type NodeId, type Scene, type ScopedScene, type UnitScope,
} from '@weasel-js/core';
import { applyToPoint, pointInPolygon, type Affine } from '@weasel-js/geom';

type Point = { x: number; y: number };

/** A container that declares its own unit scope, where a grid draws and
 *  hit-tests that scope's lattice instead of its parent's. */
export interface GridRegion {
  /** The container's outline in world units, as a closed polygon. */
  outline: readonly Point[];
  /** The scopes its lattice is read in, outermost first, rooted at the
   *  grid's `scopes.root`, the container's own scope last. */
  chain: readonly UnitScope[];
  /** Scoped containers inside this one. */
  regions?: readonly GridRegion[];
  /** The container's frame, its own coordinates to world (`sceneBoxFrames`):
   *  its lattice runs from the frame's origin along its axes, in its units,
   *  as `gridSnapSource` snaps. Absent, the lattice is world-aligned and runs
   *  through the grid's anchor. */
  frame?: Affine;
}

/**
 * Every container in `scene` declaring a unit scope, as `GridRegion`s nested
 * the way the containers are, each in its box frame. `outlineOf` gives a
 * node's world outline, or `null` to leave it, and every scope inside it,
 * out; by default, a box pose's outline as it is drawn, and none for any
 * other pose.
 */
export function sceneGridRegions(
  scene: Scene<unknown, string, unknown>,
  root: UnitScope,
  outlineOf?: (id: NodeId) => readonly Point[] | null,
): GridRegion[] {
  const frames = sceneBoxFrames(scene);
  const poses = scenePoseFrame(scene);
  const boxOutline = (id: NodeId): Point[] | null => {
    const frame = frames(id);
    const { width, height } = poses.world(id) as { width: number; height: number };
    return frame && [[0, 0], [width, 0], [width, height], [0, height]].map(([x, y]) => {
      const [wx, wy] = applyToPoint(frame, x!, y!);
      return { x: wx, y: wy };
    });
  };
  const children = new Map<NodeId | null, NodeId[]>();
  for (const id of scene.nodes.keys()) {
    if (scene.get(id)?.units === undefined) continue;
    const parent = scopeOwner(scene, id);
    children.set(parent, [...(children.get(parent) ?? []), id]);
  }
  const build = (parent: NodeId | null): GridRegion[] => {
    const out: GridRegion[] = [];
    for (const id of children.get(parent) ?? []) {
      const outline = outlineOf ? outlineOf(id) : boxOutline(id);
      if (!outline) continue;
      const inner = build(id);
      const frame = frames(id);
      out.push({
        outline,
        chain: sceneUnitScopes(scene, id, root, { inclusive: true }),
        ...(inner.length ? { regions: inner } : {}),
        ...(frame ? { frame } : {}),
      });
    }
    return out;
  };
  return build(null);
}

/** The nearest container above `id` declaring a unit scope, or `null` for
 *  the root's: whose lattice `id` sits on. `inclusive` counts `id` itself. */
export function scopeOwner(scene: ScopedScene, id: NodeId, inclusive = false): NodeId | null {
  for (let at = inclusive ? id : scene.get(id)?.parent ?? null; at !== null; at = scene.get(at)?.parent ?? null) {
    if (scene.get(at)?.units !== undefined) return at;
  }
  return null;
}

/** The innermost region holding `point`, or `null` outside them all. */
export function regionAt(regions: readonly GridRegion[] | undefined, point: Point): GridRegion | null {
  for (const r of regions ?? []) {
    const flat = r.outline.flatMap((p) => [p.x, p.y]);
    if (pointInPolygon(flat, point.x, point.y)) return regionAt(r.regions, point) ?? r;
  }
  return null;
}
