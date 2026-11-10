import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { parseColor } from './color';
import { lerpFill, lerpPaint, lerpStroke } from './lerpPaint';
import type { GradientPaint, Paint, Stroke } from './paint';
import { maxDiff, runs, stopColor, stops, tally, timeoutFor, unit } from './pbt.fixture';

const RUNS = runs(300);

const solid = fc.record({
  color: stopColor.map((c) => c.slice(0, 7)),
  opacity: fc.option(fc.double({ min: 0.01, max: 1, noNaN: true }), { nil: undefined }),
}).map(({ color, opacity }) => (opacity === undefined ? { color } : { color, opacity }) as Paint);

/** What a solid draws: its color's channels and its alpha with opacity folded in. */
function drawn(p: Paint | undefined): [number, number, number, number] {
  if (!p || ('kind' in p && p.kind !== undefined && p.kind !== 'solid')) throw new Error('not a solid');
  const s = p as { color: string; opacity?: number };
  const [r, g, b, a] = parseColor(s.color);
  return [r, g, b, a * (s.opacity ?? 1)];
}

const coord = fc.double({ min: -100, max: 100, noNaN: true });
const point = fc.record({ x: coord, y: coord });

/** Two gradients of one kind with as many stops, which lerpPaint interpolates. */
const gradientPair: fc.Arbitrary<[GradientPaint, GradientPaint]> = fc.integer({ min: 1, max: 4 }).chain((n) => {
  const ss = stops(n, n);
  return fc.oneof(
    fc.tuple(
      fc.record({ kind: fc.constant('linear-gradient' as const), from: point, to: point, stops: ss }),
      fc.record({ kind: fc.constant('linear-gradient' as const), from: point, to: point, stops: ss }),
    ),
    fc.tuple(
      fc.record({ kind: fc.constant('radial-gradient' as const), center: point, radius: fc.double({ min: 0, max: 50, noNaN: true }), stops: ss }),
      fc.record({ kind: fc.constant('radial-gradient' as const), center: point, radius: fc.double({ min: 0, max: 50, noNaN: true }), stops: ss }),
    ),
  );
});

describe('lerpPaint, property', () => {
  it('draws a at 0 and b at 1, for two solids', () => {
    fc.assert(fc.property(solid, solid, (a, b) => {
      expect(maxDiff(drawn(lerpPaint(a, b, 0)), drawn(a))).toBeLessThan(1e-12);
      expect(maxDiff(drawn(lerpPaint(a, b, 1)), drawn(b))).toBeLessThan(1e-12);
    }), RUNS);
  });

  it('holds a solid still between itself and itself', () => {
    fc.assert(fc.property(solid, unit, (a, t) => {
      expect(maxDiff(drawn(lerpPaint(a, a, t)), drawn(a))).toBeLessThan(1e-12);
    }), RUNS);
  });

  it('moves opacity monotonically in t between two solids', () => {
    fc.assert(fc.property(solid, solid, unit, unit, (a, b, t, u) => {
      const [lo, hi] = t <= u ? [t, u] : [u, t];
      const x = drawn(lerpPaint(a, b, lo))[3], y = drawn(lerpPaint(a, b, hi))[3];
      if (drawn(b)[3] >= drawn(a)[3]) expect(y).toBeGreaterThanOrEqual(x - 1e-12);
      else expect(y).toBeLessThanOrEqual(x + 1e-12);
    }), RUNS);
  });

  it('fades a solid in from nothing and out to nothing, in its own color', () => {
    fc.assert(fc.property(solid, unit, (p, t) => {
      expect(drawn(lerpPaint(undefined, p, 0))[3]).toBe(0);
      expect(maxDiff(drawn(lerpPaint(undefined, p, 1)), drawn(p))).toBeLessThan(1e-12);
      expect(maxDiff(drawn(lerpPaint(p, undefined, 0)), drawn(p))).toBeLessThan(1e-12);
      const mid = drawn(lerpPaint(undefined, p, t));
      if (mid[3] > 0) expect(maxDiff(mid.slice(0, 3), drawn(p).slice(0, 3))).toBeLessThanOrEqual(0.5 / 255 + 1e-12);
    }), RUNS);
  });

  it('interpolates two like gradients from a\'s geometry and stops to b\'s', () => {
    fc.assert(fc.property(gradientPair, ([a, b]) => {
      for (const [t, end] of [[0, a], [1, b]] as const) {
        const got = lerpPaint(a, b, t) as GradientPaint;
        expect(got.kind).toBe(end.kind);
        const sorted = [...end.stops].sort((p, q) => p.offset - q.offset);
        expect(maxDiff(got.stops.map((s) => s.offset), sorted.map((s) => s.offset))).toBe(0);
        got.stops.forEach((s, i) => expect(maxDiff(parseColor(s.color), parseColor(sorted[i]!.color))).toBeLessThanOrEqual(0.5 / 255 + 1e-12));
        if (got.kind === 'linear-gradient' && end.kind === 'linear-gradient') {
          expect(maxDiff([got.from.x, got.from.y, got.to.x, got.to.y], [end.from.x, end.from.y, end.to.x, end.to.y])).toBe(0);
        }
        if (got.kind === 'radial-gradient' && end.kind === 'radial-gradient') expect(got.radius === end.radius).toBe(true);
      }
    }), RUNS);
  }, timeoutFor(300, 0.5));

  it('snaps at the halfway mark between paints it cannot blend', () => {
    const t = tally();
    fc.assert(fc.property(gradientPair, solid, unit, ([g], s, u) => {
      for (const [a, b] of [[g, s], [s, g]] as const) {
        expect(lerpPaint(a, b, u)).toBe(u < 0.5 ? a : b);
        t.count(u < 0.5 ? 'a' : 'b');
      }
    }), RUNS);
    t.atLeast('a', 1);
    t.atLeast('b', 1);
  });
});

