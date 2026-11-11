import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { IMPERIAL_INCHES, METRIC_MM, PIXELS, scaleBar, type UnitScope } from '@weasel-js/quantity';
import { coord, runs, tally, timeoutFor } from '../pbt.fixture';
import { rulerTicks, type RulerTicksOptions } from './ticks';

const RUNS = runs(300);
const TIMEOUT = timeoutFor(300, 5);

const INCHES: UnitScope = { system: IMPERIAL_INCHES };
const MM: UnitScope = { system: METRIC_MM, scale: 1 / 25.4 };

const scopes = fc.constantFrom<UnitScope[]>(
  [INCHES], [{ system: METRIC_MM }], [{ system: PIXELS }], [INCHES, MM], [INCHES, { ...INCHES, drawnAt: 0.4 }],
  [{ system: METRIC_MM }, { system: METRIC_MM, drawnAt: 5 }],
);

/** A zoom across twelve decades, either way up. */
const pxPerUnit = fc
  .tuple(fc.double({ min: -6, max: 6, noNaN: true }), fc.boolean())
  .map(([e, flip]) => (flip ? -1 : 1) * 10 ** e);

const options: fc.Arbitrary<RulerTicksOptions> = fc.record({
  pxPerUnit,
  start: coord(1e5),
  length: fc.double({ min: 1, max: 3000, noNaN: true }),
  scopes,
  origin: coord(1e4),
  majorPx: fc.double({ min: 20, max: 300, noNaN: true }),
  minorPx: fc.double({ min: 1, max: 60, noNaN: true }),
});

/** What rounding the world positions costs on screen, far from zero and zoomed in. */
const roundingPx = (o: RulerTicksOptions): number =>
  1e-14 * (Math.abs(o.start) + Math.abs(o.origin ?? 0) + o.length / Math.abs(o.pxPerUnit)) * Math.abs(o.pxPerUnit);

