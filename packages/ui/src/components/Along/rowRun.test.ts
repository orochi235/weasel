import { describe, expect, test } from 'vitest';
import { arcShape, placeAlongRun, trackRun } from '@weasel-js/geom';
import { rowRun } from './rowRun';

const C = { x: 100, y: 100 };
const ARCS = {
  'top, clockwise': arcShape({ center: C, radius: 100, start: 270, end: 90 }),
  'top, counterclockwise': arcShape({ center: C, radius: 100, start: 90, end: 270, direction: 'ccw' }),
  'bottom, clockwise': arcShape({ center: C, radius: 100, start: 90, end: 270 }),
  'bottom, counterclockwise': arcShape({ center: C, radius: 100, start: 270, end: 90, direction: 'ccw' }),
};

describe('rowRun', () => {
  for (const [name, shape] of Object.entries(ARCS)) {
    test(`${name}: lays items where placeAlongRun's track order does, standing as they read`, () => {
      const opts = { align: 'start', gap: 4 } as const;
      const got = placeAlongRun(rowRun(shape), [20, 30], opts);
      const want = placeAlongRun(trackRun(shape), [20, 30], { ...opts, order: 'track' });
      got.forEach((p, i) => {
        expect(p.point.x).toBeCloseTo(want[i]!.point.x);
        expect(p.point.y).toBeCloseTo(want[i]!.point.y);
        expect(p.angle).toBeCloseTo(want[i]!.angle);
      });
    });

    test(`${name}: right to left starts from the shape's end`, () => {
      expect(rowRun(shape).at(0).point.x).toBeCloseTo(shape.at(0).point.x);
      expect(rowRun(shape, 'rtl').at(0).point.x).toBeCloseTo(shape.at(1).point.x);
    });
  }
});
