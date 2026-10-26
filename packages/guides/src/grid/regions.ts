import { sceneUnitScopes, type NodeId, type ScopedScene, type UnitScope } from '@weasel-js/core';
import { pointInPolygon } from '@weasel-js/geom';

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
}

/** What `sceneGridRegions` needs of a scene. A `Scene` satisfies it. */
export interface GridRegionScene extends ScopedScene {
  readonly nodes: ReadonlyMap<NodeId, unknown>;
}

/**
 * Every container in `scene` declaring a unit scope, as `GridRegion`s nested
 * the way the containers are. `outlineOf` gives a node's world outline, or
 * `null` to leave it, and every scope inside it, out.
 */
export function sceneGridRegions(
  scene: GridRegionScene,
  root: UnitScope,
  outlineOf: (id: NodeId) => readonly Point[] | null,
): GridRegion[] {
  const scoped = (id: NodeId) => scene.get(id)?.units !== undefined;
  const enclosing = (id: NodeId): NodeId | null => {
    for (let at = scene.get(id)?.parent ?? null; at !== null; at = scene.get(at)?.parent ?? null) {
      if (scoped(at)) return at;
    }
    return null;
  };
  const children = new Map<NodeId | null, NodeId[]>();
  for (const id of scene.nodes.keys()) {
    if (!scoped(id)) continue;
    const parent = enclosing(id);
    children.set(parent, [...(children.get(parent) ?? []), id]);
  }
  const build = (parent: NodeId | null): GridRegion[] => {
    const out: GridRegion[] = [];
    for (const id of children.get(parent) ?? []) {
      const outline = outlineOf(id);
      if (!outline) continue;
      const inner = build(id);
      out.push({
        outline,
        chain: sceneUnitScopes(scene, id, root, { inclusive: true }),
        ...(inner.length ? { regions: inner } : {}),
      });
    }
    return out;
  };
  return build(null);
}

/** The innermost region holding `point`, or `null` outside them all. */
export function regionAt(regions: readonly GridRegion[] | undefined, point: Point): GridRegion | null {
  for (const r of regions ?? []) {
    const flat = r.outline.flatMap((p) => [p.x, p.y]);
    if (pointInPolygon(flat, point.x, point.y)) return regionAt(r.regions, point) ?? r;
  }
  return null;
}
