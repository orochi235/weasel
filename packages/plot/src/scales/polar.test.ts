import { describe, expect, it } from 'vitest';
import { polarScale } from './polar';

const scale = polarScale({ center: { x: 100, y: 100 }, radius: [0, 50], domain: [0, 10], axes: 4 });

describe('polarScale', () => {
  it('spaces its axes evenly, clockwise from twelve o\'clock', () => {
    expect(scale.kind).toBe('polar');
    expect(scale.angle(0)).toBe(0);
    expect(scale.angle(1)).toBeCloseTo(Math.PI / 2);
    expect(polarScale({ ...scale, axes: 3, startAngle: 1 }).angle(1)).toBeCloseTo(1 + (2 * Math.PI) / 3);
  });

  it('places a value along its axis, the domain spread over the radius', () => {
    const up = scale.point(0, 10);
    expect(up.x).toBeCloseTo(100);
    expect(up.y).toBeCloseTo(50);
    const right = scale.point(1, 5);
    expect(right.x).toBeCloseTo(125);
    expect(right.y).toBeCloseTo(100);
    expect(scale.radiusAt(4)).toBeCloseTo(20);
    const ring = polarScale({ center: { x: 0, y: 0 }, radius: [10, 30], domain: [0, 1], axes: 2 });
    expect(ring.point(1, 0).y).toBeCloseTo(10);
  });

  it('reads the value of the nearest point on an axis, clamped to the domain', () => {
    expect(scale.valueAt(1, { x: 120, y: 140 })).toBeCloseTo(4);
    expect(scale.valueAt(0, { x: 100, y: 0 })).toBe(10);
    expect(scale.valueAt(0, { x: 100, y: 180 })).toBe(0);
  });

  it('ticks and formats its domain as a linear scale does', () => {
    expect(scale.ticks()).toEqual([0, 2, 4, 6, 8, 10]);
    expect(scale.tickStep()).toBe(2);
    expect(polarScale({ ...scale, domain: [0, 1] }).format(0.5)).toBe('0.5');
  });
});
