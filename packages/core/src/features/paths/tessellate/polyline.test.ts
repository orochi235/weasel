import { describe, it, expect } from 'vitest';
import {
  PATH_M, PATH_L, PATH_Q, PATH_Z,
  type PolygonPath,
  type RectPath,
} from '@weasel-js/core';
import { PathBuilder, polygonFromPoints, rectPath } from '../builder';
import { extractPolylines } from './polyline';

describe('extractPolylines', () => {
  it('emits a closed 4-point polyline for a RectPath', () => {
    const r: RectPath = { kind: 'rect', x: 0, y: 0, width: 10, height: 10 };
    const out = extractPolylines(r);
    expect(out).toHaveLength(1);
    expect(out[0].closed).toBe(true);
    expect(out[0].points).toEqual([0, 0, 10, 0, 10, 10, 0, 10]);
  });

  it('emits a closed polyline for a M/L/L/L/Z polygon', () => {
    const p: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z]),
      coords: new Float32Array([0, 0, 10, 0, 10, 10, 0, 10]),
      fillRule: 'nonzero',
    };
    const out = extractPolylines(p);
    expect(out).toHaveLength(1);
    expect(out[0].closed).toBe(true);
    expect(out[0].points).toEqual([0, 0, 10, 0, 10, 10, 0, 10]);
  });

  it('emits an open polyline for a polygon without Z', () => {
    const p: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PATH_L, PATH_L]),
      coords: new Float32Array([0, 0, 10, 0, 20, 0]),
      fillRule: 'nonzero',
    };
    const out = extractPolylines(p);
    expect(out[0].closed).toBe(false);
  });

  it('flattens curves into polyline points', () => {
    const p: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PATH_Q, PATH_Z]),
      coords: new Float32Array([0, 0, 5, 10, 10, 0]),
      fillRule: 'nonzero',
    };
    const out = extractPolylines(p);
    expect(out[0].points.length).toBeGreaterThan(4);
    expect(out[0].closed).toBe(true);
  });

  it('emits one polyline per contour for multi-contour paths', () => {
    const p: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([
        PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z,
        PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z,
      ]),
      coords: new Float32Array([
        0, 0, 10, 0, 10, 10, 0, 10,
        3, 3, 7, 3, 7, 7, 3, 7,
      ]),
      fillRule: 'nonzero',
    };
    const out = extractPolylines(p);
    expect(out).toHaveLength(2);
    expect(out[0].points.length).toBe(8);
    expect(out[1].points.length).toBe(8);
  });
});

describe('extractPolylines — anchor parameterization', () => {
  it('a triangle polygon emits one anchor index per output point', () => {
    const p = polygonFromPoints([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]);
    const [pl] = extractPolylines(p);
    expect(pl.points.length / 2).toBe(3);
    expect(Array.from(pl.anchorA!)).toEqual([0, 1, 2]);
    expect(Array.from(pl.anchorB!)).toEqual([0, 1, 2]);
    expect(Array.from(pl.anchorT!)).toEqual([0, 0, 0]);
  });

  it('a rect emits 4 anchor indices in CW order', () => {
    const [pl] = extractPolylines(rectPath(0, 0, 10, 10));
    expect(pl.points.length / 2).toBe(4);
    expect(Array.from(pl.anchorA!)).toEqual([0, 1, 2, 3]);
    expect(Array.from(pl.anchorB!)).toEqual([0, 1, 2, 3]);
  });

  it('interior cubic-bezier points get (A, B, t in 0..1) interpolation', () => {
    // Single cubic from anchor 0 to anchor 1 — anchor 1 is the C destination.
    const p = new PathBuilder()
      .moveTo(0, 0)
      .curveTo(0, 100, 100, 100, 100, 0)
      .build();
    const [pl] = extractPolylines(p);
    const n = pl.points.length / 2;
    // First point is anchor 0 (the M); last point is anchor 1 (the C destination).
    expect(pl.anchorA![0]).toBe(0);
    expect(pl.anchorB![0]).toBe(0);
    expect(pl.anchorT![0]).toBe(0);
    expect(pl.anchorA![n - 1]).toBe(1);
    expect(pl.anchorB![n - 1]).toBe(1);
    expect(pl.anchorT![n - 1]).toBe(0);
    // Interior points: anchorA === 0, anchorB === 1, t strictly increasing in (0, 1)
    for (let i = 1; i < n - 1; i++) {
      expect(pl.anchorA![i]).toBe(0);
      expect(pl.anchorB![i]).toBe(1);
      expect(pl.anchorT![i]).toBeGreaterThan(0);
      expect(pl.anchorT![i]).toBeLessThan(1);
    }
  });

  it('anchor index continues across multi-contour paths', () => {
    const p = new PathBuilder()
      .moveTo(0, 0).lineTo(10, 0).lineTo(10, 10).close()
      .moveTo(20, 20).lineTo(30, 20).close()
      .build();
    const [pl1, pl2] = extractPolylines(p);
    expect(Array.from(pl1.anchorA!)).toEqual([0, 1, 2]);
    expect(Array.from(pl2.anchorA!)).toEqual([3, 4]);
  });
});
