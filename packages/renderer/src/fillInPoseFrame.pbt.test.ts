import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { Paint } from '@weasel-js/paint';
import { fillInPoseFrame, fillToBoundsFrame, type FillPoseBox } from './fillInPoseFrame';
import { nonFinite, runs, spread, tally } from './pbt.fixture';

const STOPS = [{ offset: 0, color: '#000000' }, { offset: 1, color: '#ffffff' }];
const p = fc.record({ x: spread(-2, 3), y: spread(-2, 3) });

function fill(units: 'bounds' | 'local' | 'world' | 'screen' | undefined): fc.Arbitrary<Paint> {
  const u = units === undefined ? {} : { units };
  return fc.oneof(
    fc.record({ from: p, to: p }).map((g) => ({ kind: 'linear-gradient' as const, ...g, stops: STOPS, ...u })),
    fc.record({ center: p, radius: spread(0, 3) }).map((g) => ({ kind: 'radial-gradient' as const, ...g, stops: STOPS, ...u })),
    fc.record({ center: p, angle: spread(-7, 7) }).map((g) => ({ kind: 'conic-gradient' as const, ...g, stops: STOPS, ...u })),
    fc.option(p, { nil: undefined }).map((origin) => ({
      kind: 'hatch', size: 8, ...(origin ? { origin } : {}), ...u,
    }) as unknown as Paint),
  );
}

const box: fc.Arbitrary<FillPoseBox> = fc.record({
  x: spread(-500, 500), y: spread(-500, 500),
  width: fc.oneof(spread(0.5, 800), spread(-800, -0.5)), height: fc.oneof(spread(0.5, 800), spread(-800, -0.5)),
});

/** Every number in `a` within `tol` of the same field of `b`, and every other field equal. */
function near(a: unknown, b: unknown, tol: number, at = ''): void {
  if (typeof a === 'number' && typeof b === 'number') {
    expect(Math.abs(a - b), at).toBeLessThanOrEqual(tol * (1 + Math.abs(b)));
    return;
  }
  if (a === null || typeof a !== 'object' || b === null || typeof b !== 'object') {
    expect(a, at).toEqual(b);
    return;
  }
  expect(Object.keys(a).sort(), at).toEqual(Object.keys(b).sort());
  for (const k of Object.keys(a)) near((a as never)[k], (b as never)[k], tol, `${at}.${k}`);
}

const points = (f: Paint): { x: number; y: number }[] => {
  const g = f as { from?: { x: number; y: number }; to?: { x: number; y: number }; center?: { x: number; y: number }; origin?: { x: number; y: number } };
  return [g.from, g.to, g.center, g.origin].filter((q) => q !== undefined);
};

/** A pattern with no origin comes back from a round trip with an explicit zero one. */
const withOrigin = (f: Paint): Paint => (f.kind === 'hatch' && !('origin' in f) ? { ...f, origin: { x: 0, y: 0 } } as Paint : f);

describe('fillInPoseFrame, property', () => {
  it('round-trips a bounds fill through the box\'s frame and back', () => {
    const t = tally();
    fc.assert(fc.property(fill('bounds'), box, (f, b) => {
      const posed = fillInPoseFrame(f, b);
      t.count(f.kind!);
      expect((posed as { units?: string }).units).toBe('local');
      expect(nonFinite(posed)).toEqual([]);
      const back = fillToBoundsFrame(posed as Paint, b);
      near(back, withOrigin(f), 1e-12);
    }), runs(300));
    for (const k of ['linear-gradient', 'radial-gradient', 'conic-gradient', 'hatch']) t.atLeast(k, 30);
  });

  it('round-trips a fill in the box\'s frame through bounds and back', () => {
    fc.assert(fc.property(fill('local'), box, (f, b) => {
      const scaled = structuredClone(f);
      for (const q of points(scaled)) Object.assign(q, { x: b.x + q.x * 100, y: b.y + q.y * 100 });
      const back = fillInPoseFrame(fillToBoundsFrame(scaled, b), b);
      near(back, withOrigin(scaled), 1e-12);
    }), runs(300));
  });

  it('moves every point with the box, and keeps a radius, however the box moves', () => {
    fc.assert(fc.property(fill('bounds'), box, spread(-1000, 1000), spread(-1000, 1000), (f, b, dx, dy) => {
      const at = fillInPoseFrame(f, b), moved = fillInPoseFrame(f, { ...b, x: b.x + dx, y: b.y + dy });
      const pa = points(at as Paint), pb = points(moved as Paint);
      pa.forEach((q, i) => {
        expect(Math.abs(pb[i]!.x - q.x - dx)).toBeLessThanOrEqual(1e-9 * (1 + Math.abs(q.x) + Math.abs(dx)));
        expect(Math.abs(pb[i]!.y - q.y - dy)).toBeLessThanOrEqual(1e-9 * (1 + Math.abs(q.y) + Math.abs(dy)));
      });
      if (f.kind === 'radial-gradient') expect((moved as { radius: number }).radius).toBe((at as { radius: number }).radius);
    }), runs(300));
  });

  it('hands back any fill in another space untouched, by identity', () => {
    fc.assert(fc.property(fc.oneof(fill('local'), fill('world'), fill('screen'), fill(undefined)), box, (f, b) => {
      expect(fillInPoseFrame(f, b)).toBe(f);
    }), runs(300));
  });
});
