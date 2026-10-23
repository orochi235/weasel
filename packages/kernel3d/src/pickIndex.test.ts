import { describe, expect, it } from 'vitest';
import { createScene, type NodeId } from '@weasel-js/core';
import { intersectRayAabb, normalize, quatFromAxisAngle, type Aabb, type Ray } from '@weasel-js/geom/3d';
import { createCamera } from './camera';
import { createAreaSelect, createNodeAtPoint, screenBoxOf } from './deps';
import { worldPickIndex } from './pickIndex';
import { pose3, type Pose3 } from './pose3';
import { rayAt, type Viewport3d } from './project';
import type { ScreenBox } from './screen';
import { boundsOfTestNode, type TestData, type TestLayer, type TestNode, type TestScene } from './testScene';
import type { World3d } from './world';

const WIDTH = 800;
const HEIGHT = 600;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rand = () => number;
const between = (r: Rand, lo: number, hi: number) => lo + (hi - lo) * r();

/** Some nodes carry a box the BVH must refuse: NaN, infinite or inverted. */
interface FuzzData extends TestData {
  odd?: 'nan' | 'inf' | 'inverted';
}

function fuzzBounds(node: TestNode): Aabb {
  const box = boundsOfTestNode(node);
  const odd = (node.data as FuzzData).odd;
  if (odd === 'nan') return { min: { ...box.min, x: NaN }, max: box.max };
  if (odd === 'inf') return { min: { ...box.min, y: -Infinity }, max: { ...box.max, y: Infinity } };
  if (odd === 'inverted') return { min: box.max, max: box.min };
  return box;
}

function randomPose(r: Rand): Pose3 {
  const axis = normalize({ x: between(r, -1, 1), y: between(r, -1, 1), z: between(r, -1, 1) });
  const s = () => between(r, 0.2, 3);
  return pose3(
    { x: between(r, -20, 20), y: between(r, -20, 20), z: between(r, -20, 20) },
    { x: s(), y: s(), z: s() },
    r() < 0.5 ? quatFromAxisAngle(axis, between(r, 0, Math.PI)) : undefined,
  );
}

function randomScene(r: Rand, n: number): TestScene {
  const initial = [];
  for (let i = 0; i < n; i++) {
    const roll = r();
    const data: FuzzData = { round: r() < 0.3 };
    if (roll < 0.01) data.odd = 'nan';
    else if (roll < 0.02) data.odd = 'inf';
    else if (roll < 0.03) data.odd = 'inverted';
    initial.push({ kind: 'mark' as const, layer: 'solids' as const, pose: randomPose(r), data });
  }
  return createScene<TestData, TestLayer, Pose3>({ systemLayers: [{ id: 'solids' }], initial });
}

/** Cameras far outside the cloud, and inside it, where boxes straddle and sit behind the eye. */
function randomViewport(r: Rand): Viewport3d {
  return {
    camera: createCamera({
      target: { x: between(r, -10, 10), y: between(r, -10, 10), z: between(r, -10, 10) },
      yaw: between(r, -Math.PI, Math.PI),
      pitch: between(r, -1.4, 1.4),
      distance: r() < 0.5 ? between(r, 1, 15) : between(r, 30, 80),
      fov: between(r, 0.3, 1.6),
    }),
    width: WIDTH,
    height: HEIGHT,
    originX: r() < 0.3 ? 40 : 0,
    originY: r() < 0.3 ? 25 : 0,
  };
}

const randomPoint = (r: Rand) => ({ x: between(r, -100, WIDTH + 100), y: between(r, -100, HEIGHT + 100) });

function randomRect(r: Rand): ScreenBox {
  const x = between(r, -200, WIDTH);
  const y = between(r, -200, HEIGHT);
  const zero = r() < 0.05;
  return { x, y, width: zero ? 0 : between(r, 1, 400), height: zero ? 0 : between(r, 1, 300) };
}

