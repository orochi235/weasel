import { describe, expect, it, vi } from 'vitest';
import {
  IDENTITY_POSE_COMPOSITION, createScene, type DerivedDep, type PoseComposition, type PoseDescriptor, type RectPose,
} from '@weasel-js/core';
import { edgeRouter } from './edge';
import { buildGraph } from './graph';
import { layered } from './layered';
import { layoutDiagram } from './layoutAction';
import type { LayoutFrame } from './layoutFrame';
import { sceneParticipants } from './portLayer';
import { portsOf } from './ports';

/** A solid: a center and a size along x, y and z, with y up. */
interface Pose3 { p: readonly [number, number, number]; s: readonly [number, number, number] }

/** A host's descriptor: the box a solid covers on a screen looking down -z, which is not the diagram's plane. */
function screenDescriptor(): PoseDescriptor<Pose3> {
  return {
    remapBounds: vi.fn((pose: Pose3) => pose),
    getBounds: vi.fn(({ p, s }: Pose3) => ({ x: 400 + p[0] * 0.5, y: 300 - p[1] * 0.5, width: s[0] * 0.5, height: s[1] * 0.5 })),
    fromBounds: vi.fn((b, pose: Pose3) => ({ ...pose, p: [(b.x - 400) * 2, (300 - b.y) * 2, pose.p[2]] as const })),
    translate: vi.fn((pose: Pose3, dx: number, dy: number) => ({ ...pose, p: [pose.p[0] + dx * 2, pose.p[1] - dy * 2, pose.p[2]] as const })),
  };
}

/** The ground plane, x across and z down the page, with the solid's corner at its min x and z. */
const GROUND: LayoutFrame<Pose3> = {
  box: ({ p, s }) => ({ x: p[0] - s[0] / 2, y: p[2] - s[2] / 2, width: s[0], height: s[2] }),
  translate: (pose, dx, dy) => ({ ...pose, p: [pose.p[0] + dx, pose.p[1], pose.p[2] + dy] }),
  fromBox: (b, pose) => ({ p: [b.x + b.width / 2, pose.p[1], b.y + b.height / 2], s: [b.width, pose.s[1], b.height] }),
};

const SOLIDS: Readonly<Record<string, Pose3>> = {
  a: { p: [500, 7, 300], s: [100, 30, 40] },
  b: { p: [0, -12, 0], s: [80, 30, 60] },
  c: { p: [900, 40, 100], s: [100, 30, 40] },
};
const EDGES = [['a', 'b'], ['b', 'c']] as const;

function solidScene() {
  const scene = createScene<{ diagram?: unknown }, 'main', Pose3>({
    systemLayers: [{ id: 'main' }], composition: IDENTITY_POSE_COMPOSITION as PoseComposition<Pose3>,
  });
  for (const [id, pose] of Object.entries(SOLIDS)) {
    scene.add({ id: id as never, kind: 'mark', layer: 'main', pose, data: { diagram: {} } });
  }
  for (const [from, to] of EDGES) {
    scene.add({
      kind: 'mark', layer: 'main', pose: { p: [0, 0, 0], s: [0, 0, 0] },
      data: { diagram: { from: {}, to: {} } }, dependsOn: [from, to] as never,
    });
  }
  return scene;
}

/** The same diagram drawn on a 2D canvas, each node at its box on the ground. */
function flatScene() {
  const scene = createScene<{ diagram?: unknown }, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  for (const [id, pose] of Object.entries(SOLIDS)) {
    scene.add({ id: id as never, kind: 'mark', layer: 'main', pose: GROUND.box(pose), data: { diagram: {} } });
  }
  for (const [from, to] of EDGES) {
    scene.add({
      kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 0, height: 0 },
      data: { diagram: { from: {}, to: {} } }, dependsOn: [from, to] as never,
    });
  }
  return scene;
}

describe('a diagram on a frame of its own', () => {
  it('lays out on the frame\'s plane, never through the descriptor', () => {
    const screen = screenDescriptor();
    const scene = solidScene();
    expect(layoutDiagram(scene, sceneParticipants(scene), 'layered', { poseDescriptor: screen, frame: GROUND })).toBe(3);

    const flat = flatScene();
    layoutDiagram(flat, sceneParticipants(flat), 'layered');
    for (const id of Object.keys(SOLIDS)) {
      const pose = scene.get(id as never)!.pose;
      expect(GROUND.box(pose)).toEqual(flat.get(id as never)!.pose);
      // Off the plane, nothing moved.
      expect(pose.p[1]).toBe(SOLIDS[id]!.p[1]);
      expect(pose.s).toEqual(SOLIDS[id]!.s);
    }
    expect(screen.getBounds).not.toHaveBeenCalled();
    expect(screen.translate).not.toHaveBeenCalled();
  });

  it('builds its graph from the frame\'s boxes', () => {
    const screen = screenDescriptor();
    const scene = solidScene();
    const graph = buildGraph(sceneParticipants(scene), { poseDescriptor: screen, frame: GROUND });
    const flat = buildGraph(sceneParticipants(flatScene()));
    expect(graph.nodes.map((n) => n.bounds)).toEqual(flat.nodes.map((n) => n.bounds));
    expect(layered(graph)).toEqual(layered(flat));
  });

  it('places ports and routes edges on the plane', () => {
    const screen = screenDescriptor();
    const opts = { poseDescriptor: screen, frame: GROUND };
    const node = (id: string) => ({ id, kind: 'mark' as const, data: { diagram: {} } });
    const a = SOLIDS['a']!;
    expect(portsOf(node('a'), a, opts)).toEqual(portsOf(node('a'), GROUND.box(a)));

    const edge = { data: { diagram: { from: {}, to: {}, router: 'bezier' } } };
    const dep = <P>(id: string, pose: P) => ({ node: node(id), pose }) as unknown as DerivedDep<P>;
    const solid = edgeRouter<Pose3>(opts)(edge, [dep('a', a), dep('a', a)]);
    const plain = edgeRouter<RectPose>()(edge, [dep('a', GROUND.box(a)), dep('a', GROUND.box(a))]);
    // A self-loop, so the standoff is read off the frame's box too.
    expect(solid).not.toBeNull();
    expect(solid).toEqual(plain);

    const c = SOLIDS['c']!;
    expect(edgeRouter<Pose3>(opts)(edge, [dep('a', a), dep('c', c)]))
      .toEqual(edgeRouter<RectPose>()(edge, [dep('a', GROUND.box(a)), dep('c', GROUND.box(c))]));
    expect(screen.getBounds).not.toHaveBeenCalled();
  });

  it('defaults to the descriptor\'s own space', () => {
    const screen = screenDescriptor();
    const a = SOLIDS['a']!;
    const node = { id: 'a', kind: 'mark' as const, data: { diagram: {} } };
    expect(portsOf(node, a, { poseDescriptor: screen })).toEqual(portsOf(node, screen.getBounds(a)));
  });
});
