import { describe, expect, it } from 'vitest';
import { createScene, type NodeId } from '@weasel-js/core';
import { intersectRayAabb, normalize, quatFromAxisAngle, type Aabb } from '@weasel-js/geom/3d';
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
    initial.push({ kind: 'leaf' as const, layer: 'solids' as const, pose: randomPose(r), data });
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
      else scene.add({ kind: 'leaf', layer: 'solids', pose: randomPose(r), data: {} });
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
        { kind: 'leaf', layer: 'solids', pose: box, data: {} },
        { kind: 'leaf', layer: 'solids', pose: box, data: {} },
        { kind: 'leaf', layer: 'solids', pose: box, data: {} },
      ],
    });
    const vp: Viewport3d = { camera: createCamera({ distance: 10 }), width: WIDTH, height: HEIGHT };
    const world: World3d<TestData, TestLayer> = { scene, viewport: () => vp, bounds: boundsOfTestNode };
    const [first, second] = [...scene.renderOrder()];
    const center = { x: WIDTH / 2, y: HEIGHT / 2 };
    expect(createNodeAtPoint(world)(center)).toBe(first);
    expect(createNodeAtPoint(world)(center, [first!])).toBe(second);
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
