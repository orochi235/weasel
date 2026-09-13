import { describe, it, expect } from 'vitest';
import {
  createAreaSelect,
  createInsert,
  createNodeAtPoint,
  createPoseDescriptor,
  screenBoxOf,
  type Viewport3d,
  type ViewportSource,
  type Footprint,
} from './deps';
import { createCamera } from './camera';
import { pose3 } from './pose3';
import {
  boundsOfTestNode, createTestScene, type TestScene,
} from './testScene';
import type { NodeId } from '@weasel-js/core';

const WIDTH = 800;
const HEIGHT = 600;
const CENTER = { x: WIDTH / 2, y: HEIGHT / 2 };

/** Looking down -z from above, at the middle solid. */
function viewport(overrides: Partial<Viewport3d> = {}): Viewport3d {
  return {
    camera: createCamera({ distance: 12, pitch: 0.4, target: [0, 0.5, 0] }),
    width: WIDTH,
    height: HEIGHT,
    ...overrides,
  };
}

function idsOf(scene: TestScene): NodeId[] {
  return [...scene.renderOrder()];
}

function world(scene: TestScene, source: ViewportSource = viewport) {
  return { scene, viewport: source, bounds: boundsOfTestNode };
}

/** What the kernel refuses to decide: which node a footprint implies. */
function mintBox(scene: TestScene) {
  return ({ center, width, depth }: Footprint) => {
    const height = (width + depth) / 2;
    return scene.add({
      kind: 'leaf',
      layer: 'solids',
      pose: pose3([center[0], height / 2, center[2]], [width, height, depth]),
      data: {},
    });
  };
}

describe('createNodeAtPoint', () => {
  it('picks the solid under the middle of the screen', () => {
    const scene = createTestScene();
    const pick = createNodeAtPoint(world(scene, viewport));
    // The sphere is the one at the camera target.
    expect(pick(CENTER)).toBe(idsOf(scene)[1]);
  });

  it('picks nothing over empty sky', () => {
    const scene = createTestScene();
    const pick = createNodeAtPoint(world(scene, viewport));
    expect(pick({ x: 10, y: 10 })).toBeNull();
  });

  it('honors the exclude set', () => {
    const scene = createTestScene();
    const pick = createNodeAtPoint(world(scene, viewport));
    const first = pick(CENTER)!;
    expect(pick(CENTER, [first])).not.toBe(first);
  });

  it('prefers the nearer of two solids on the same ray', () => {
    const scene = createTestScene();
    const vp = viewport();
    const pick = createNodeAtPoint(world(scene, () => vp));
    const behind = scene.add({
      kind: 'leaf',
      layer: 'solids',
      pose: pose3([0, 0.5, -40]),
      data: {},
    });
    expect(pick(CENTER)).not.toBe(behind);
  });

  it('follows the camera: orbiting changes what is under the cursor', () => {
    const scene = createTestScene();
    let vp = viewport();
    const pick = createNodeAtPoint(world(scene, () => vp));
    const before = pick(CENTER);
    vp = { ...vp, camera: createCamera({ distance: 12, pitch: 1.5, target: [0, 0.5, 0] }) };
    const after = pick({ x: WIDTH / 2, y: HEIGHT - 20 });
    expect(before).not.toBe(after);
  });

  it('picks nothing when the camera casts no ray', () => {
    const scene = createTestScene();
    // Sitting on its target, inside the middle solid: a fabricated ray from the
    // eye would start inside it and report a hit.
    const flat = viewport({ camera: createCamera({ distance: 0, target: [0, 0.5, 0] }) });
    const pick = createNodeAtPoint(world(scene, () => flat));
    expect(pick(CENTER)).toBeNull();
  });
});