// The scans the index replaced, kept as the reference it must agree with.
function scanNearest(world: World3d<TestData, TestLayer>, point: { x: number; y: number }, exclude?: readonly NodeId[]) {
  const excluded = exclude ? new Set(exclude) : null;
  const ray = rayAt(world.viewport(), point);
  if (!ray) return null;
  let best: NodeId | null = null;
  let bestT = Infinity;
  for (const node of world.scene.renderOrderNodes()) {
    if (excluded?.has(node.id)) continue;
    const { min, max } = world.bounds!(node);
    const t = intersectRayAabb(ray, min, max);
    if (t !== null && t < bestT) {
      bestT = t;
      best = node.id;
    }
  }
  return best;
}

function scanArea(world: World3d<TestData, TestLayer>, b: ScreenBox): NodeId[] {
  const vp = world.viewport();
  const hits: NodeId[] = [];
  for (const node of world.scene.renderOrderNodes()) {
    const a = screenBoxOf(world, node.id, vp);
    if (a && a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y) {
      hits.push(node.id);
    }
  }
  return hits;
}

/** A world whose nodes are the given boxes, in render order. */
function boxWorld(boxes: readonly Aabb[]): { world: World3d<TestData, TestLayer>; ids: NodeId[] } {
  const scene = createScene<TestData, TestLayer, Pose3>({
    systemLayers: [{ id: 'solids' }],
    initial: boxes.map(() => ({ kind: 'mark' as const, layer: 'solids' as const, pose: pose3({ x: 0, y: 0, z: 0 }), data: {} })),
  });
  const ids = [...scene.renderOrder()];
  const byId = new Map(ids.map((id, i) => [id, boxes[i]!]));
  const vp: Viewport3d = { camera: createCamera({ distance: 10 }), width: WIDTH, height: HEIGHT };
  return { world: { scene, viewport: () => vp, bounds: (node) => byId.get(node.id)! }, ids };
}

/** The ray scan: nearest box entered, a tie going to the first in render order. */
function scanRay(world: World3d<TestData, TestLayer>, ray: Ray, excluded: ReadonlySet<NodeId> | null = null) {
  let best: NodeId | null = null;
  let bestT = Infinity;
  for (const node of world.scene.renderOrderNodes()) {
    if (excluded?.has(node.id)) continue;
    const { min, max } = world.bounds!(node);
    const t = intersectRayAabb(ray, min, max);
    if (t !== null && t < bestT) {
      bestT = t;
      best = node.id;
    }
  }
  return best;
}

const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): Aabb =>
  ({ min: { x: x0, y: y0, z: z0 }, max: { x: x1, y: y1, z: z1 } });

/** Boxes well clear of every ray these tests cast, to fill the tree out. */
const filler = (n: number) => Array.from({ length: n }, (_, i) => box(100 + i * 3, 100, 100, 101 + i * 3, 101, 101));

const noSelection = { get: () => [], set: () => {} };

