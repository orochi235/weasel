import { describe, expect, it } from 'vitest';
import { lengthTable } from '../along/lengthTable';
import { lengthTable3, pointAtLength } from './along3';

describe('pointAtLength', () => {
  it('answers in Vec3', () => {
    const t = lengthTable([{ points: [0, 0, 0, 0, 3, 0, 0, 3, 4], closed: false }], 3);
    expect(pointAtLength(t, 5)).toEqual({ point: { x: 0, y: 3, z: 2 }, tangent: { x: 0, y: 0, z: 1 } });
  });
});

describe('lengthTable3', () => {
  it('measures a polyline of Vec3, closed back to its first when asked', () => {
    const pts = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 3, z: 0 }, { x: 0, y: 3, z: 4 }];
    expect(lengthTable3(pts).total).toBe(7);
    expect(lengthTable3(pts, true).total).toBe(12);
    expect(pointAtLength(lengthTable3(pts), 5).point).toEqual({ x: 0, y: 3, z: 2 });
  });
});
