/** Counterexamples `degenerate.pbt.test.ts` shrank to, kept as plain examples. */
import { describe, expect, it } from 'vitest';
import { createCamera } from './camera';
import { projectPoint, rectOf, viewProjectionOf } from './project';
import { projectAabbToScreen } from './screen';

const ORIGIN = { x: 0, y: 0, z: 0 };
const POINT_BOX = { min: ORIGIN, max: ORIGIN };

describe('degenerate cameras and panes (shrunk)', () => {
  it('give no box, not a NaN one, through a pane with no width', () => {
    const vp = { camera: createCamera({ distance: 0.5, fov: 0.2, near: 0.01, far: 10 }), width: 0, height: 1 };
    expect(projectAabbToScreen(POINT_BOX, viewProjectionOf(vp), rectOf(vp))).toBeNull();
  });

  it('give no box, not a NaN one, under a zero field of view', () => {
    const vp = { camera: createCamera({ distance: 0.5, fov: 0, near: 0.01, far: 10 }), width: 1, height: 1 };
    expect(projectAabbToScreen(POINT_BOX, viewProjectionOf(vp), rectOf(vp))).toBeNull();
  });

  it('draw nothing where the near plane is the far one', () => {
    const vp = { camera: createCamera({ near: 5, far: 5 }), width: 800, height: 600 };
    expect(projectPoint(ORIGIN, vp)).toBeNull();
    expect(projectAabbToScreen({ min: { x: -1, y: -1, z: -1 }, max: { x: 1, y: 1, z: 1 } }, viewProjectionOf(vp), rectOf(vp))).toBeNull();
  });

  it('draw nothing through a pane with no height', () => {
    expect(projectPoint(ORIGIN, { camera: createCamera({}), width: 800, height: 0 })).toBeNull();
  });
});
