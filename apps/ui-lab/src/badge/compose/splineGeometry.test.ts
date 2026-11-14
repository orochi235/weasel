import { describe, expect, it } from 'vitest';
import {
  dragEnd, dragInterior, insertionAt, maxAngle, normalAxisAt, polarPoint, projectOntoAxis, sampleCurve, sToTheta,
  thetaToS, wheelWeight,
} from './splineGeometry';

describe('s and theta', () => {
  it('maps an octant through s = sin(2θ)', () => {
    expect(maxAngle('octant')).toBeCloseTo(Math.PI / 4, 12);
    expect(sToTheta('octant', 0)).toBe(0);
    expect(sToTheta('octant', 0.5)).toBeCloseTo(Math.PI / 12, 12);
    expect(sToTheta('octant', 1)).toBeCloseTo(Math.PI / 4, 12);
    expect(thetaToS('octant', Math.PI / 12)).toBeCloseTo(0.5, 12);
    expect(thetaToS('octant', 2)).toBeCloseTo(1, 12);
  });

  it('maps a quadrant linearly', () => {
    expect(maxAngle('quadrant')).toBeCloseTo(Math.PI / 2, 12);
    expect(sToTheta('quadrant', 0.5)).toBeCloseTo(Math.PI / 4, 12);
    expect(thetaToS('quadrant', Math.PI / 4)).toBeCloseTo(0.5, 12);
    expect(thetaToS('quadrant', -1)).toBe(0);
    expect(sToTheta('quadrant', 3)).toBeCloseTo(Math.PI / 2, 12);
  });
});

describe('polarPoint and sampleCurve', () => {
  it('puts the curve end up and to the right, with y pointing down', () => {
    const end = polarPoint('octant', 1, 10);
    expect(end.x).toBeCloseTo(10 * Math.SQRT1_2, 12);
    expect(end.y).toBeCloseTo(-10 * Math.SQRT1_2, 12);
  });

  it('samples both ends and every step between', () => {
    const samples = sampleCurve('quadrant', () => 10, 2);
    expect(samples).toHaveLength(3);
    expect(samples[0].x).toBeCloseTo(10, 12);
    expect(samples[0].y).toBeCloseTo(0, 12);
    expect(samples[1].x).toBeCloseTo(10 * Math.SQRT1_2, 12);
    expect(samples[1].y).toBeCloseTo(-10 * Math.SQRT1_2, 12);
    expect(samples[2].x).toBeCloseTo(0, 12);
    expect(samples[2].y).toBeCloseTo(-10, 12);
    expect(sampleCurve('octant', () => 1)).toHaveLength(193);
  });
});

describe('dragEnd', () => {
  it('keeps the first anchor on the cardinal ray and snaps its radius to a half', () => {
    expect(dragEnd('octant', 'first', { x: 30.2, y: -5 }, 2)).toEqual({ s: 0, r: 30, w: 2 });
    expect(dragEnd('octant', 'first', { x: -4, y: 0 }, 1)).toEqual({ s: 0, r: 0, w: 1 });
    expect(dragEnd('octant', 'first', { x: 90, y: 0 }, 1)).toEqual({ s: 0, r: 71, w: 1 });
  });

  it('projects the last anchor onto the far ray', () => {
    expect(dragEnd('octant', 'last', { x: 10, y: -10 }, 1)).toEqual({ s: 1, r: 14, w: 1 });
    expect(dragEnd('quadrant', 'last', { x: 25, y: -33.3 }, 1)).toEqual({ s: 1, r: 33.5, w: 1 });
  });
});

describe('dragInterior', () => {
  const anchors = [{ s: 0, r: 48, w: 1 }, { s: 0.5, r: 30, w: 1.5 }, { s: 1, r: 46, w: 1 }];

  it('follows the pointer in both position and radius, keeping the weight', () => {
    expect(dragInterior('quadrant', anchors, 1, { x: 30, y: -30 })).toEqual({ s: 0.5, r: 42.5, w: 1.5 });
  });

  it('stops short of each neighbor', () => {
    expect(dragInterior('quadrant', anchors, 1, { x: 40, y: 0 })).toEqual({ s: 0.005, r: 40, w: 1.5 });
    expect(dragInterior('quadrant', anchors, 1, { x: 0, y: -40 })).toEqual({ s: 0.995, r: 40, w: 1.5 });
  });
});

describe('insertionAt', () => {
  it('reads the curve position and a half-snapped radius under the pointer', () => {
    const at = insertionAt('quadrant', { x: 30, y: -30 });
    expect(at.s).toBeCloseTo(0.5, 12);
    expect(at.r).toBe(42.5);
  });
});

describe('normalAxisAt and projectOntoAxis', () => {
  const line = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }];

  it('takes the normal at the nearest sample and points it at the anchor', () => {
    const above = normalAxisAt(line, { x: 1, y: -3 });
    expect(above.nx).toBeCloseTo(0, 12);
    expect(above.ny).toBeCloseTo(-1, 12);
    expect(above.ox).toBe(1);
    expect(above.oy).toBe(0);
    expect(normalAxisAt(line, { x: 1.9, y: 3 }).ny).toBeCloseTo(1, 12);
    expect(normalAxisAt(line, { x: 1.9, y: 3 }).ox).toBe(2);
  });

  it('drops a point onto the axis', () => {
    const p = projectOntoAxis({ nx: 0, ny: -1, ox: 1, oy: 0 }, { x: 5, y: -4 });
    expect(p.x).toBeCloseTo(1, 12);
    expect(p.y).toBeCloseTo(-4, 12);
  });
});

describe('wheelWeight', () => {
  it('moves a tenth per notch, up on scroll up, inside zero to three', () => {
    expect(wheelWeight(1, 100)).toBe(0.9);
    expect(wheelWeight(1, -100)).toBe(1.1);
    expect(wheelWeight(3, -1)).toBe(3);
    expect(wheelWeight(0, 1)).toBe(0);
  });
});
