import {
  sceneBoxFrames, scenePoseFrame, sceneUnitScopes, type NodeId, type Scene, type ScopedScene, type UnitScope,
} from '@weasel-js/core';
import { applyToPoint, pointInPolygon, type Affine } from '@weasel-js/geom';
import type { GridSpacing } from './axes';

type Point = { x: number; y: number };

/** Which of a scene's containers run a grid of their own. */
export interface GridOwners {
  /** The scene's outermost unit scope: given, every container declaring a
   *  scope (`GroupNode.units`) runs that scope's lattice, and lengths inside
   *  a container are read in its scope. */
  root?: UnitScope;
  /** A container's own grid: `undefined` to leave it to the container's
   *  parent, `null` for no grid inside it at all. Its children snap on it,
   *  in the container's frame. */
  gridOf?: (id: NodeId) => GridSpacing | null | undefined;
}

/** A container running its own lattice, where a grid draws and hit-tests it
 *  instead of its parent's. */
export interface GridRegion {
  /** The container's outline in world units, as a closed polygon. */
  outline: readonly Point[];
  /** The scopes its lattice is read in, outermost first, rooted at
   *  `GridOwners.root`, the container's own scope last. Absent without one. */
  chain?: readonly UnitScope[];
  /** Its own grid, from `gridOf`: `null` for none. Absent, it runs the grid's
   *  `spacing`, or its scope's (`GridScopes.spacing`). */
  spacing?: GridSpacing | null;
  /** Containers inside this one running their own. */
  regions?: readonly GridRegion[];
  /** The container's frame, its own coordinates to world (`sceneBoxFrames`):
   *  its lattice runs from the frame's origin along its axes, in its units,
   *  as `gridSnapSource` snaps. Absent, the lattice is world-aligned and runs
   *  through the grid's anchor. */
  frame?: Affine;
}

/**
 * Every container in `scene` running its own grid, as `GridRegion`s nested
 * the way the containers are, each in its box frame. `outlineOf` gives a
 * node's world outline, or `null` to leave it, and every region inside it,
 * out; by default, a box pose's outline as it is drawn, and none for any
 * other pose.
 */
export function sceneGridRegions(
  scene: Scene<unknown, string, unknown>,
  owners: GridOwners,
  outlineOf?: (id: NodeId) => readonly Point[] | null,
): GridRegion[] {
  const frames = sceneBoxFrames(scene);
  const poses = scenePoseFrame(scene);
  const boxOutline = (id: NodeId, frame: Affine): Point[] => {
    const { width, height } = poses.world(id) as { width: number; height: number };
    return [[0, 0], [width, 0], [width, height], [0, height]].map(([x, y]) => {
      const [wx, wy] = applyToPoint(frame, x!, y!);
      return { x: wx, y: wy };
    });
  };
  const children = new Map<NodeId | null, NodeId[]>();
  for (const id of scene.nodes.keys()) {
    if (!ownsGrid(scene, id, owners)) continue;
    const parent = gridOwner(scene, id, owners);
    children.set(parent, [...(children.get(parent) ?? []), id]);
  }
  const build = (parent: NodeId | null): GridRegion[] => {
    const out: GridRegion[] = [];
    for (const id of children.get(parent) ?? []) {
      const frame = frames(id);
      const outline = outlineOf ? outlineOf(id) : frame && boxOutline(id, frame);
      if (!outline) continue;
      const inner = build(id);
      const own = owners.gridOf?.(id);
      out.push({
        outline,
        ...(owners.root ? { chain: sceneUnitScopes(scene, id, owners.root, { inclusive: true }) } : {}),
        ...(own !== undefined ? { spacing: own } : {}),
        ...(inner.length ? { regions: inner } : {}),
        ...(frame ? { frame } : {}),
      });
    }
    return out;
  };
  return build(null);
}

function ownsGrid(scene: ScopedScene, id: NodeId, owners: GridOwners): boolean {
  return owners.gridOf?.(id) !== undefined || (owners.root !== undefined && scene.get(id)?.units !== undefined);
}

/** The nearest container above `id` running its own grid, or `null` for the
 *  root's: whose lattice `id` sits on. `inclusive` counts `id` itself. */
export function gridOwner(scene: ScopedScene, id: NodeId, owners: GridOwners, inclusive = false): NodeId | null {
  for (let at = inclusive ? id : scene.get(id)?.parent ?? null; at !== null; at = scene.get(at)?.parent ?? null) {
    if (ownsGrid(scene, at, owners)) return at;
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
