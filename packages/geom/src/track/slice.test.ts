import { describe, expect, test } from 'vitest';
import type { Point } from '../paths/cubicMath';
import { arcShape } from './arc';
import { ellipseShape } from './ellipse';
import { pathShape } from './path';
import { pathFromD } from '../paths/pathFromD';
import { lineShape, type TrackShape } from './shape';
import { trackShapeD } from './pathData';
import { trackSlice } from './slice';

const close = (p: Point, q: Point) => {
  expect(p.x).toBeCloseTo(q.x);
  expect(p.y).toBeCloseTo(q.y);
};

function expectSlice(shape: TrackShape, from: number, to: number) {
  const part = trackSlice(shape, from, to);
  expect(part.length).toBeCloseTo(shape.length * (to - from), 3);
  for (const g of [0, 0.25, 0.5, 1]) {
    const want = shape.at(from + g * (to - from));
    const got = part.at(g);
    close(got.point, want.point);
    close(got.normal, want.normal);
  }
  return part;
}

describe('trackSlice', () => {
  test('a stretch of an arc is an arc running the same way', () => {
    const cw = arcShape({ center: { x: 100, y: 100 }, radius: 80, start: 300, end: 60 });
    const part = expectSlice(cw, 0.2, 0.7);
    expect(part.kind).toBe('arc');
    expect(trackShapeD(part)).toMatch(/ A /);
    expectSlice(arcShape({ center: { x: 0, y: 0 }, radius: 50, start: 90, end: 270, direction: 'ccw' }), 0.1, 0.4);
  });

  test('a stretch of an ellipse is an ellipse', () => {
    const e = ellipseShape({ center: { x: 0, y: 0 }, radiusX: 120, radiusY: 60, start: 270, end: 90 });
    const part = expectSlice(e, 0.3, 0.9);
    expect(part.kind).toBe('ellipse');
  });

  test('a stretch of a line or a path reads the shape through', () => {
    expect(expectSlice(lineShape({ x: 0, y: 0 }, { x: 100, y: 0 }), 0.25, 0.75).kind).toBe('line');
    const path = pathShape(pathFromD('M 0 0 C 50 -80 150 -80 200 0'))!;
    const part = expectSlice(path, 0.1, 0.6);
    expect(part.nearest(path.at(0.35).point).f).toBeCloseTo(0.5, 2);
  });

  test('the whole shape is the shape itself, and the ends come in either order', () => {
    const a = arcShape({ center: { x: 0, y: 0 }, radius: 50, start: 0, end: 90 });
    expect(trackSlice(a, 0, 1)).toBe(a);
    close(trackSlice(a, 0.8, 0.2).at(0).point, a.at(0.2).point);
  });
});
