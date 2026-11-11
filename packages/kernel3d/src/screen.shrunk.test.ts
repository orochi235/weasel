/** Counterexamples the screen-side properties shrank to, kept as plain examples. */
import { describe, expect, it } from 'vitest';
import { cross, len, normalize, sub } from '@weasel-js/geom/3d';
import { createCamera } from './camera';
import { rayAt } from './project';

describe('rayAt (shrunk)', () => {
  it('casts a ray from a camera a third of a million units from the origin', () => {
    const target = { x: 0, y: 0, z: 316195.29483238654 };
    const vp = { camera: createCamera({ target, distance: 0.5, fov: 0.2 }), width: 20, height: 20 };
    const ray = rayAt(vp, { x: 10, y: 10 });
    expect(ray).not.toBeNull();
    expect(len(cross(sub(target, ray!.origin), normalize(ray!.direction)))).toBeLessThanOrEqual(1e-9);
  });
});
