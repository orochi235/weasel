/**
 * Stateful property test of the cached indexes over a 3D world: random adds of marks and containers, removals, pose
 * edits, reorders and reparents, gesture overrides set and cleared, and the world's `bounds` function swapped. After
 * every step the pick index answers rays and marquees as a scan of every node's shown box does, and the snap index
 * offers every document box a query reaches, in render order, leaving out what a move carries.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createScene, type NodeId } from '@weasel-js/core';
import { aabbAround, intersectRayAabb, type Aabb } from '@weasel-js/geom/3d';
import { rectsOverlap } from '@weasel-js/geom';
import { POSE3_COMPOSITION } from './composePose3';
import { paneAt, paneFractions, pose, runs, scale3, tally, timeoutFor, viewport } from './pbt.fixture';
import { worldPickIndex } from './pickIndex';
import type { Pose3 } from './pose3';
import { rayAt, rectOf, viewProjectionOf } from './project';
import { projectAabbToScreen, type ScreenBox } from './screen';
import { snapBoxes } from './snap/boxIndex';
import { boxAt, withDescendants, worldBoxes, worldPoses, type NodeBounds, type Node3d, type World3d } from './world';

const RUNS = 200;
const T = timeoutFor(RUNS, 30);

interface Data { round?: boolean; odd?: boolean }
type L = 'solids';
type W = World3d<Data, L>;

const roundBounds: NodeBounds<Data, L> = (node) => {
  if (node.kind === 'group') return null;
  const s = node.pose.scale;
  const box = aabbAround(node.pose.position, 0.5 * Math.max(Math.abs(s.x), Math.abs(s.y), Math.abs(s.z)));
  return node.data.odd ? { min: box.max, max: box.min } : box;
};

type Op =
  | { kind: 'add'; group: boolean; parent: number; pose: Pose3; data: Data }
  | { kind: 'remove'; which: number }
  | { kind: 'pose'; which: number; pose: Pose3 }
  | { kind: 'reorder'; which: number; index: number }
  | { kind: 'move'; which: number; parent: number }
  | { kind: 'override'; which: number; pose: Pose3 }
  | { kind: 'clear'; which: number }
  | { kind: 'clearAll' }
  | { kind: 'bounds'; to: 'default' | 'round' };

const which = fc.nat({ max: 40 });
const nodePose = pose(scale3, 8);
const op: fc.Arbitrary<Op> = fc.oneof(
  { weight: 5, arbitrary: fc.record({ kind: fc.constant('add' as const), group: fc.boolean(), parent: fc.integer({ min: -3, max: 40 }), pose: nodePose, data: fc.record({ round: fc.boolean(), odd: fc.boolean() }, { requiredKeys: [] }) }) },
  { weight: 2, arbitrary: fc.record({ kind: fc.constant('remove' as const), which }) },
  { weight: 3, arbitrary: fc.record({ kind: fc.constant('pose' as const), which, pose: nodePose }) },
  { weight: 2, arbitrary: fc.record({ kind: fc.constant('reorder' as const), which, index: fc.nat({ max: 10 }) }) },
  { weight: 3, arbitrary: fc.record({ kind: fc.constant('move' as const), which, parent: fc.integer({ min: -3, max: 40 }) }) },
  { weight: 3, arbitrary: fc.record({ kind: fc.constant('override' as const), which, pose: nodePose }) },
  { weight: 2, arbitrary: fc.record({ kind: fc.constant('clear' as const), which }) },
  { weight: 1, arbitrary: fc.constant({ kind: 'clearAll' as const }) },
  { weight: 1, arbitrary: fc.record({ kind: fc.constant('bounds' as const), to: fc.constantFrom('default' as const, 'round' as const) }) },
);

function apply(world: W, o: Op, seen: ReturnType<typeof tally>): void {
  const { scene } = world;
  const ids = [...scene.nodes.keys()];
  const at = (i: number): NodeId | undefined => (ids.length > 0 ? ids[i % ids.length] : undefined);
  const groups = ids.filter((id) => scene.get(id)!.kind === 'group');
  const parentOf = (i: number): NodeId | undefined => (i < 0 || groups.length === 0 ? undefined : groups[i % groups.length]);
  switch (o.kind) {
    case 'add': {
      const parent = parentOf(o.parent);
      scene.add({ kind: o.group ? 'group' : 'mark', layer: 'solids', pose: o.pose, data: o.data, ...(parent ? { parent } : {}) });
      seen.count(parent ? 'add nested' : 'add');
      return;
    }
    case 'bounds':
      if (o.to === 'default') delete world.bounds;
      else world.bounds = roundBounds;
      seen.count('bounds');
      return;
    case 'clearAll':
      scene.overrides.clearAll();
      return;
  }
  const id = at(o.which);
  if (id === undefined) return;
  switch (o.kind) {
    case 'remove': scene.remove(id); break;
    case 'pose': scene.setPose(id, o.pose); break;
    case 'reorder': {
      const siblings = scene.get(id)!.parent ? scene.childrenOf(scene.get(id)!.parent!) : scene.roots;
      scene.reorder(id, o.index % Math.max(1, siblings.length));
      break;
    }
    case 'move': {
      const parent = parentOf(o.parent) ?? null;
      if (parent !== null && (parent === id || scene.ancestorsOf(parent).includes(id))) return;
      scene.move(id, parent);
      break;
    }
    case 'override': scene.overrides.set(id, { pose: o.pose }); break;
    case 'clear': scene.overrides.clear(id); break;
  }
  seen.count(o.kind);
}

/** What a scan of every node's box as shown answers. */
function scanRay(world: W, point: { x: number; y: number }): NodeId | null {
  const ray = rayAt(world.viewport(), point);
  if (!ray) return null;
  const poseOf = worldPoses(world.scene, 'shown');
  let best: NodeId | null = null;
  let bestT = Infinity;
  for (const node of world.scene.renderOrderNodes() as readonly Node3d<Data, L>[]) {
    const box = boxAt(world, node, poseOf(node.id));
    const t = box && intersectRayAabb(ray, box.min, box.max);
    if (t !== null && t !== undefined && t < bestT) {
      bestT = t;
      best = node.id;
    }
  }
  return best;
}

