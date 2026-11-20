import { describe, expect, it } from 'vitest';
import { dot, normalize, type Vec3 } from '@weasel-js/geom/3d';
import { createCamera } from './camera';
import { groundAxes } from './ground';
import { pose3 } from './pose3';
import { draggedOnLevel } from './screenPose';
import type { Viewport3d } from './project';

describe('draggedOnLevel', () => {
  it('keeps the height along a tilted up, moving the whole way across its level plane', () => {
    const up: Vec3 = normalize({ x: 0, y: 1, z: 1 });
    const vp: Viewport3d = { camera: createCamera({ distance: 12, pitch: 0.5, yaw: 0.3 }), width: 800, height: 600, up };
    const pose = pose3({ x: 0.5, y: 1, z: -0.5 });
    const box = { x: 380, y: 280, width: 40, height: 40 };
    const moved = draggedOnLevel(vp, box, pose, { x: 60, y: -45 }, up, groundAxes(up).up);
    expect(moved.position).not.toEqual(pose.position);
    expect(dot(up, moved.position)).toBeCloseTo(dot(up, pose.position), 9);
  });

  it('keeps the height exactly along an axis up', () => {
    const up: Vec3 = { x: 0, y: 1, z: 0 };
    const vp: Viewport3d = { camera: createCamera({ distance: 12, pitch: 0.5, yaw: 0.3 }), width: 800, height: 600 };
    const pose = pose3({ x: 0.5, y: 0.3, z: -0.5 });
    const box = { x: 380, y: 280, width: 40, height: 40 };
    const moved = draggedOnLevel(vp, box, pose, { x: 60, y: -45 }, up, 'y');
    expect(moved.position.y).toBe(0.3);
  });
});
