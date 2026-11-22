import { describe, expect, it } from 'vitest';
import { IDENTITY_POSE_COMPOSITION, createScene, type PoseComposition } from '@weasel-js/core';
import { aabbOfPose, pose3, withAabb, type Pose3 } from '@weasel-js/kernel3d';
import type { Aabb, Vec3 } from '@weasel-js/geom/3d';
import { force } from './force';
import { force3 } from './force3';
import { buildGraph, graphOf } from './graph';
import { createSolidFrame } from './layoutFrame';
import { sceneParticipants } from './portLayer';

const FRAME = createSolidFrame<Pose3>({ box3: (p) => aabbOfPose(p), fromBox3: (box, p) => withAabb(p, box) });

/** Solids at `[x, y, z]` centers, each `[w, h, d]` across, joined by `edges`. */
function solidScene(solids: Record<string, readonly [Vec3, Vec3]>, edges: readonly (readonly [string, string])[]) {
  const scene = createScene<{ diagram?: unknown }, 'main', Pose3>({
    systemLayers: [{ id: 'main' }], composition: IDENTITY_POSE_COMPOSITION as PoseComposition<Pose3>,
  });
  for (const [id, [at, size]] of Object.entries(solids)) {
    scene.add({ id: id as never, kind: 'mark', layer: 'main', pose: pose3(at, size), data: { diagram: {} } });
  }
  for (const [from, to] of edges) {
    scene.add({
      kind: 'mark', layer: 'main', pose: pose3({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }),
      data: { diagram: { from: {}, to: {} } }, dependsOn: [from, to] as never,
    });
  }
  return scene;
}

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
const IDS = ['a', 'b', 'c', 'd', 'e', 'f'];
const EDGES = [['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'a'], ['b', 'e'], ['e', 'f'], ['f', 'c']] as const;
const SIZES = [v(80, 40, 60), v(60, 60, 60), v(100, 30, 50), v(40, 40, 120), v(70, 50, 40), v(90, 40, 30)];

/** The solids at the centers `at`, sized from {@link SIZES}. */
const solidsAt = (at: readonly Vec3[]) =>
  Object.fromEntries(IDS.map((id, i) => [id, [at[i]!, SIZES[i]!] as const]));

const SPREAD = [v(0, 0, 0), v(30, 10, 200), v(-40, 60, -150), v(10, -30, 90), v(80, 20, -60), v(-20, 90, 40)];

function overlap(a: Aabb, b: Aabb): boolean {
  return a.min.x < b.max.x && b.min.x < a.max.x && a.min.y < b.max.y && b.min.y < a.max.y
    && a.min.z < b.max.z && b.min.z < a.max.z;
}

describe('force3', () => {
  it('relaxes a graph of solids under kernel3d in all three dimensions', () => {
    const scene = solidScene(solidsAt(SPREAD), EDGES);
    const graph = buildGraph(sceneParticipants(scene), { frame: FRAME });
    expect(graph.nodes.every((n) => n.box3 !== undefined)).toBe(true);

    const moves = force3(graph);
    expect(moves.size).toBe(IDS.length);
    for (const [id, to] of moves) {
      const pose = scene.get(id as never)!.pose;
      const from = FRAME.box3!(pose).min;
      scene.setPose(id as never, FRAME.translate3!(pose, { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z }));
    }

    const boxes = IDS.map((id) => FRAME.box3!(scene.get(id as never)!.pose));
    IDS.forEach((id, i) => {
      // A move keeps the solid's size.
      expect(boxes[i]!.max.z - boxes[i]!.min.z).toBeCloseTo(SIZES[i]!.z, 6);
      for (const axis of ['x', 'y', 'z'] as const) expect(boxes[i]!.min[axis]).toBeCloseTo(moves.get(id)![axis], 6);
      for (let j = i + 1; j < IDS.length; j++) expect(overlap(boxes[i]!, boxes[j]!), `${id} ${IDS[j]}`).toBe(false);
    });
    // Depth is laid out, not merely carried: the run moved solids along z.
    expect(IDS.some((id, i) => Math.abs(moves.get(id)!.z - (SPREAD[i]!.z - SIZES[i]!.z / 2)) > 1)).toBe(true);
    // Edges pulled toward their rest length in space, from runs up to ~370 apart.
    const centerOf = (b: Aabb) => v((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2);
    for (const [from, to] of EDGES) {
      const p = centerOf(boxes[IDS.indexOf(from)]!);
      const q = centerOf(boxes[IDS.indexOf(to)]!);
      expect(Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z)).toBeLessThan(320);
    }
  });

  it('lands solids that all sit on z = 0 where the flat run puts their faces', () => {
    const level = SPREAD.map((p) => v(p.x * 4, p.y * 4, 0));
    const graph = buildGraph(sceneParticipants(solidScene(solidsAt(level), EDGES)), { frame: FRAME });
    const flat = force(graph);
    const deep = force3(graph);
    expect([...deep.keys()]).toEqual([...flat.keys()]);
    for (const node of graph.nodes) {
      const to = deep.get(node.id)!;
      expect({ x: to.x, y: to.y }).toEqual(flat.get(node.id));
      expect(to.z).toBe(node.box3!.min.z);
    }
  });

  it('holds a pinned solid where it is in depth too', () => {
    const graph = buildGraph(sceneParticipants(solidScene(solidsAt(SPREAD), EDGES)), { frame: FRAME });
    const moves = force3(graph, { pin: ['a'] });
    expect(moves.has('a')).toBe(false);
    expect(moves.size).toBe(IDS.length - 1);
  });

  it('runs a graph with no depth flat, at z = 0', () => {
    const solid = buildGraph(sceneParticipants(solidScene(solidsAt(SPREAD), EDGES)), { frame: FRAME });
    const graph = graphOf(solid.nodes.map(({ box3: _box3, ...node }) => node), [...solid.edges]);
    const flat = force(graph);
    for (const [id, to] of force3(graph)) expect(to).toEqual({ ...flat.get(id)!, z: 0 });
  });
});