describe('createAreaSelect', () => {
  it('catches every solid under a rectangle spanning the viewport', () => {
    const scene = createTestScene();
    let held: readonly NodeId[] = [];
    const area = createAreaSelect(world(scene), {
      get: () => held,
      set: (ids) => {
        held = ids;
      },
    });
    const hits = area.hitTestArea({ x: 0, y: 0, width: WIDTH, height: HEIGHT });
    expect(hits).toHaveLength(3);
  });

  it('catches nothing in a corner the solids do not reach', () => {
    const scene = createTestScene();
    const area = createAreaSelect(world(scene), { get: () => [], set: () => {} });
    expect(area.hitTestArea({ x: 0, y: 0, width: 4, height: 4 })).toHaveLength(0);
  });

  it('reads and writes the selection it was handed', () => {
    const scene = createTestScene();
    let held: readonly NodeId[] = ['a' as NodeId];
    const area = createAreaSelect(world(scene), {
      get: () => held,
      set: (ids) => {
        held = ids;
      },
    });
    expect(area.getSelection()).toEqual(['a']);
    area.setSelection(['b', 'c'] as NodeId[]);
    expect(held).toEqual(['b', 'c']);
  });
});

describe('createInsert', () => {
  it('stands a new box on the ground plane under the drag rectangle', () => {
    const scene = createTestScene();
    const before = idsOf(scene).length;
    const insert = createInsert({ viewport, mint: mintBox(scene) });

    const id = insert.commit(
      { x: 300, y: 300, width: 120, height: 120 },
      { kind: 'rect' } as never,
    );

    expect(id).not.toBeNull();
    expect(idsOf(scene)).toHaveLength(before + 1);
    const pose = scene.get(id!)!.pose;
    // Standing on y=0 means the center sits half its height up.
    expect(pose.position[1]).toBeCloseTo(pose.scale[1] / 2, 6);
  });

  it('returns null when the rectangle points at the sky', () => {
    const scene = createTestScene();
    // A shallow camera and a rectangle at the top of the pane: those rays leave
    // above the horizon, so they never reach y=0.
    const shallow = viewport({
      camera: createCamera({ distance: 12, pitch: 0.05, target: [0, 0.5, 0] }),
    });
    const insert = createInsert({ viewport: () => shallow, mint: mintBox(scene) });
    expect(
      insert.commit({ x: 0, y: 0, width: 10, height: 10 }, { kind: 'rect' } as never),
    ).toBeNull();
  });

  it('inserts nothing when the camera casts no ray', () => {
    const scene = createTestScene();
    const flat = viewport({ camera: createCamera({ distance: 0, target: [0, 0.5, 0] }) });
    const insert = createInsert({ viewport: () => flat, mint: mintBox(scene) });
    expect(
      insert.commit({ x: 300, y: 300, width: 120, height: 120 }, { kind: 'rect' } as never),
    ).toBeNull();
  });
});

