import type { NodeId } from '@weasel-js/core';
import type { Vec3 } from '@weasel-js/geom/3d';
import { describe, expect, it } from 'vitest';
import { aimSpace3d } from './aim';
import { createCamera, MAX_PITCH } from './camera';
import { createInsert, type Footprint } from './insert';
import type { Viewport3d } from './project';

const VP: Viewport3d = { camera: createCamera({}), width: 200, height: 100 };
const DRAG = { x: 50, y: 25, width: 100, height: 50 };
/** A camera a hair short of looking straight down its world's up, where `lookAt` would degenerate. */
const TOP: Viewport3d = { ...VP, camera: createCamera({ pitch: Math.PI / 2 - 1e-6 }) };

function footprintOf(vp: Viewport3d, up: Vec3 | undefined): Footprint | null {
  let seen: Footprint | null = null;
  createInsert({ viewport: () => vp, up, mint: (f) => ((seen = f), 'n' as NodeId) })
    .commit(DRAG, { kind: 'rect' } as never);
  return seen;
}

describe('createInsert', () => {
  it('casts through the camera of the view it was built for, as the other dep factories do', () => {
    const right: Viewport3d = { ...TOP, camera: { ...TOP.camera, target: { x: 5, y: 0, z: 0 } } };
    const asked: (string | null | undefined)[] = [];
    let seen: Footprint | null = null;
    createInsert({
      viewport: (viewId) => { asked.push(viewId); return viewId === 'right' ? right : VP; },
      viewId: 'right',
      up: { x: 0, y: 0, z: 1 },
      mint: (f) => ((seen = f), 'n' as NodeId),
    }).commit(DRAG, { kind: 'rect' } as never);
    expect(asked).toEqual(['right']);
    expect(seen!.center.x).toBeCloseTo(5, 6);
  });

  it('takes its viewport and up from a world, so it casts where the world\'s snap and camera do', () => {
    const up = { x: 0, y: 0, z: 1 };
    let seen: Footprint | null = null;
    createInsert({ world: { viewport: () => TOP, up }, mint: (f) => ((seen = f), 'n' as NodeId) })
      .commit(DRAG, { kind: 'rect' } as never);
    expect(seen).toEqual(footprintOf(TOP, up));
  });

  it('lays a footprint on the plane at right angles to `up`, across the two axes it is not', () => {
    const f = footprintOf(TOP, { x: 0, y: 0, z: 1 })!;
    expect(f.center.x).toBeCloseTo(0, 6);
    expect(f.center.y).toBeCloseTo(0, 6);
    expect(f.center.z).toBe(0);
    expect(f.width).toBeCloseTo(8.2843, 3);
    expect(f.depth).toBeCloseTo(4.1421, 3);
  });

  it('reads an `up` off an axis by rounding as that axis', () => {
    // Rotating +y a quarter turn about +x leaves cos(π/2) in y.
    const noisy = footprintOf(TOP, { x: 0, y: Math.cos(Math.PI / 2), z: 1 })!;
    expect(noisy.center.z).toBe(0);
    expect(noisy.width).toBeCloseTo(8.2843, 3);
    expect(noisy.depth).toBeCloseTo(4.1421, 3);
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

  it('declines a rectangle reaching over the horizon, with its ends or without', () => {
    const shallow: Viewport3d = {
      camera: createCamera({ distance: 12, pitch: 0.05, target: { x: 0, y: 0.5, z: 0 } }),
      width: 800,
      height: 600,
    };
    const minted: Footprint[] = [];
    const insert = createInsert({ viewport: () => shallow, mint: (f) => (minted.push(f), 'n' as NodeId) });
    // The top two corners leave above the horizon; the bottom two reach the ground.
    const across = { x: 300, y: 0, width: 200, height: 599 };
    const ends = { start: { x: 300, y: 0 }, end: { x: 500, y: 599 } };
    expect(insert.commit(across, { kind: 'rect' } as never, ends)).toBeNull();
    expect(insert.commit(across, { kind: 'rect' } as never)).toBeNull();
    expect(minted).toEqual([]);
  });
});
