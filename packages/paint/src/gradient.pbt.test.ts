import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { parseColor, rgbaToHex } from './color';
import {
  gradientForBounds, gradientGeometry, resolveGradientStops, sampleGradientStops, sampleResolvedStops, withGradientKind,
} from './gradient';
import type { GradientKind, GradientPaint, GradStop } from './paint';
import { maxDiff, runs, stopColor, stops, unit } from './pbt.fixture';
import type { ColorSpace } from './colorSpaces';

const RUNS = runs(300);
const space = fc.constantFrom<ColorSpace>('rgb', 'oklab', 'oklch');
const coord = fc.double({ min: -1000, max: 1000, noNaN: true });
const point = fc.record({ x: coord, y: coord });
const kind = fc.constantFrom<GradientKind>('linear-gradient', 'radial-gradient', 'conic-gradient');

/** Stops at distinct offsets, so each offset names one color. */
const distinctStops = fc.uniqueArray(
  fc.record({ offset: fc.integer({ min: 0, max: 16 }).map((n) => n / 16), color: stopColor }),
  { minLength: 1, maxLength: 5, selector: (s) => s.offset },
);

const gradient: fc.Arbitrary<GradientPaint> = fc.oneof(
  fc.record({ kind: fc.constant('linear-gradient' as const), from: point, to: point, stops: stops() }),
  fc.record({ kind: fc.constant('radial-gradient' as const), center: point, radius: fc.double({ min: 0, max: 500, noNaN: true }), stops: stops() }),
  fc.record({ kind: fc.constant('conic-gradient' as const), center: point, angle: fc.double({ min: -10, max: 10, noNaN: true }), stops: stops() }),
).chain((g) => fc.record({
  units: fc.constantFrom(undefined, 'bounds', 'local', 'world', 'screen'),
  opacity: fc.option(unit, { nil: undefined }),
}).map((extra) => ({ ...g, ...extra }) as GradientPaint));

const byteTol = (s: ColorSpace): number => (s === 'rgb' ? 1e-12 : 0.5 / 255 + 1e-9);
const shuffled = <T,>(xs: readonly T[]): fc.Arbitrary<T[]> => fc.shuffledSubarray([...xs], { minLength: xs.length, maxLength: xs.length });

describe('sampleResolvedStops, property', () => {
  it('sorts its stops by offset, keeping coincident ones in the order given', () => {
    fc.assert(fc.property(stops(0, 6), (ss) => {
      const r = resolveGradientStops(ss);
      for (let i = 1; i < r.length; i++) expect(r[i - 1]!.offset).toBeLessThanOrEqual(r[i]!.offset);
      const order = (list: readonly { offset: number }[], o: number) => list.filter((s) => s.offset === o);
      for (const s of ss) expect(order(r, s.offset).length).toBe(order(ss, s.offset).length);
    }), RUNS);
  });

  it('answers each stop\'s own color at its offset', () => {
    fc.assert(fc.property(distinctStops, space, (ss, s) => {
      const r = resolveGradientStops(ss);
      for (const stop of r) expect(maxDiff(sampleResolvedStops(r, stop.offset, s), stop.rgba)).toBeLessThanOrEqual(byteTol(s));
    }), RUNS);
  });

  it('extends the end stops flat past either end, NaN reading as the first', () => {
    fc.assert(fc.property(stops(), fc.double({ min: 0, max: 100, noNaN: true }), space, (ss, d, s) => {
      const r = resolveGradientStops(ss);
      expect(sampleResolvedStops(r, r[0]!.offset - d, s)).toBe(r[0]!.rgba);
      expect(sampleResolvedStops(r, r[r.length - 1]!.offset + d + 1e-9, s)).toBe(r[r.length - 1]!.rgba);
      expect(sampleResolvedStops(r, Number.NaN, s)).toBe(r[0]!.rgba);
    }), RUNS);
  });

  it('lands between its neighbors per channel in rgb, and in 0..1 in every space', () => {
    fc.assert(fc.property(distinctStops, unit, space, (ss, t, s) => {
      const r = resolveGradientStops(ss);
      const c = sampleResolvedStops(r, t, s);
      expect(c.every((v) => v >= 0 && v <= 1)).toBe(true);
      if (s !== 'rgb') return;
      const hi = r.findIndex((stop) => stop.offset >= t);
      if (hi <= 0) return;
      const a = r[hi - 1]!.rgba, b = r[hi]!.rgba;
      for (let i = 0; i < 4; i++) {
        expect(c[i]!).toBeGreaterThanOrEqual(Math.min(a[i]!, b[i]!) - 1e-12);
        expect(c[i]!).toBeLessThanOrEqual(Math.max(a[i]!, b[i]!) + 1e-12);
      }
    }), RUNS);
  });

  it('reads the same whatever order the list holds its stops in', () => {
    fc.assert(fc.property(distinctStops.chain((ss) => fc.tuple(fc.constant(ss), shuffled(ss))), unit, space, ([ss, mixed], t, s) => {
      expect(sampleGradientStops(mixed, t, s)).toBe(sampleGradientStops(ss, t, s));
    }), RUNS);
  });

  it('writes, as hex, the color it samples', () => {
    fc.assert(fc.property(stops(), unit, space, (ss, t, s) => {
      expect(sampleGradientStops(ss, t, s)).toBe(rgbaToHex(sampleResolvedStops(resolveGradientStops(ss), t, s)));
    }), RUNS);
  });
});

