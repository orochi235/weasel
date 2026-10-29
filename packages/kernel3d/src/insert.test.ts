import type { NodeId } from '@weasel-js/core';
import type { Vec3 } from '@weasel-js/geom/3d';
import { describe, expect, it } from 'vitest';
import { aimSpace3d } from './aim';
import { createCamera, MAX_PITCH } from './camera';
import { createInsert, type Footprint } from './insert';
import type { Viewport3d } from './project';

const VP: Viewport3d = { camera: createCamera({}), width: 200, height: 100 };
const DRAG = { x: 50, y: 25, width: 100, height: 50 };

function footprintOf(vp: Viewport3d, up: Vec3 | undefined): Footprint | null {
  let seen: Footprint | null = null;
  createInsert({ viewport: () => vp, up, mint: (f) => ((seen = f), 'n' as NodeId) })
    .commit(DRAG, { kind: 'rect' } as never);
  return seen;
}

describe('createInsert', () => {
  it('lays a footprint on the plane at right angles to `up`, across the two axes it is not', () => {
    // The level default camera looks straight down a z-up world.
    const f = footprintOf(VP, { x: 0, y: 0, z: 1 })!;
    expect(f.center.x).toBeCloseTo(0, 6);
    expect(f.center.y).toBeCloseTo(0, 6);
    expect(f.center.z).toBe(0);
    expect(f.width).toBeCloseTo(8.2843, 3);
    expect(f.depth).toBeCloseTo(4.1421, 3);
  });

  it('lands on the ground aimSpace3d unprojects onto, x and z carrying the 2D x and y', () => {
    const down: Viewport3d = { ...VP, camera: createCamera({ pitch: MAX_PITCH, target: { x: 1, y: 0, z: 2 } }) };
    const f = footprintOf(down, undefined)!;
    const space = aimSpace3d(down, null);
    const corners = [
      { x: DRAG.x, y: DRAG.y },
      { x: DRAG.x + DRAG.width, y: DRAG.y },
      { x: DRAG.x, y: DRAG.y + DRAG.height },
      { x: DRAG.x + DRAG.width, y: DRAG.y + DRAG.height },
    ].map((c) => space.unproject(c)!);
    const xs = corners.map((c) => c.x), ys = corners.map((c) => c.y);
    expect(f.center.y).toBe(0);
    expect(f.center.x).toBeCloseTo((Math.min(...xs) + Math.max(...xs)) / 2, 9);
    expect(f.center.z).toBeCloseTo((Math.min(...ys) + Math.max(...ys)) / 2, 9);
    expect(f.width).toBeCloseTo(Math.max(...xs) - Math.min(...xs), 9);
    expect(f.depth).toBeCloseTo(Math.max(...ys) - Math.min(...ys), 9);
  });
});
