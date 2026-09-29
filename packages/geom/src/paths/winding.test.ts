import { describe, expect, it } from 'vitest';
import { pathSignedArea, reversePath } from './winding';
import { pathFromD } from './pathFromD';
import { PATH_M, PATH_L, PATH_C, PATH_Q, PATH_Z } from '../commands';
import type { PolygonPath } from '../path';

const square = (d = 'M0 0 L10 0 L10 10 L0 10 Z'): PolygonPath => pathFromD(d);

describe('pathSignedArea', () => {
  it('is positive for a contour that turns clockwise on a y-down screen', () => {
    expect(pathSignedArea(square())).toBeCloseTo(100, 6);
  });

  it('is negative for the same square wound the other way', () => {
    expect(pathSignedArea(square('M0 0 L0 10 L10 10 L10 0 Z'))).toBeCloseTo(-100, 6);
  });

  it('counts a rect path as positive', () => {
    expect(pathSignedArea({ kind: 'rect', x: 3, y: 4, width: 5, height: 2 })).toBe(10);
  });

  it('closes an open contour implicitly, as a fill does', () => {
    expect(pathSignedArea(square('M0 0 L10 0 L10 10 L0 10'))).toBeCloseTo(100, 6);
  });

  it('integrates cubic segments rather than their control polygon', () => {
    // The standard four-cubic circle approximation's quarter, closed through
    // the center. Its control polygon encloses 0.90, the curve ~pi/4.
    const k = 0.5522847498;
    const quarter = pathFromD(`M0 0 L1 0 C1 ${k} ${k} 1 0 1 Z`);
    expect(pathSignedArea(quarter)).toBeCloseTo(Math.PI / 4, 3);
  });

  it('is exact for a quadratic: the parabolic segment is 2/3 of its hull triangle', () => {
    // Chord from (0,0) to (2,0), control at (1,2): triangle area 2, segment 4/3.
    const p = pathFromD('M0 0 Q1 2 2 0 Z');
    expect(Math.abs(pathSignedArea(p))).toBeCloseTo(4 / 3, 6);
  });

  it('sums contours with their signs, so a hole subtracts', () => {
    const donut = pathFromD('M0 0 L10 0 L10 10 L0 10 Z M2 2 L2 8 L8 8 L8 2 Z');
    expect(pathSignedArea(donut)).toBeCloseTo(100 - 36, 6);
  });
});

describe('reversePath', () => {
  it('flips the sign of the area and keeps its magnitude', () => {
    const p = pathFromD('M0 0 L10 0 C12 4 12 6 10 10 Q5 12 0 10 Z M2 2 L2 8 L8 8 L8 2 Z');
    const r = reversePath(p);
    expect(pathSignedArea(r)).toBeCloseTo(-pathSignedArea(p), 4);
  });

  it('keeps curves as curves, swapping a cubic\'s control points', () => {
    const p = pathFromD('M0 0 C1 2 3 4 5 5 L5 0 Z');
    const r = reversePath(p);
    // M0 0 · closing edge reversed (L5 0) · L back to the cubic's end · the
    // cubic walked backwards · Z.
    expect(Array.from(r.commands)).toEqual([PATH_M, PATH_L, PATH_L, PATH_C, PATH_Z]);
    expect(Array.from(r.coords)).toEqual([0, 0, 5, 0, 5, 5, 3, 4, 1, 2, 0, 0]);
  });

  it('reverses a quadratic in place', () => {
    const r = reversePath(pathFromD('M0 0 Q1 2 2 0 Z'));
    expect(Array.from(r.commands)).toEqual([PATH_M, PATH_L, PATH_Q, PATH_Z]);
    expect(Array.from(r.coords)).toEqual([0, 0, 2, 0, 1, 2, 0, 0]);
  });

  it('leaves an open subpath open, starting from its old end', () => {
    const r = reversePath(pathFromD('M0 0 L1 0 L1 1'));
    expect(Array.from(r.commands)).toEqual([PATH_M, PATH_L, PATH_L]);
    expect(Array.from(r.coords)).toEqual([1, 1, 1, 0, 0, 0]);
  });

  it('is its own inverse on the region it describes', () => {
    const p = square();
    const rr = reversePath(reversePath(p));
    expect(pathSignedArea(rr)).toBeCloseTo(pathSignedArea(p), 6);
    expect(rr.fillRule).toBe(p.fillRule);
  });
});
