/**
 * The regions half of `DiagramView`'s sync: where each container, pool, and
 * lane stands, and the region edits a change to that is reported as.
 */
import type { RectPose, Scene } from '@weasel-js/core';
import { lanesOf, poolAxisOf } from './containers/containerStencils';
import { diagramContainerOf } from './containers/trait';

type Box = { x: number; y: number; width: number; height: number };

/**
 * A region edit, which `DiagramView` reports and does not keep: `box`, a
 * container or pool moved or resized (`parent` present when a drop changed
 * the region it is in, `null` for the top level); `lanes`, a pool's lanes
 * resized, reordered, or added to, every lane in stacking order with its size
 * (a new lane's id is minted by the view); `release`, Release members run on
 * a region; `title`, a double-click on a region's header.
 */
export type ContainerEdit =
  | { kind: 'box'; id: string; box: Box; parent?: string | null }
  | { kind: 'lanes'; pool: string; lanes: readonly { id: string; size: number }[] }
  | { kind: 'release'; id: string }
  | { kind: 'title'; id: string };

interface RegionAt { box: Box; parent: string | null; fitted: boolean }

/** Where every region stands, and each pool's lanes in order. */
export interface RegionStanding {
  regions: Map<string, RegionAt>;
  pools: Map<string, { id: string; size: number }[]>;
}

type AnyScene = Scene<unknown, string, unknown>;

/** Each lane of `poolId` with its size along the stack, in order. */
export function laneList(scene: AnyScene, poolId: string): { id: string; size: number }[] {
  const pool = scene.get(poolId as never);
  const trait = pool === undefined ? null : diagramContainerOf(pool);
  if (trait === null) return [];
  const axis = poolAxisOf(trait);
  return lanesOf(scene, poolId).map((id) => {
    const p = scene.get(id)!.pose as RectPose;
    return { id: id as string, size: axis === 'y' ? p.height : p.width };
  });
}

/** Where each region in `scene` stands. */
export function readRegions(scene: AnyScene): RegionStanding {
  const regions = new Map<string, RegionAt>();
  const pools = new Map<string, { id: string; size: number }[]>();
  for (const n of scene.renderOrderNodes()) {
    const trait = diagramContainerOf(n);
    if (trait === null) continue;
    const { x, y, width, height } = n.pose as RectPose;
    regions.set(n.id, { box: { x, y, width, height }, parent: n.parent, fitted: trait.fitted === true });
    if (trait.role === 'pool') pools.set(n.id, laneList(scene, n.id));
  }
  return { regions, pools };
}

const sameBox = (a: Box, b: Box) => a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
const sameLanes = (a: readonly { id: string; size: number }[], b: readonly { id: string; size: number }[]) =>
  a.length === b.length && a.every((l, i) => l.id === b[i]!.id && l.size === b[i]!.size);

/**
 * The region edits between two standings. A lane's box is reported only as
 * its pool's lanes, and a fitted container carried along by a region around
 * it not at all: its box is fitted to its members, which report their own moves.
 */
export function regionChanges(was: RegionStanding, now: RegionStanding): ContainerEdit[] {
  const out: ContainerEdit[] = [];
  const changed = new Set<string>();
  for (const [id, at] of now.regions) {
    const before = was.regions.get(id);
    if (before !== undefined && (!sameBox(before.box, at.box) || before.parent !== at.parent)) changed.add(id);
  }
  const carried = (id: string): boolean => {
    for (let p = now.regions.get(id)?.parent ?? null; p !== null; p = now.regions.get(p)?.parent ?? null) {
      if (changed.has(p)) return true;
    }
    return false;
  };
  for (const id of changed) {
    const at = now.regions.get(id)!;
    const before = was.regions.get(id)!;
    if (now.pools.has(at.parent ?? '')) continue;
    if (at.fitted && before.parent === at.parent && carried(id)) continue;
    out.push({ kind: 'box', id, box: at.box, ...(before.parent !== at.parent ? { parent: at.parent } : {}) });
  }
  for (const [pool, lanes] of now.pools) {
    const before = was.pools.get(pool);
    if (before !== undefined && !sameLanes(before, lanes)) out.push({ kind: 'lanes', pool, lanes });
  }
  return out;
}