describe('rulerTicks, property', () => {
  it('lays ticks along the ruler in screen order, evenly, labeling exactly the majors', () => {
    const t = tally();
    fc.assert(fc.property(options, (o) => {
      const r = rulerTicks(o);
      const bar = scaleBar({ pxPerUnit: Math.abs(o.pxPerUnit), scopes: o.scopes, maxPx: o.majorPx! });
      if (r.ticks.length === 0) {
        t.count('none');
        return;
      }
      t.count(o.pxPerUnit < 0 ? 'flipped' : 'upright');
      const rounding = roundingPx(o);
      // `rulerTicks` keeps a tick a billionth of a step past either end.
      const slack = 2e-9 * Math.max(1, o.length, bar.px) + rounding;
      for (const k of r.ticks) {
        expect(k.at).toBeGreaterThanOrEqual(-slack);
        expect(k.at).toBeLessThanOrEqual(o.length + slack);
        expect(k.major).toBe(k.label !== undefined);
      }
      const minor = bar.px / r.subdivisions;
      for (let i = 1; i < r.ticks.length; i++) {
        const d = r.ticks[i]!.at - r.ticks[i - 1]!.at;
        expect(d).toBeGreaterThan(0);
        expect(Math.abs(d - minor)).toBeLessThanOrEqual(1e-9 * Math.max(1, minor) + rounding);
      }
      if (r.subdivisions > 1) {
        t.count('subdivided');
        expect(minor).toBeGreaterThanOrEqual(o.minorPx! - 1e-9);
      }
      const majors = r.ticks.filter((k) => k.major);
      majors.forEach((k, i) => {
        if (i > 0) expect(Math.abs(k.at - majors[i - 1]!.at - bar.px)).toBeLessThanOrEqual(1e-9 * bar.px + rounding);
      });
      // Every tick a step's subdivision apart, every major `subdivisions` ticks apart.
      const firstMajor = r.ticks.findIndex((k) => k.major);
      r.ticks.forEach((k, i) => {
        if (firstMajor >= 0) expect(k.major).toBe((i - firstMajor) % r.subdivisions === 0);
      });
    }), RUNS);
    t.atLeast('upright', 50);
    t.atLeast('flipped', 50);
    t.atLeast('subdivided', 50);
  }, TIMEOUT);

  it('labels each major tick with the reading of where it sits, and no two alike', () => {
    const t = tally();
    fc.assert(fc.property(options, (o) => {
      const r = rulerTicks(o);
      const bar = scaleBar({ pxPerUnit: Math.abs(o.pxPerUnit), scopes: o.scopes, maxPx: o.majorPx! });
      const system = o.scopes[o.scopes.length - 1]!.system;
      const factor = system.units[r.unit] as number;
      const worldPerBase = bar.px / (Math.abs(o.pxPerUnit) * bar.length);
      const majors = r.ticks.filter((k) => k.major);
      for (const k of majors) {
        const world = o.start + k.at / o.pxPerUnit;
        const reading = (world - o.origin!) / worldPerBase / factor;
        const tol = 5e-4 + 1e-6 * Math.max(1, Math.abs(reading)) + 1e-6 * (bar.length / factor);
        expect(Math.abs(Number(k.label) - reading), `${k.label} for ${reading}`).toBeLessThanOrEqual(tol);
        t.count('major');
      }
      expect(new Set(majors.map((k) => k.label)).size).toBe(majors.length);
    }), RUNS);
    t.atLeast('major', 300);
  }, TIMEOUT);

  it('a flipped axis lays out the same ticks as the upright one over the same stretch, mirrored', () => {
    const t = tally();
    fc.assert(fc.property(options, (o) => {
      const p = Math.abs(o.pxPerUnit);
      const up = rulerTicks({ ...o, pxPerUnit: p });
      // The flipped ruler starts at the upright one's far end and runs back over it.
      const down = rulerTicks({ ...o, pxPerUnit: -p, start: o.start + o.length / p });
      // Ticks within a rounding of either end may fall out of one of the two.
      const inner = (at: number) => at > 1e-6 * o.length + 1e-9 && at < o.length * (1 - 1e-6) - 1e-9;
      const a = up.ticks.filter((k) => inner(k.at));
      const b = down.ticks.map((k) => ({ ...k, at: o.length - k.at })).filter((k) => inner(k.at)).reverse();
      expect(b.length).toBe(a.length);
      a.forEach((k, i) => {
        expect(b[i]!.label).toBe(k.label);
        expect(Math.abs(b[i]!.at - k.at)).toBeLessThanOrEqual(1e-6 * Math.max(1, o.length) + roundingPx(o));
      });
      if (a.length > 0) t.count('compared');
    }), RUNS);
    t.atLeast('compared', 100);
  }, TIMEOUT);

  it('moving the origin and the view together changes nothing', () => {
    const t = tally();
    fc.assert(fc.property(options, coord(1e3), (o, by) => {
      const a = rulerTicks(o);
      const b = rulerTicks({ ...o, start: o.start + by, origin: o.origin! + by });
      // A shift rounds each world position, so ticks at the ends may come and go.
      const inner = (at: number) => at > 1e-3 && at < o.length - 1e-3;
      const ka = a.ticks.filter((k) => inner(k.at));
      const kb = b.ticks.filter((k) => inner(k.at));
      expect(kb.length).toBe(ka.length);
      ka.forEach((k, i) => {
        expect(Math.abs(kb[i]!.at - k.at)).toBeLessThanOrEqual(1e-6 * Math.max(1, Math.abs(o.pxPerUnit) * (Math.abs(o.start) + Math.abs(by) + Math.abs(o.origin!))));
        expect(kb[i]!.major).toBe(k.major);
      });
      if (ka.length > 0) t.count('compared');
    }), RUNS);
    t.atLeast('compared', 100);
  }, TIMEOUT);
});
