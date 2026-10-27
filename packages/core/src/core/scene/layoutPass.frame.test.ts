import { describe, expect, it } from 'vitest';
import { createScene } from './scene';
import { RIGID_POSE_COMPOSITION, composeWorldPose } from './composePose';
import { scenePoseAdapter } from './scenePoseAdapter';
import { asNodeId, type RectPose } from './types';
import type { LayoutStrategy } from '../../layout/types';

/** Children stacked 10 tall down the container from its top, the container
 *  growing to hold them when one arrives. */
function stack(): LayoutStrategy<RectPose> {
  const place = (b: { x: number; y: number; width: number }, ids: readonly string[]) =>
    new Map(ids.map((id, i) => [id, { x: b.x, y: b.y + i * 10, width: b.width, height: 10 }]));
  return {
    snap: { pickTarget: () => null },
    childPoses: (container, children) => place(container.bounds, children.map((c) => c.id)),
    arrive: (container, children) => ({
      poses: place(container.bounds, children.map((c) => c.id)),
      bounds: { ...container.bounds, height: Math.max(container.bounds.height, children.length * 10) },
    }),
    getDropTargets: () => [],
    reflowPoses: () => new Map(),
    commitDrop: () => [],
  };
}

const C = asNodeId('C');
const near = (got: RectPose, want: RectPose): void => {
  for (const k of ['x', 'y', 'width', 'height'] as const) expect(got[k]).toBeCloseTo(want[k], 9);
  expect(got.rotation ?? 0).toBeCloseTo(want.rotation ?? 0, 9);
};

function setup(rotation: number, height = 200) {
  const scene = createScene<null, 'l', RectPose>({
    systemLayers: [{ id: 'l' }],
    composition: RIGID_POSE_COMPOSITION,
    initial: [{ id: C, kind: 'group', layer: 'l', pose: { x: 100, y: 100, width: 50, height, rotation }, data: null, layout: stack() }],
  });
  const add = () => scene.add({ kind: 'mark', layer: 'l', pose: { x: 0, y: 0, width: 5, height: 5 }, data: null, parent: C });
  return { scene, add };
}

describe('layout pass on a turned container', () => {
  it('lays children out along the container\'s own axes', () => {
    const { scene, add } = setup(Math.PI / 3);
    const ids = [add(), add(), add()];
    ids.forEach((id, i) => near(scene.get(id)!.pose, { x: 0, y: i * 10, width: 50, height: 10 }));
  });

  it('keeps every child inside the container', () => {
    const { scene, add } = setup(Math.PI / 2);
    const ids = [add(), add(), add()];
    const doc = scenePoseAdapter(scene);
    const c = composeWorldPose(doc, C, RIGID_POSE_COMPOSITION.compose);
    for (const id of ids) {
      const w = composeWorldPose(doc, id, RIGID_POSE_COMPOSITION.compose);
      const local = RIGID_POSE_COMPOSITION.decompose(c, w);
      expect(local.x).toBeGreaterThanOrEqual(-1e-9);
      expect(local.y).toBeGreaterThanOrEqual(-1e-9);
      expect(local.x + local.width).toBeLessThanOrEqual(c.width + 1e-9);
      expect(local.y + local.height).toBeLessThanOrEqual(c.height + 1e-9);
      expect(w.rotation).toBeCloseTo(Math.PI / 2, 9);
    }
  });

  it('grows the container along its own axes, its own top-left staying put', () => {
    const { scene, add } = setup(Math.PI / 2, 20);
    add();
    add();
    const corner = () => RIGID_POSE_COMPOSITION.compose(scene.get(C)!.pose, { x: 0, y: 0, width: 0, height: 0 });
    const before = corner();
    add();
    expect(scene.get(C)!.pose.height).toBeCloseTo(30, 9);
    expect(scene.get(C)!.pose.width).toBeCloseTo(50, 9);
    near(corner(), before);
  });

  it('hands an upright container\'s strategy world poses, unchanged', () => {
    const { scene, add } = setup(0);
    const seen: unknown[] = [];
    const layout = scene.layoutOf(C)!;
    scene.setLayout(C, { ...layout, childPoses: (container, children) => (seen.push(container.bounds), layout.childPoses(container, children)) });
    const id = add();
    scene.setPose(C, { x: 100, y: 100, width: 60, height: 200, rotation: 0 });
    expect(seen.at(-1)).toEqual({ x: 100, y: 100, width: 60, height: 200 });
    expect(scene.get(id)!.pose).toEqual({ x: 0, y: 0, width: 60, height: 10 });
  });
});