describe('lerpPaint, shrunk counterexamples', () => {
  it('lands on b\'s offsets and geometry exactly at t = 1', () => {
    const a: GradientPaint = { kind: 'linear-gradient', from: { x: 0.17, y: 0 }, to: { x: 1, y: 0 }, stops: [{ offset: 0.17, color: '#000000' }] };
    const b: GradientPaint = { kind: 'linear-gradient', from: { x: 0.02, y: 0 }, to: { x: 1, y: 0 }, stops: [{ offset: 0.02, color: '#000000' }] };
    const got = lerpPaint(a, b, 1) as GradientPaint & { kind: 'linear-gradient' };
    expect(got.stops[0]!.offset).toBe(0.02);
    expect(got.from.x).toBe(0.02);
    expect(lerpStroke({ width: 0.17, dashOffset: 0.17 }, { width: 0.02, dashOffset: 0.02 }, 1)).toEqual({ width: 0.02, dashOffset: 0.02 });
  });
});

describe('lerpStroke and lerpFill, property', () => {
  const width = fc.oneof(fc.double({ min: 0, max: 20, noNaN: true }), fc.double({ min: 0, max: 20, noNaN: true }).map((px) => ({ px })));
  const stroke: fc.Arbitrary<Stroke> = fc.record({
    paint: solid,
    width: fc.option(width, { nil: undefined }),
    dashOffset: fc.option(fc.double({ min: -50, max: 50, noNaN: true }), { nil: undefined }),
    cap: fc.option(fc.constantFrom('butt', 'round', 'square') as fc.Arbitrary<'butt' | 'round' | 'square'>, { nil: undefined }),
  }, { requiredKeys: ['paint'] });
  const widthOf = (s: Stroke | null | undefined): number => {
    const w = s?.width ?? 1;
    return typeof w === 'object' ? w.px : w;
  };

  it('keeps each end\'s width, dash offset, and fields', () => {
    fc.assert(fc.property(stroke, stroke, (a, b) => {
      for (const [t, end] of [[0, a], [1, b]] as const) {
        const got = lerpStroke(a, b, t)!;
        expect(got.cap).toBe(end.cap);
        const kinds = typeof (a.width ?? 1) === typeof (b.width ?? 1);
        if (kinds) expect(widthOf(got) === widthOf(end)).toBe(true);
        if (a.dashOffset !== undefined || b.dashOffset !== undefined) {
          expect((got.dashOffset ?? 0) === (end.dashOffset ?? 0)).toBe(true);
        }
        expect(maxDiff(drawn(got.paint), drawn(end.paint))).toBeLessThan(1e-12);
      }
    }), RUNS);
  });

  it('thins and fades a stroke in from none', () => {
    fc.assert(fc.property(stroke, unit, fc.constantFrom(null, undefined), (s, t, none) => {
      const got = lerpStroke(none, s, t)!;
      expect(Math.abs(widthOf(got) - widthOf(s) * t)).toBeLessThan(1e-12);
      expect(typeof got.width).toBe(typeof (s.width ?? 1));
      expect(drawn(lerpStroke(none, s, 0)!.paint)[3]).toBe(0);
    }), RUNS);
  });

  it('fades a fill in from none', () => {
    fc.assert(fc.property(solid, unit, fc.constantFrom(null, undefined), (p, t, none) => {
      const got = lerpFill(none, { paint: p }, t)!;
      expect(drawn(got.paint)[3]).toBeLessThanOrEqual(drawn(p)[3] + 1e-12);
      expect(lerpFill(none, none, t)).toBe(none);
    }), RUNS);
  });
});
