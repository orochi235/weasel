import { describe, expect, it } from 'vitest';
import { evalSeg } from '../booleans/contourSegments';
import { segmentLength, segmentTAtLength } from './segmentLength';

const K = 0.5522847498;
/** A quarter circle of radius 100 about the origin, from +x to +y. */
const quarter = [{ x: 100, y: 0 }, { x: 100, y: 100 * K }, { x: 100 * K, y: 100 }, { x: 0, y: 100 }];

describe('segmentLength', () => {
  it('measures a quarter circle of radius 100 as a quarter of its circumference', () => {
    expect(segmentLength(quarter)).toBeCloseTo(50 * Math.PI, 1);
  });

  it('measures a sub-range', () => {
    expect(segmentLength(quarter, 0, 0.5)).toBeCloseTo(segmentLength(quarter) / 2, 3);
  });

  it('measures a line', () => {
    expect(segmentLength([{ x: 0, y: 0 }, { x: 3, y: 4 }])).toBe(5);
  });
});

describe('segmentTAtLength', () => {
  it('finds the parameter at a given run of arc length', () => {
    const p = evalSeg(quarter, segmentTAtLength(quarter, 25 * Math.PI));
    expect(Math.atan2(p.y, p.x)).toBeCloseTo(Math.PI / 4, 3);
  });

  it('clamps to the ends', () => {
    expect(segmentTAtLength(quarter, -5)).toBe(0);
    expect(segmentTAtLength(quarter, 1e6)).toBe(1);
  });
});
