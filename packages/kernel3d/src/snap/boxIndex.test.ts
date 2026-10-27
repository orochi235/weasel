/**
 * The box and alignment-plane sources narrowed by the box index offer exactly
 * what they offer reading every box: the same candidates, in the same order,
 * with the same marks, over randomized worlds.
 */
import { describe, expect, it } from 'vitest';
import { IDENTITY_POSE_COMPOSITION, createScene, type NodeId, type SnapCollect, type SnapSource } from '@weasel-js/core';
import type { Aabb, Vec3 } from '@weasel-js/geom/3d';
import { createCamera } from '../camera';
import { aabbOfPose, pose3, type Pose3 } from '../pose3';
import type { Node3d, World3d } from '../world';
import { snapBoxIndexBuildCount } from './boxIndex';
import { alignPlaneSource, boxSnapSource } from './sources';

type Data = { odd?: 'nan' | 'inverted' | 'flat' };

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Boxes on a coarse grid, so many share a side or center plane, plus a few the tree refuses. */
function boundsOf(node: Node3d<Data, 'solids'>): Aabb {
  const box = aabbOfPose(node.pose);
  if (node.data.odd === 'nan') return { min: { ...box.min, x: NaN }, max: box.max };
  if (node.data.odd === 'inverted') return { min: box.max, max: box.min };
  if (node.data.odd === 'flat') return { min: box.min, max: { ...box.max, y: box.min.y } };
  return box;
}

function world(seed: number): World3d<Data, 'solids'> {
  const r = rng(seed);
  const grid = () => Math.round(r() * 40 - 20) / 2;
  const initial = Array.from({ length: 300 }, (_, i) => ({
    kind: 'mark' as const,
    layer: 'solids' as const,
    pose: pose3({ x: grid(), y: grid(), z: grid() }, { x: 0.5 + Math.round(r() * 4) / 2, y: 1, z: 0.5 + r() }),
    data: (i % 61 === 7 ? { odd: 'nan' } : i % 67 === 9 ? { odd: 'inverted' } : i % 13 === 4 ? { odd: 'flat' } : {}) as Data,
  }));
  const scene = createScene<Data, 'solids', Pose3>({ composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'solids' }], initial });
  return { scene, viewport: () => ({ camera: createCamera({}), width: 800, height: 600 }), bounds: boundsOf };
}

/** The same world over a scene whose version never repeats, so every collect reads every box. */
function unindexed(w: World3d<Data, 'solids'>): World3d<Data, 'solids'> {
  let v = 0;
  return { ...w, scene: Object.assign(Object.create(w.scene), { getVersion: () => --v }) };
}

const DELTA: Vec3 = { x: 0.03, y: -0.02, z: 0.01 };

/** A source's candidates with each mark drawn at one delta, so the two runs compare as data. */
function offered(src: SnapSource<Vec3>, q: SnapCollect<Vec3>): unknown[] {
  return [...src.collect(q)].map((c) => ({ ...c, mark: typeof c.mark === 'function' ? c.mark(DELTA) : c.mark }));
}

function queries(seed: number, ids: readonly NodeId[]): SnapCollect<Vec3>[] {
  const r = rng(seed);
  const out: SnapCollect<Vec3>[] = [];
  for (let i = 0; i < 60; i++) {
    const probes = Array.from({ length: 1 + (i % 3) }, (_, k) => ({
      id: `p${k}`,
      at: { x: r() * 24 - 12, y: r() * 24 - 12, z: r() * 24 - 12 },
      role: (k % 2 ? 'box' : 'pointer') as 'box' | 'pointer',
    }));
    const reach = i % 10 === 9 ? Infinity : r() * 1.5;
    out.push({
      gesture: 'move', probes, delta0: { x: 0, y: 0, z: 0 },
      exclude: i % 4 === 0 ? [ids[Math.floor(r() * ids.length)]!, ids[0]!] : [],
      reachWorld: () => reach, reachPx: 8,
    });
  }
  return out;
}

describe('snap sources through the box index', () => {
  for (const seed of [1, 2, 3, 4]) {
    it(`offer what reading every box offers (seed ${seed})`, () => {
      const w = world(seed);
      const linear = unindexed(w);
      const ids = w.scene.renderOrderNodes().map((n) => n.id);
      const before = snapBoxIndexBuildCount();
      let total = 0;
      for (const make of [boxSnapSource, alignPlaneSource]) {
        for (const q of queries(seed * 17, ids)) {
          const want = offered(make(linear), q);
          total += want.length;
          expect(offered(make(w), q)).toEqual(want);
        }
      }
      expect(snapBoxIndexBuildCount()).toBe(before + 1);
      expect(total).toBeGreaterThan(200);
    });
  }

  it('rebuilds after a scene change, and reads the change', () => {
    const w = world(9);
    const q = queries(5, [])[0]!;
    const at = q.probes[0]!.at;
    offered(boxSnapSource(w), q);
    offered(boxSnapSource(w), q);
    const before = snapBoxIndexBuildCount();
    const id = w.scene.renderOrderNodes()[3]!.id;
    w.scene.setPose(id, pose3(at));
    const want = offered(boxSnapSource(unindexed(w)), q);
    expect(offered(boxSnapSource(w), q)).toEqual(want);
    expect(offered(boxSnapSource(w), q)).toEqual(want);
    expect(snapBoxIndexBuildCount()).toBe(before + 1);
    expect(want.length).toBeGreaterThan(0);
  });
});
