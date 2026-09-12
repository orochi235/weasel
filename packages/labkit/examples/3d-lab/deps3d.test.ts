import { describe, it, expect } from 'vitest';
import {
  createAreaSelect,
  createInsert,
  createNodeAtPoint,
  createPoseDescriptor,
  screenBoxOf,
  type Viewport3d,
} from './deps3d';
import { createCamera } from './camera3d';
import { createSolidScene, pose3, type SolidScene } from './scene3d';
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

function idsOf(scene: SolidScene): NodeId[] {
  return [...scene.renderOrder()];
}

describe('createNodeAtPoint', () => {
  it('picks the solid under the middle of the screen', () => {
    const scene = createSolidScene();
    const pick = createNodeAtPoint(scene, viewport);
    // The sphere is the one at the camera target.
    expect(pick(CENTER)).toBe(idsOf(scene)[1]);
  });

  it('picks nothing over empty sky', () => {
    const scene = createSolidScene();
    const pick = createNodeAtPoint(scene, viewport);
    expect(pick({ x: 10, y: 10 })).toBeNull();
  });

  it('honors the exclude set', () => {
    const scene = createSolidScene();
    const pick = createNodeAtPoint(scene, viewport);
    const first = pick(CENTER)!;
    expect(pick(CENTER, [first])).not.toBe(first);
  });

  it('prefers the nearer of two solids on the same ray', () => {
    const scene = createSolidScene();
    const vp = viewport();
    const pick = createNodeAtPoint(scene, () => vp);
    const behind = scene.add({
      kind: 'leaf',
      layer: 'solids',
      pose: pose3([0, 0.5, -40]),
      data: { kind: 'box', color: '#fff' },
    });
    expect(pick(CENTER)).not.toBe(behind);
  });

  it('follows the camera: orbiting changes what is under the cursor', () => {
    const scene = createSolidScene();
    let vp = viewport();
    const pick = createNodeAtPoint(scene, () => vp);
    const before = pick(CENTER);
    vp = { ...vp, camera: createCamera({ distance: 12, pitch: 1.5, target: [0, 0.5, 0] }) };
    const after = pick({ x: WIDTH / 2, y: HEIGHT - 20 });
    expect(before).not.toBe(after);
  });
});

describe('createAreaSelect', () => {
  it('catches every solid under a rectangle spanning the viewport', () => {
    const scene = createSolidScene();
    let held: readonly NodeId[] = [];
    const area = createAreaSelect(scene, viewport, {
      get: () => held,
      set: (ids) => {
        held = ids;
      },
    });
    const hits = area.hitTestArea({ x: 0, y: 0, width: WIDTH, height: HEIGHT });
    expect(hits).toHaveLength(3);
  });

  it('catches nothing in a corner the solids do not reach', () => {
    const scene = createSolidScene();
    const area = createAreaSelect(scene, viewport, { get: () => [], set: () => {} });
    expect(area.hitTestArea({ x: 0, y: 0, width: 4, height: 4 })).toHaveLength(0);
  });

  it('reads and writes the selection it was handed', () => {
    const scene = createSolidScene();
    let held: readonly NodeId[] = ['a' as NodeId];
    const area = createAreaSelect(scene, viewport, {
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
    const scene = createSolidScene();
    const before = idsOf(scene).length;
    const insert = createInsert(scene, viewport);

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
    const scene = createSolidScene();
    // A shallow camera and a rectangle at the top of the pane: those rays leave
    // above the horizon, so they never reach y=0.
    const shallow = viewport({
      camera: createCamera({ distance: 12, pitch: 0.05, target: [0, 0.5, 0] }),
    });
    const insert = createInsert(scene, () => shallow);
    expect(
      insert.commit({ x: 0, y: 0, width: 10, height: 10 }, { kind: 'rect' } as never),
    ).toBeNull();
  });
});

describe('createPoseDescriptor', () => {
  it('reports a screen box that matches the projected solid', () => {
    const scene = createSolidScene();
    const vp = viewport();
    const descriptor = createPoseDescriptor(() => vp);
    const id = idsOf(scene)[0];
    const pose = scene.get(id)!.pose;

    const bounds = descriptor.getBounds(pose);
    const projected = screenBoxOf(scene, id, vp)!;
    expect(bounds.x).toBeCloseTo(projected.x, 6);
    expect(bounds.width).toBeCloseTo(projected.width, 6);
  });

  it('draws a nearer solid bigger', () => {
    const vp = viewport();
    const descriptor = createPoseDescriptor(() => vp);
    const near = descriptor.getBounds(pose3([0, 0.5, 4]));
    const far = descriptor.getBounds(pose3([0, 0.5, -4]));
    expect(near.width).toBeGreaterThan(far.width);
  });

  it('refuses remapBounds and fromBounds rather than guessing a depth', () => {
    const descriptor = createPoseDescriptor(viewport);
    const box = { x: 0, y: 0, width: 10, height: 10 };
    expect(() => descriptor.remapBounds(pose3([0, 0, 0]), box, box)).toThrow(/no 3D answer/);
    expect(() => descriptor.fromBounds(box, pose3([0, 0, 0]))).toThrow(/no 3D answer/);
  });

  it('turns a screen delta into world movement across the ground plane', () => {
    const vp = viewport();
    const descriptor = createPoseDescriptor(() => vp);
    const start = pose3([0, 0.5, 0]);

    const moved = descriptor.translate!(start, 120, 0);
    expect(moved.position[0]).toBeGreaterThan(start.position[0]);
    expect(moved.position[1]).toBeCloseTo(start.position[1], 6);
  });

  it('keeps a dragged solid at its own height', () => {
    const vp = viewport();
    const descriptor = createPoseDescriptor(() => vp);
    const start = pose3([0, 3, 0]);
    const moved = descriptor.translate!(start, 40, 40);
    expect(moved.position[1]).toBeCloseTo(3, 6);
  });

  it('moves further for the same drag when the camera is further away', () => {
    const near = createPoseDescriptor(() => viewport({
      camera: createCamera({ distance: 6, pitch: 0.4, target: [0, 0.5, 0] }),
    }));
    const far = createPoseDescriptor(() => viewport({
      camera: createCamera({ distance: 30, pitch: 0.4, target: [0, 0.5, 0] }),
    }));
    const start = pose3([0, 0.5, 0]);
    const nearMoved = near.translate!(start, 100, 0).position[0];
    const farMoved = far.translate!(start, 100, 0).position[0];
    expect(Math.abs(farMoved)).toBeGreaterThan(Math.abs(nearMoved));
  });

  it('says it cannot rotate', () => {
    const descriptor = createPoseDescriptor(viewport);
    expect(descriptor.supportsRotation!(pose3([0, 0, 0]))).toBe(false);
  });

  it('intersects a rectangle drawn over the solid, and not one beside it', () => {
    const scene = createSolidScene();
    const vp = viewport();
    const descriptor = createPoseDescriptor(() => vp);
    const pose = scene.get(idsOf(scene)[1])!.pose;
    const box = screenBoxOf(scene, idsOf(scene)[1], vp)!;

    expect(descriptor.intersectsRect!(pose, box)).toBe(true);
    expect(
      descriptor.intersectsRect!(pose, { x: box.x + box.width + 50, y: box.y, width: 10, height: 10 }),
    ).toBe(false);
  });
});
