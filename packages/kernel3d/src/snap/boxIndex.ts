/** The world boxes a snap source reads, as the document holds them, narrowed
 *  by a BVH to the ones a query can reach. Keyed on the scene's version and
 *  the world's `bounds`: `NodeBounds` is a function of the node alone, and a
 *  move's overrides leave the version alone, so one index serves every frame
 *  of a drag. The first query at a new key scans and records it; the second
 *  builds. A node that occupies nothing is no target. */

import type { NodeId } from '@weasel-js/core';
import type { Aabb } from '@weasel-js/geom/3d';
import { createBvh, createSettledCache, type BoxN, type Bvh, type SettledCache } from '@weasel-js/geom/nd';
import { withDescendants, worldBoxes, type Node3d, type World3d } from '../world';

interface Built {
  ids: readonly NodeId[];
  boxes: readonly (Aabb | null)[];
  tree: Bvh<number>;
  /** Boxes the tree refuses (non-finite or inverted), read by every query. */
  always: readonly number[];
}

const CACHE = new WeakMap<object, SettledCache<Built>>();

let builds = 0;

/** How many box indexes have been built, for tests that pin when one rebuilds. */
export function snapBoxIndexBuildCount(): number {
  return builds;
}

function nodesOf<TData, TLayer extends string>(world: World3d<TData, TLayer>): readonly Node3d<TData, TLayer>[] {
  return world.scene.renderOrderNodes() as readonly Node3d<TData, TLayer>[];
}

function boxValid({ min, max }: Aabb): boolean {
  return (
    Number.isFinite(min.x) && Number.isFinite(min.y) && Number.isFinite(min.z) &&
    Number.isFinite(max.x) && Number.isFinite(max.y) && Number.isFinite(max.z) &&
    min.x <= max.x && min.y <= max.y && min.z <= max.z
  );
}

function build<TData, TLayer extends string>(world: World3d<TData, TLayer>): Built {
  builds++;
  const nodes = nodesOf(world);
  const boxes = nodes.map(worldBoxes(world, 'document'));
  const entries: [number, number[]][] = [];
  const always: number[] = [];
  boxes.forEach((box, i) => {
    if (box === null) return;
    const { min, max } = box;
    if (boxValid(box)) entries.push([i, [min.x, min.y, min.z, max.x, max.y, max.z]]);
    else always.push(i);
  });
  return { ids: nodes.map((n) => n.id), boxes, tree: createBvh<number>(3, entries), always };
}

function current<TData, TLayer extends string>(world: World3d<TData, TLayer>): Built | null {
  let cache = CACHE.get(world);
  if (cache === undefined) CACHE.set(world, (cache = createSettledCache()));
  return cache.read([world.scene.getVersion(), world.bounds], () => build(world));
}

/** Grows a query box by a relative epsilon, so rounding between the tree's
 *  overlap test and a source's exact one only ever adds candidates. */
export function padQuery(box: number[]): number[] {
  let m = 0;
  for (const v of box) if (Number.isFinite(v)) m = Math.max(m, Math.abs(v));
  const e = 1e-9 * (1 + m);
  return [box[0]! - e, box[1]! - e, box[2]! - e, box[3]! + e, box[4]! + e, box[5]! + e];
}

/**
 * Each node's world box, in render order, leaving out `exclude` and
 * everything under it, which a move of `exclude` carries along. With
 * `near`, the index may drop any box that meets none of those boxes
 * (`[minX, minY, minZ, maxX, maxY, maxZ]`, already padded); a box that
 * meets one is always kept. Without an index, every box is returned.
 */
export function snapBoxes<TData, TLayer extends string>(
  world: World3d<TData, TLayer>,
  exclude: readonly string[],
  near: readonly BoxN[],
): Aabb[] {
  const excluded = withDescendants(world.scene, exclude);
  const index = near.every((b) => Array.prototype.every.call(b, (v: number) => !Number.isNaN(v))) ? current(world) : null;
  if (index === null) {
    const boxOf = worldBoxes(world, 'document');
    const out: Aabb[] = [];
    for (const node of nodesOf(world)) {
      const box = excluded.has(node.id) ? null : boxOf(node);
      if (box) out.push(box);
    }
    return out;
  }
  const found = new Set<number>(index.always);
  for (const box of near) index.tree.queryBox(box, (i) => { found.add(i); });
  const out: Aabb[] = [];
  for (const i of [...found].sort((a, b) => a - b)) {
    if (!excluded.has(index.ids[i]!)) out.push(index.boxes[i]!);
  }
  return out;
}