function scanRect(world: W, rect: ScreenBox): NodeId[] {
  const vp = world.viewport();
  const poseOf = worldPoses(world.scene, 'shown');
  const out: NodeId[] = [];
  for (const node of world.scene.renderOrderNodes() as readonly Node3d<Data, L>[]) {
    const box = boxAt(world, node, poseOf(node.id));
    const s = box && projectAabbToScreen(box, viewProjectionOf(vp), rectOf(vp));
    if (s && rectsOverlap(s, rect)) out.push(node.id);
  }
  return out;
}

const meets = (a: Aabb, q: readonly number[]): boolean =>
  a.min.x <= q[3]! && a.max.x >= q[0]! && a.min.y <= q[4]! && a.max.y >= q[1]! && a.min.z <= q[5]! && a.max.z >= q[2]!;

const query = fc.record({
  points: fc.array(paneFractions(), { minLength: 1, maxLength: 4 }),
  rect: fc.record({ fx: fc.double({ min: -0.2, max: 1, noNaN: true }), fy: fc.double({ min: -0.2, max: 1, noNaN: true }), w: fc.double({ min: 0, max: 0.8, noNaN: true }), h: fc.double({ min: 0, max: 0.8, noNaN: true }) }),
  near: fc.array(fc.tuple(fc.double({ min: -15, max: 15, noNaN: true }), fc.double({ min: -15, max: 15, noNaN: true }), fc.double({ min: -15, max: 15, noNaN: true }), fc.double({ min: 0, max: 6, noNaN: true })), { maxLength: 3 }),
  exclude: fc.nat({ max: 40 }),
});

describe('the pick and snap indexes through scene edits, stateful', () => {
  it('answer what a scan answers after every step', () => {
    const seen = tally();
    fc.assert(fc.property(viewport, fc.array(fc.tuple(op, query), { minLength: 1, maxLength: 40 }), (vp, steps) => {
      const scene = createScene<Data, L, Pose3>({ composition: POSE3_COMPOSITION, systemLayers: [{ id: 'solids' }] });
      const world: W = { scene, viewport: () => vp };
      for (const [o, q] of steps) {
        apply(world, o, seen);
        const index = worldPickIndex(world);
        for (const f of q.points) {
          const s = paneAt(vp, f);
          const ray = rayAt(vp, s)!;
          const want = scanRay(world, s);
          if (want !== null) seen.count('ray hit');
          expect(index.nearestOnRay(ray, null)).toBe(want);
        }
        const rect = { x: (vp.originX ?? 0) + q.rect.fx * vp.width, y: (vp.originY ?? 0) + q.rect.fy * vp.height, width: q.rect.w * vp.width, height: q.rect.h * vp.height };
        const area = scanRect(world, rect);
        if (area.length > 0) seen.count('rect hit');
        expect(index.inScreenRect(vp, rect)).toEqual(area);

        const ids = [...scene.nodes.keys()];
        const exclude = ids.length > 0 && q.exclude % 3 === 0 ? [ids[q.exclude % ids.length]!] : [];
        const carried = withDescendants(scene, exclude);
        const near = q.near.map(([x, y, z, r]) => [x - r, y - r, z - r, x + r, y + r, z + r]);
        const boxOf = worldBoxes(world, 'document');
        const order = (scene.renderOrderNodes() as readonly Node3d<Data, L>[]).filter((n) => !carried.has(n.id));
        const all = order.map(boxOf).filter((b): b is Aabb => b !== null);
        const reached = all.filter((b) => near.some((n) => meets(b, n)));
        const got = snapBoxes(world, exclude, near);
        // Everything a query reaches, nothing that is not a box, in render order.
        let k = 0;
        for (const b of got) {
          while (k < all.length && all[k] !== b && JSON.stringify(all[k]) !== JSON.stringify(b)) k++;
          expect(k).toBeLessThan(all.length);
          k++;
        }
        for (const b of reached) expect(got.map((g) => JSON.stringify(g))).toContain(JSON.stringify(b));
        if (reached.length > 0) seen.count('snap reached');
      }
    }), runs(RUNS));
    for (const k of ['ray hit', 'rect hit', 'snap reached', 'add nested', 'remove', 'move', 'reorder', 'override', 'clear', 'bounds']) seen.atLeast(k, 10);
  }, T);
});
