/**
 * The spatial model: for any finite positions and any options `checkListener` accepts, a finite gain inside 0..1
 * and a finite pan inside -1..1; whole gain within the reference distance; gain never rising as a source moves
 * away; swapping source and listener keeping the gain and mirroring the pan; and the length of `right` ignored.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { checkListener, spatialize, type SpatialOptions, type SpatialPoint } from './spatialize';
import { anyFinite, runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 500;

const coord = fc.oneof({ weight: 4, arbitrary: fc.integer({ min: -2000, max: 2000 }) }, { weight: 2, arbitrary: anyFinite });
const point: fc.Arbitrary<SpatialPoint> = fc.record({ x: coord, y: coord, z: coord }, { requiredKeys: ['x', 'y'] });
const option = fc.oneof(fc.constantFrom(0, 1, 10, 500, 10000), fc.integer({ min: -10, max: 20000 }), anyFinite);
const options: fc.Arbitrary<SpatialOptions> = fc.record({
  refDistance: option, maxDistance: option, rolloff: fc.constantFrom('inverse', 'linear'),
  rolloffFactor: option, panWidth: option, right: point,
}, { requiredKeys: [] });
/** Options a scene would plausibly set, where a far source is quieter than a near one. */
const sane: fc.Arbitrary<SpatialOptions> = fc.record({
  refDistance: fc.double({ min: 0.01, max: 100, noNaN: true }), maxDistance: fc.double({ min: 0, max: 1e5, noNaN: true }),
  rolloff: fc.constantFrom('inverse', 'linear'), rolloffFactor: fc.double({ min: 0, max: 10, noNaN: true }),
  panWidth: fc.oneof(fc.constant(0), fc.double({ min: 1e-3, max: 1000, noNaN: true })),
  right: fc.record({ x: fc.integer({ min: -5, max: 5 }), y: fc.integer({ min: -5, max: 5 }), z: fc.integer({ min: -5, max: 5 }) }),
}, { requiredKeys: [] });

/** A listener near the origin, so adding a short offset to it does not round the offset away. */
const nearOrigin: fc.Arbitrary<SpatialPoint> = fc.record({ x: fc.integer({ min: -2000, max: 2000 }), y: fc.integer({ min: -2000, max: 2000 }), z: fc.integer({ min: -2000, max: 2000 }) });
const plus0 = (v: number): number => v + 0;

describe('spatialize', () => {
  it('gives a finite gain in 0..1 and pan in -1..1 for anything checkListener accepts, and the same mirrored from the source', () => {
    const seen = tally();
    fc.assert(fc.property(point, point, options, (source, listener, opts) => {
      checkListener(listener, opts);
      const { gain, pan } = spatialize(source, listener, opts);
      expect(Number.isFinite(gain), `gain ${gain}`).toBe(true);
      expect(Number.isFinite(pan), `pan ${pan}`).toBe(true);
      expect(gain).toBeGreaterThanOrEqual(0);
      expect(gain).toBeLessThanOrEqual(1);
      expect(Math.abs(pan)).toBeLessThanOrEqual(1);
      const back = spatialize(listener, source, opts);
      expect(back.gain).toBe(gain);
      expect(plus0(back.pan)).toBe(plus0(-pan));
      if (gain > 0 && gain < 1) seen.count('between');
      if (pan !== 0) seen.count('panned');
    }), runs(RUNS));
    seen.atLeast('between', RUNS / 10);
    seen.atLeast('panned', RUNS / 4);
  }, timeoutFor(RUNS, 2));

  it('holds gain at 1 within the reference distance and never raises it as the source moves away', () => {
    const seen = tally();
    fc.assert(fc.property(nearOrigin, point, sane, fc.double({ min: 1, max: 100, noNaN: true }), (listener, offset, opts, k) => {
      const at = (s: number): SpatialPoint => ({ x: listener.x + offset.x * s, y: listener.y + offset.y * s, z: (listener.z ?? 0) + (offset.z ?? 0) * s });
      const near = spatialize(at(1), listener, opts).gain;
      const far = spatialize(at(k), listener, opts).gain;
      expect(far).toBeLessThanOrEqual(near + 1e-12);
      const ref = opts.refDistance ?? 1;
      const d = Math.hypot(offset.x, offset.y, offset.z ?? 0);
      if (d > 1e-300 && d < 1e300) {
        expect(spatialize(at((ref * 0.999) / d), listener, opts).gain).toBe(1);
        seen.count('inside');
      }
      if (far < near) seen.count('quieter');
    }), runs(RUNS));
    seen.atLeast('inside', RUNS / 2);
    seen.atLeast('quieter', RUNS / 20);
  }, timeoutFor(RUNS, 2));

  it('ignores the length of `right`', () => {
    fc.assert(fc.property(point, point, sane, fc.double({ min: 1e-3, max: 1e3, noNaN: true }), (source, listener, opts, k) => {
      const r = opts.right ?? { x: 1, y: 0, z: 0 };
      const scaled = { ...opts, right: { x: r.x * k, y: r.y * k, z: (r.z ?? 0) * k } };
      expect(spatialize(source, listener, scaled).pan).toBeCloseTo(spatialize(source, listener, opts).pan, 9);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 1));
});
