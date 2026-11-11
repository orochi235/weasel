import { describe, expect, it } from 'vitest';
import { mirrorAcross } from './kinds';

describe('the kinds, shrunk', () => {
  it('mirrors across an axis near the double range, which doubled past it and drew NaN', () => {
    const m = mirrorAcross({ x: 0, y: 0 }, -8.98846567431158e307);
    expect(m.every(Number.isFinite)).toBe(true);
    const r = (-8.98846567431158e307 % Math.PI) * 2;
    expect(m[0]).toBeCloseTo(Math.cos(r), 12);
  });

});
