import { describe, expect, it } from 'vitest';
import type { SnapMark } from '@weasel-js/core';
import type { Vec3 } from '@weasel-js/geom/3d';
import { createCamera } from '../camera';
import { projectPoint, rayAt, type Viewport3d } from '../project';
import { projectSnapMarks } from './marks';

// The eye is at z = 10, looking down -z.
const VP: Viewport3d = { camera: createCamera({ distance: 10 }), width: 400, height: 300, originX: 20, originY: 30 };
const FRONT: Vec3 = { x: 0.5, y: 0.2, z: 0 };
const ALSO_FRONT: Vec3 = { x: -1, y: 0, z: 1 };
const BEHIND: Vec3 = { x: 0, y: 0, z: 15 };

describe('projectPoint', () => {
  it('is where the ray through that screen point passes', () => {
    const s = { x: 150, y: 120 };
    const ray = rayAt(VP, s)!;
    const p = projectPoint({
      x: ray.origin.x + ray.direction.x * 7, y: ray.origin.y + ray.direction.y * 7, z: ray.origin.z + ray.direction.z * 7,
    }, VP)!;
    expect(p.x).toBeCloseTo(s.x, 9);
    expect(p.y).toBeCloseTo(s.y, 9);
  });

  it('answers null behind the camera', () => {
    expect(projectPoint(BEHIND, VP)).toBeNull();
  });
});

describe('projectSnapMarks', () => {
  it('draws what projects and drops what does not', () => {
    const marks: SnapMark<Vec3>[] = [
      { kind: 'point', at: FRONT, glyph: 'corner' },
      { kind: 'point', at: BEHIND, glyph: 'corner' },
      { kind: 'line', from: FRONT, to: ALSO_FRONT },
      { kind: 'line', from: FRONT, to: BEHIND },
    ];
    const { lines, points } = projectSnapMarks(marks, VP);
    expect(points).toEqual([{ at: projectPoint(FRONT, VP), glyph: 'corner' }]);
    expect(lines).toEqual([{ from: projectPoint(FRONT, VP), to: projectPoint(ALSO_FRONT, VP) }]);
  });
});