describe('worldPickIndex', () => {
  it('answers what the full scan answers, for rays and marquees', () => {
    const r = mulberry32(0x5eed);
    for (let s = 0; s < 4; s++) {
      const scene = randomScene(r, 500);
      let vp = randomViewport(r);
      const world: World3d<TestData, TestLayer> = { scene, viewport: () => vp, bounds: fuzzBounds };
      const atPoint = createNodeAtPoint(world);
      const area = createAreaSelect(world, noSelection);
      const ids = [...scene.renderOrder()];
      let hits = 0;
      for (let q = 0; q < 200; q++) {
        if (q % 50 === 0) vp = randomViewport(r);
        const point = randomPoint(r);
        const exclude = r() < 0.3 ? ids.filter(() => r() < 0.2) : undefined;
        const expected = scanNearest(world, point, exclude);
        if (expected !== null) hits++;
        expect(atPoint(point, exclude)).toBe(expected);
        const rect = randomRect(r);
        expect(area.hitTestArea(rect)).toEqual(scanArea(world, rect));
      }
      expect(hits).toBeGreaterThan(20);
    }
  });

  it('stays in step with pose edits, adds and removals', () => {
    const r = mulberry32(7);
    const scene = randomScene(r, 200);
    const vp = randomViewport(r);
    const world: World3d<TestData, TestLayer> = { scene, viewport: () => vp, bounds: fuzzBounds };
    const atPoint = createNodeAtPoint(world);
    const area = createAreaSelect(world, noSelection);
    for (let round = 0; round < 20; round++) {
      const ids = [...scene.renderOrder()];
      const id = ids[Math.floor(r() * ids.length)]!;
      if (round % 3 === 0) scene.setPose(id, randomPose(r));
      else if (round % 3 === 1) scene.remove(id);
      else scene.add({ kind: 'mark', layer: 'solids', pose: randomPose(r), data: {} });
      for (let q = 0; q < 20; q++) {
        const point = randomPoint(r);
        expect(atPoint(point)).toBe(scanNearest(world, point));
        const rect = randomRect(r);
        expect(area.hitTestArea(rect)).toEqual(scanArea(world, rect));
      }
    }
  });

  it('gives a tie on t to the first node in render order', () => {
    const box = pose3({ x: 0, y: 0, z: 0 });
    const scene = createScene<TestData, TestLayer, Pose3>({
      systemLayers: [{ id: 'solids' }],
      initial: [
        { kind: 'mark', layer: 'solids', pose: box, data: {} },
        { kind: 'mark', layer: 'solids', pose: box, data: {} },
        { kind: 'mark', layer: 'solids', pose: box, data: {} },
      ],
    });
    const vp: Viewport3d = { camera: createCamera({ distance: 10 }), width: WIDTH, height: HEIGHT };
    const world: World3d<TestData, TestLayer> = { scene, viewport: () => vp, bounds: boundsOfTestNode };
    const [first, second] = [...scene.renderOrder()];
    const center = { x: WIDTH / 2, y: HEIGHT / 2 };
    expect(createNodeAtPoint(world)(center)).toBe(first);
    expect(createNodeAtPoint(world)(center, [first!])).toBe(second);
  });

  it('takes a ray through a box edge, as the scan does', () => {
    const origin = { x: 9.125, y: 7.375, z: -5 };
    const ray: Ray = { origin, direction: { x: 0.7 - origin.x, y: 0.3 - origin.y, z: 1.3 - origin.z } };
    const { world, ids } = boxWorld([...filler(20), box(0, 0, 0, 0.7, 0.6, 1.3)]);
    expect(scanRay(world, ray)).toBe(ids[20]);
    expect(worldPickIndex(world).nearestOnRay(ray, null)).toBe(ids[20]);
  });

  it('takes a ray with a denormal direction component, as the scan does', () => {
    const ray: Ray = { origin: { x: -1e-310, y: -10, z: 0 }, direction: { x: 5e-324, y: 1, z: 0 } };
    const { world, ids } = boxWorld([...filler(20), box(0, 0, -1, 1, 3e13, 1)]);
    expect(scanRay(world, ray)).toBe(ids[20]);
    expect(worldPickIndex(world).nearestOnRay(ray, null)).toBe(ids[20]);
  });

  it('gives a tie spread across leaves to the first node in render order', () => {
    // 120 coincident boxes fill many leaves; the filler sits between them in render order.
    const tied = box(-1, -1, -1, 1, 1, 1);
    const boxes = [...filler(40), ...Array.from({ length: 120 }, () => tied), ...filler(40)];
    // A box of its own that the ray enters at the same t, last in render order.
    boxes.push(box(-0.5, -0.5, -1, 0.5, 0.5, 5));
    const { world, ids } = boxWorld(boxes);
    const ray: Ray = { origin: { x: 0, y: 0, z: -10 }, direction: { x: 0, y: 0, z: 1 } };
    const index = worldPickIndex(world);
    expect(index.nearestOnRay(ray, null)).toBe(ids[40]);
    const excluded = new Set(ids.slice(40, 150));
    expect(index.nearestOnRay(ray, excluded)).toBe(ids[150]);
    expect(index.nearestOnRay(ray, new Set(ids.slice(40, 160)))).toBe(ids[200]);
    for (const ex of [null, excluded]) expect(index.nearestOnRay(ray, ex)).toBe(scanRay(world, ray, ex));
  });

  it('gives a tie at t = 0, with the eye inside two boxes, to the first in render order', () => {
    const outer = box(-5, -5, -5, 5, 5, 5);
    const inner = box(-1, -1, -1, 1, 1, 1);
    const ray: Ray = { origin: { x: 0, y: 0, z: 0 }, direction: { x: 0.3, y: -0.2, z: 1 } };
    for (const [a, b] of [[outer, inner], [inner, outer]] as const) {
      const { world, ids } = boxWorld([...filler(60), a, ...filler(60), b]);
      const index = worldPickIndex(world);
      expect(index.nearestOnRay(ray, null)).toBe(ids[60]);
      expect(index.nearestOnRay(ray, new Set([ids[60]!]))).toBe(ids[121]);
      expect(index.nearestOnRay(ray, null)).toBe(scanRay(world, ray));
    }
  });

  it('agrees with the scan for marquees a million units from the origin', () => {
    const r = mulberry32(0xfa2);
    const far = 1e6;
    const scene = randomScene(r, 300);
    for (const node of scene.renderOrderNodes()) {
      const { position: p, scale, rotation } = node.pose;
      scene.setPose(node.id, pose3({ x: p.x + far, y: p.y - far, z: p.z + far }, scale, rotation));
    }
    let vp = randomViewport(r);
    const world: World3d<TestData, TestLayer> = { scene, viewport: () => vp, bounds: fuzzBounds };
    const area = createAreaSelect(world, noSelection);
    let hits = 0;
    for (let q = 0; q < 200; q++) {
      if (q % 20 === 0) {
        const base = randomViewport(r);
        const t = base.camera.target;
        vp = { ...base, camera: { ...base.camera, target: { x: t.x + far, y: t.y - far, z: t.z + far } } };
      }
      // Half the rects start a hair inside a node's screen box, where a plane set too tight shows.
      const ids = [...scene.renderOrder()];
      const edge = q % 2 === 1 ? screenBoxOf(world, ids[Math.floor(r() * ids.length)]!, vp) : null;
      const rect = edge
        ? { x: edge.x + edge.width - 1e-13 * (1 + Math.abs(edge.x + edge.width)), y: edge.y, width: 50, height: 50 }
        : randomRect(r);
      const want = scanArea(world, rect);
      hits += want.length;
      expect(area.hitTestArea(rect)).toEqual(want);
    }
    expect(hits).toBeGreaterThan(200);
  });

  it('reads each node box once until the scene changes', () => {
    const r = mulberry32(11);
    const scene = randomScene(r, 100);
    const vp = randomViewport(r);
    let reads = 0;
    const world: World3d<TestData, TestLayer> = {
      scene,
      viewport: () => vp,
      bounds: (node) => {
        reads++;
        return boundsOfTestNode(node);
      },
    };
    const index = worldPickIndex(world);
    const ray = rayAt(vp, { x: WIDTH / 2, y: HEIGHT / 2 })!;
    index.nearestOnRay(ray, null);
    const afterBuild = reads;
    expect(afterBuild).toBe(100);
    worldPickIndex(world).nearestOnRay(ray, null);
    createNodeAtPoint(world)({ x: 10, y: 20 });
    expect(reads).toBe(afterBuild);
    expect(worldPickIndex(world)).toBe(index);
    const [id] = [...scene.renderOrder()];
    scene.setPose(id!, randomPose(r));
    expect(worldPickIndex(world)).not.toBe(index);
  });

  it('rebuilds when the world takes a new bounds function', () => {
    const scene = randomScene(mulberry32(3), 10);
    const vp = randomViewport(mulberry32(4));
    const world: World3d<TestData, TestLayer> = { scene, viewport: () => vp, bounds: boundsOfTestNode };
    const index = worldPickIndex(world);
    world.bounds = (node) => boundsOfTestNode(node);
    expect(worldPickIndex(world)).not.toBe(index);
  });
});