describe('withGradientKind, property', () => {
  const sameAngle = (a: number, b: number): number => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

  it('keeps stops, units, interpolate and opacity, and the center, through any change of kind', () => {
    fc.assert(fc.property(gradient, kind, (g, k) => {
      const next = withGradientKind(g, k);
      expect(next.kind).toBe(k);
      expect(next.stops).toBe(g.stops);
      expect(next.units).toBe(g.units);
      expect(next.opacity).toBe(g.opacity);
      const c0 = gradientGeometry(g).center, c1 = gradientGeometry(next).center;
      expect(Math.abs(c0.x - c1.x) + Math.abs(c0.y - c1.y)).toBeLessThan(1e-9);
    }), RUNS);
  });

  it('keeps a radial gradient\'s radius, and a conic one\'s angle, through a linear one and back', () => {
    fc.assert(fc.property(gradient, (g) => {
      const back = withGradientKind(withGradientKind(g, 'linear-gradient'), g.kind);
      const a = gradientGeometry(g), b = gradientGeometry(back);
      if (g.kind === 'radial-gradient') expect(Math.abs(a.radius - b.radius)).toBeLessThan(1e-9);
      if (g.kind === 'conic-gradient') expect(sameAngle(a.angle, b.angle)).toBeLessThan(1e-9);
      if (g.kind === 'linear-gradient') expect(back).toBe(g);
    }), RUNS);
  });

  it('spans a box\'s width through its middle, or fills it', () => {
    const size = fc.double({ min: 0, max: 1000, noNaN: true });
    fc.assert(fc.property(coord, coord, size, size, kind, (x, y, width, height, k) => {
      const g = gradientForBounds(k, { x, y, width, height }, [] as GradStop[]);
      const { center, radius } = gradientGeometry(g);
      expect(Math.abs(center.x - (x + width / 2))).toBeLessThan(1e-9);
      expect(Math.abs(center.y - (y + height / 2))).toBeLessThan(1e-9);
      if (k === 'linear-gradient') expect(Math.abs(radius - width / 2)).toBeLessThan(1e-9);
      if (k === 'radial-gradient') expect(radius).toBe(Math.max(width, height) / 2);
    }), RUNS);
  });
});

describe('resolveGradientStops, colors', () => {
  it('parses each stop as parseColor does', () => {
    fc.assert(fc.property(stops(), (ss) => {
      for (const r of resolveGradientStops(ss)) {
        expect(ss.some((s) => s.offset === r.offset && maxDiff(parseColor(s.color), r.rgba) === 0)).toBe(true);
      }
    }), RUNS);
  });
});