describe('createPoseDescriptor', () => {
  const scene = createTestScene();

  it('reports a screen box that matches the projected solid', () => {
    const scene = createTestScene();
    const vp = viewport();
    const descriptor = createPoseDescriptor(world(scene, () => vp));
    const id = idsOf(scene)[0];
    const pose = scene.get(id)!.pose;

    const bounds = descriptor.getBounds(pose);
    const projected = screenBoxOf(world(scene, () => vp), id, vp)!;
    expect(bounds.x).toBeCloseTo(projected.x, 6);
    expect(bounds.width).toBeCloseTo(projected.width, 6);
  });

  it('draws a nearer solid bigger', () => {
    const vp = viewport();
    const descriptor = createPoseDescriptor(world(scene, () => vp));
    const near = descriptor.getBounds(pose3([0, 0.5, 4]));
    const far = descriptor.getBounds(pose3([0, 0.5, -4]));
    expect(near.width).toBeGreaterThan(far.width);
  });

  it('refuses remapBounds and fromBounds rather than guessing a depth', () => {
    const descriptor = createPoseDescriptor(world(scene, viewport));
    const box = { x: 0, y: 0, width: 10, height: 10 };
    expect(() => descriptor.remapBounds(pose3([0, 0, 0]), box, box)).toThrow(/no 3D answer/);
    expect(() => descriptor.fromBounds(box, pose3([0, 0, 0]))).toThrow(/no 3D answer/);
  });

  it('turns a screen delta into world movement across the ground plane', () => {
    const vp = viewport();
    const descriptor = createPoseDescriptor(world(scene, () => vp));
    const start = pose3([0, 0.5, 0]);

    const moved = descriptor.translate!(start, 120, 0);
    expect(moved.position[0]).toBeGreaterThan(start.position[0]);
    expect(moved.position[1]).toBeCloseTo(start.position[1], 6);
  });

  it('keeps a dragged solid at its own height', () => {
    const vp = viewport();
    const descriptor = createPoseDescriptor(world(scene, () => vp));
    const start = pose3([0, 3, 0]);
    const moved = descriptor.translate!(start, 40, 40);
    expect(moved.position[1]).toBeCloseTo(3, 6);
  });

  it('moves further for the same drag when the camera is further away', () => {
    const near = createPoseDescriptor(world(scene, () => viewport({
      camera: createCamera({ distance: 6, pitch: 0.4, target: [0, 0.5, 0] }),
    })));
    const far = createPoseDescriptor(world(scene, () => viewport({
      camera: createCamera({ distance: 30, pitch: 0.4, target: [0, 0.5, 0] }),
    })));
    const start = pose3([0, 0.5, 0]);
    const nearMoved = near.translate!(start, 100, 0).position[0];
    const farMoved = far.translate!(start, 100, 0).position[0];
    expect(Math.abs(farMoved)).toBeGreaterThan(Math.abs(nearMoved));
  });

  it('keeps dragging through the last camera that cast a ray', () => {
    let vp = viewport();
    const descriptor = createPoseDescriptor(world(scene, () => vp));
    const start = pose3([0, 0.5, 0]);
    const moved = descriptor.translate!(start, 120, 0);

    vp = viewport({ camera: createCamera({ distance: 0, target: [0, 0.5, 0] }) });
    expect(descriptor.translate!(start, 120, 0)).toEqual(moved);
  });

  it('leaves a pose where it is when no camera has cast a ray yet', () => {
    const flat = viewport({ camera: createCamera({ distance: 0, target: [0, 0.5, 0] }) });
    const descriptor = createPoseDescriptor(world(scene, () => flat));
    const start = pose3([0, 0.5, 0]);
    expect(descriptor.translate!(start, 120, 0)).toBe(start);
  });

  it('says it cannot rotate', () => {
    const descriptor = createPoseDescriptor(world(scene, viewport));
    expect(descriptor.supportsRotation!(pose3([0, 0, 0]))).toBe(false);
  });

  it('bounds a sphere as a sphere once it can see the node', () => {
    const scene = createTestScene();
    const vp = viewport();
    const descriptor = createPoseDescriptor(world(scene, () => vp));
    // Stretched along x: as a sphere it sweeps a cube of side 2, as a box a
    // slab a quarter as tall. Uniform scale would make the two agree.
    const id = scene.add({
      kind: 'leaf',
      layer: 'solids',
      pose: pose3([0, 0.5, 0], [2, 0.5, 0.5]),
      data: { round: true },
    });
    const node = scene.get(id)!;

    const seen = descriptor.forNode!(node).getBounds(node.pose);
    expect(seen).toEqual(screenBoxOf(world(scene, () => vp), id, vp));
    expect(seen.height).toBeGreaterThan(descriptor.getBounds(node.pose).height);
  });

  it('leaves a box alone, specialized or not', () => {
    const scene = createTestScene();
    const vp = viewport();
    const descriptor = createPoseDescriptor(world(scene, () => vp));
    const id = idsOf(scene)[2];
    const node = scene.get(id)!;

    expect(descriptor.forNode!(node).getBounds(node.pose)).toEqual(descriptor.getBounds(node.pose));
    expect(descriptor.getBounds(node.pose)).toEqual(screenBoxOf(world(scene, () => vp), id, vp));
  });

  it('intersects a rectangle drawn over the solid, and not one beside it', () => {
    const scene = createTestScene();
    const vp = viewport();
    const descriptor = createPoseDescriptor(world(scene, () => vp));
    const pose = scene.get(idsOf(scene)[1])!.pose;
    const box = screenBoxOf(world(scene, () => vp), idsOf(scene)[1], vp)!;

    expect(descriptor.intersectsRect!(pose, box)).toBe(true);
    expect(
      descriptor.intersectsRect!(pose, { x: box.x + box.width + 50, y: box.y, width: 10, height: 10 }),
    ).toBe(false);
  });
});
