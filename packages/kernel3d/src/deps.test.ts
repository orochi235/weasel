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
import { createCamera, cameraEye } from './camera';
import { dot, len, sub } from '@weasel-js/geom/3d';
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

/** Distance from the eye along the view axis — what the depth choice holds. */
function depthOf(vp: Viewport3d, p: readonly [number, number, number]): number {
  const eye = cameraEye(vp.camera);
  const axis = sub(vp.camera.target, eye);
  return dot(sub(p, eye), axis) / len(axis);
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

  describe('remapBounds — the screen map at the pose’s own depth', () => {
    const vp = viewport();
    const descriptorAt = () => createPoseDescriptor(world(scene, () => vp));
    /** The screen box the descriptor itself reports, so src is the real one. */
    const boxOf = (pose: ReturnType<typeof pose3>) => descriptorAt().getBounds(pose);
    const grow = (b: ReturnType<typeof boxOf>, k: number) => ({
      x: b.x, y: b.y, width: b.width * k, height: b.height * k,
    });

    it('leaves a pose alone when the rectangle does not move', () => {
      const pose = pose3([0, 0.5, 0]);
      const same = descriptorAt().remapBounds(pose, boxOf(pose), boxOf(pose));
      expect(same.position[0]).toBeCloseTo(pose.position[0], 6);
      expect(same.position[1]).toBeCloseTo(pose.position[1], 6);
      expect(same.position[2]).toBeCloseTo(pose.position[2], 6);
      expect(same.scale[0]).toBeCloseTo(pose.scale[0], 6);
    });

    it('scales uniformly by the rectangle it is given', () => {
      const pose = pose3([0, 0.5, 0], [1, 2, 3]);
      const src = boxOf(pose);
      const bigger = descriptorAt().remapBounds(pose, src, grow(src, 2));
      expect(bigger.scale[0]).toBeCloseTo(2, 6);
      expect(bigger.scale[1]).toBeCloseTo(4, 6);
      expect(bigger.scale[2]).toBeCloseTo(6, 6);
    });

    it('keeps the depth it was handed', () => {
      const pose = pose3([0, 0.5, 0]);
      const src = boxOf(pose);
      const moved = descriptorAt().remapBounds(pose, src, { ...src, x: src.x + 90 });

      expect(moved.position[0]).not.toBeCloseTo(pose.position[0], 3);
      expect(depthOf(vp, moved.position)).toBeCloseTo(depthOf(vp, pose.position), 6);
    });

    it('moves the solid the way the rectangle moved', () => {
      const pose = pose3([0, 0.5, 0]);
      const src = boxOf(pose);
      const d = descriptorAt();
      const right = d.remapBounds(pose, src, { ...src, x: src.x + 120 });
      const left = d.remapBounds(pose, src, { ...src, x: src.x - 120 });
      expect(d.getBounds(right).x).toBeGreaterThan(src.x);
      expect(d.getBounds(left).x).toBeLessThan(src.x);
    });

    it('returns the pose untouched when the camera casts no ray', () => {
      const flat = viewport({ camera: createCamera({ distance: 0, target: [0, 0.5, 0] }) });
      const d = createPoseDescriptor(world(scene, () => flat));
      const pose = pose3([0, 0.5, 0]);
      const box = { x: 0, y: 0, width: 10, height: 10 };
      expect(d.remapBounds(pose, box, { ...box, width: 20 })).toBe(pose);
    });
  });

  describe('fromBounds — the box the rectangle covers at that depth', () => {
    const vp = viewport();
    const descriptorAt = () => createPoseDescriptor(world(scene, () => vp));

    /**
     * Within a few pixels, not exactly: a box has depth, and under perspective
     * the screen AABB of one is not centered on the projection of its center.
     * The round trip is as tight as the projection allows, not tighter.
     */
    it('lands where the rectangle points', () => {
      const d = descriptorAt();
      const template = pose3([0, 0.5, 0]);
      const box = { x: 340, y: 260, width: 120, height: 90 };

      const back = d.getBounds(d.fromBounds(box, template));

      expect(Math.abs((back.x + back.width / 2) - (box.x + box.width / 2))).toBeLessThan(5);
      expect(Math.abs((back.y + back.height / 2) - (box.y + box.height / 2))).toBeLessThan(5);
    });

    it('carries none of the template but its depth', () => {
      const d = descriptorAt();
      const template = pose3([0, 0.5, 0], [4, 0.25, 4]);
      const built = d.fromBounds({ x: 350, y: 250, width: 100, height: 100 }, template);
      expect(built.scale).not.toEqual(template.scale);
      expect(built.rotation).toEqual([0, 0, 0, 1]);
    });

    it('gives a bigger rectangle a bigger box', () => {
      const d = descriptorAt();
      const template = pose3([0, 0.5, 0]);
      const small = d.fromBounds({ x: 380, y: 280, width: 40, height: 40 }, template);
      const large = d.fromBounds({ x: 300, y: 200, width: 200, height: 200 }, template);
      expect(large.scale[0]).toBeGreaterThan(small.scale[0]);
      expect(large.scale[1]).toBeGreaterThan(small.scale[1]);
      expect(large.scale[2]).toBeGreaterThan(small.scale[2]);
    });

    it('gives the unnamed third extent the mean of the two it has', () => {
      const d = descriptorAt();
      // Looking straight down the -z axis, screen width is world x and screen
      // height is world y, so the remaining extent is the one z takes.
      const overhead = createPoseDescriptor(world(scene, () => viewport({
        camera: createCamera({ distance: 12, pitch: 0, yaw: 0, target: [0, 0.5, 0] }),
      })));
      const built = overhead.fromBounds({ x: 300, y: 240, width: 200, height: 100 }, pose3([0, 0.5, 0]));
      expect(built.scale[2]).toBeCloseTo(Math.sqrt(built.scale[0] * built.scale[1]), 3);
      expect(d).toBeDefined();
    });

    it('returns the template when the camera casts no ray', () => {
      const flat = viewport({ camera: createCamera({ distance: 0, target: [0, 0.5, 0] }) });
      const d = createPoseDescriptor(world(scene, () => flat));
      const template = pose3([0, 0.5, 0]);
      expect(d.fromBounds({ x: 0, y: 0, width: 10, height: 10 }, template)).toBe(template);
    });
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
