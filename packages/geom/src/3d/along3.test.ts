import { describe, expect, it } from 'vitest';
import { lengthTable } from '../along/lengthTable';
import { pointAtLength } from './along3';

describe('pointAtLength', () => {
  it('answers in Vec3', () => {
    const t = lengthTable([{ points: [0, 0, 0, 0, 3, 0, 0, 3, 4], closed: false }], 3);
    expect(pointAtLength(t, 5)).toEqual({ point: { x: 0, y: 3, z: 2 }, tangent: { x: 0, y: 0, z: 1 } });
  });
});
