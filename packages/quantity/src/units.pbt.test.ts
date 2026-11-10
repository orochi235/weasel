import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { formatUnit, IMPERIAL_INCHES, METRIC_MM, ANGLE_RADIANS, resolveAxes, resolveUnit, unitScale, type UnitEntry, type UnitSystem } from './units';
import { formatScoped, fromRoot, resolveScoped, toRoot, type UnitScope } from './scope';
import { scaleBar } from './scaleBar';
import { qty } from './present';
import { finite, runs, typed } from './pbt.fixture';

const RUNS = runs(200);

/** A factor anywhere from a millionth to a million, either side of 1. */
const factor = fc.double({ min: -6, max: 6, noNaN: true }).map((k) => 10 ** k);

/** A pure scale or, now and then, an affine entry that moves zero. */
const entry: fc.Arbitrary<UnitEntry> = fc.oneof(
  { weight: 3, arbitrary: factor },
  { weight: 1, arbitrary: fc.record({ factor, offset: finite(1000) }) },
);

/** A system of three to five units named `u0`…, one of them the base at 1. */
const system: fc.Arbitrary<UnitSystem> = fc.array(entry, { minLength: 2, maxLength: 4 })
  .map((entries) => ({ base: 'u0', units: Object.fromEntries([['u0', 1], ...entries.map((e, i) => [`u${i + 1}`, e])]) }));

const unitIn = (s: UnitSystem) => fc.constantFrom(...Object.keys(s.units));

/** How far apart two readings may be after `hops` conversions of a value near `size`. */
const close = (a: number, b: number, size: number, hops: number, shown = 0) =>
  expect(Math.abs(a - b), `${a} vs ${b}`).toBeLessThanOrEqual(Math.max(1, Math.abs(size)) * 1e-15 * 64 * hops + shown);

describe('unit conversion, property', () => {
  it('converts a value to another unit and back to where it started', () => {
    fc.assert(fc.property(system.chain((s) => fc.tuple(fc.constant(s), unitIn(s), unitIn(s))), finite(1e6), ([s, a, b], v) => {
      const there = qty({ value: v, unit: a }).to(b, s);
      const back = there.to(a, s);
      const { factor: fa, offset: oa } = unitScale(s, a);
      const { factor: fb } = unitScale(s, b);
      // Each hop rounds once in the base, whose size is v·fa + oa, read back at the scale of a.
      close(back.value, v, Math.abs(v) + Math.abs(oa / fa) + Math.abs(there.value * fb / fa), 4);
    }), RUNS);
  });

  it('converts a→b→c to the same value as a→c', () => {
    fc.assert(fc.property(system.chain((s) => fc.tuple(fc.constant(s), unitIn(s), unitIn(s), unitIn(s))), finite(1e6), ([s, a, b, c], v) => {
      const via = qty({ value: v, unit: a }).to(b, s).to(c, s).value;
      const direct = qty({ value: v, unit: a }).to(c, s).value;
      const base = Math.abs(resolveUnit({ value: v, unit: a }, s)) + Math.abs(resolveUnit({ value: via, unit: c }, s));
      const scale = (u: string) => unitScale(s, u);
      close(via, direct, (base + Math.abs(scale(b).offset) + Math.abs(scale(c).offset)) / scale(c).factor, 6);
    }), RUNS);
  });

  it('agrees with scaling the value by the ratio of two pure-scale units', () => {
    const pure: [UnitSystem, string, string][] = [
      [IMPERIAL_INCHES, 'ft', 'in'], [IMPERIAL_INCHES, 'mi', 'yd'], [METRIC_MM, 'km', 'cm'], [METRIC_MM, 'm', 'mm'], [ANGLE_RADIANS, 'turn', 'deg'],
    ];
    fc.assert(fc.property(fc.constantFrom(...pure), typed, ([s, big, small], { value }) => {
      const k = unitScale(s, big).factor / unitScale(s, small).factor;
      const a = resolveUnit({ value, unit: big }, s);
      const b = resolveUnit({ value: value * k, unit: small }, s);
      close(a, b, a, 4);
    }), RUNS);
  });

  it('formats a base value that reads back to within half its last place', () => {
    fc.assert(fc.property(system.chain((s) => fc.tuple(fc.constant(s), unitIn(s))), finite(1e6), fc.integer({ min: 0, max: 6 }), fc.boolean(), ([s, u], base, precision, pad) => {
      const { factor: f, offset } = unitScale(s, u);
      const shown = (base - offset) / f;
      if (Math.abs(shown) > 1e15) return;
      const text = formatUnit(base, u, s, { precision, pad });
      expect(text.endsWith(u)).toBe(true);
      const n = Number(text.slice(0, -u.length));
      expect(Number.isNaN(n), text).toBe(false);
      expect(Math.abs(n - shown), text).toBeLessThanOrEqual(0.5 * 10 ** -precision + Math.abs(shown) * 1e-15);
      expect(Object.is(n, -0), text).toBe(false);
      if (pad && precision > 0) expect(text.slice(0, -u.length)).toMatch(new RegExp(`\\.\\d{${precision}}$`));
    }), RUNS);
  });

  it('names an unknown unit rather than reading a property every object has', () => {
    const name = fc.oneof(fc.constantFrom('toString', 'constructor', '__proto__', 'hasOwnProperty', 'valueOf', ''), fc.string({ maxLength: 6 }));
    fc.assert(fc.property(system, name, finite(), (s, n, v) => {
      if (Object.hasOwn(s.units, n)) return;
      expect(() => resolveUnit({ value: v, unit: n }, s)).toThrow(/unknown unit/);
      expect(() => formatUnit(v, n, s)).toThrow(/unknown unit/);
      expect(() => resolveAxes({ x: v, y: { value: v, unit: n } }, s)).toThrow(/^y axis: .*unknown unit/);
    }), RUNS);
  });
});

/** A chain of one to four scopes, outermost first, the root's scale left absent. */
const scopes: fc.Arbitrary<UnitScope[]> = fc.array(
  fc.record({ system, scale: entry, drawnAt: fc.option(fc.double({ min: 0.01, max: 100, noNaN: true }), { nil: undefined }) }),
  { minLength: 0, maxLength: 3 },
).chain((inner) => system.map((root) => [{ system: root }, ...inner.map(({ system, scale, drawnAt }) => (drawnAt === undefined ? { system, scale } : { system, scale, drawnAt }))]));

describe('unit scopes, property', () => {
  it('fromRoot undoes toRoot across the whole chain', () => {
    fc.assert(fc.property(scopes, finite(1e6), (chain, v) => {
      const root = toRoot(v, chain);
      const back = fromRoot(root, chain);
      // Every boundary may scale by up to 10^6, so the error is relative to the largest intermediate.
      let size = Math.abs(v);
      let n = v;
      for (let i = chain.length - 1; i > 0; i--) {
        const e = chain[i]!.scale!;
        const { factor: f, offset } = typeof e === 'number' ? { factor: e, offset: 0 } : { factor: e.factor, offset: e.offset ?? 0 };
        n = n * f + offset;
        size = Math.max(size, Math.abs(n) + Math.abs(offset)) / Math.min(1, f);
      }
      close(back, v, size, 2 * chain.length + 2);
    }), RUNS);
  });

  it('a value resolved in a scope and formatted there reads back as written', () => {
    fc.assert(fc.property(scopes.chain((c) => fc.tuple(fc.constant(c), unitIn(c[c.length - 1]!.system))), typed, ([chain, u], { value }) => {
      const inner = chain[chain.length - 1]!.system;
      const root = resolveScoped({ value, unit: u }, chain);
      const text = formatScoped(root, u, chain, { precision: 12 });
      const n = Number(text.slice(0, -u.length));
      const { factor: f, offset } = unitScale(inner, u);
      let size = Math.abs(value) + Math.abs(offset / f);
      for (const s of chain.slice(1)) {
        const e = s.scale!;
        const k = typeof e === 'number' ? e : e.factor;
        const o = typeof e === 'number' ? 0 : (e.offset ?? 0);
        size = (size + Math.abs(o)) / Math.min(1, k) * Math.max(1, k);
      }
      close(n, value, size / Math.min(1, f) * Math.max(1, f), 2 * chain.length + 4, 0.5e-12);
    }), RUNS);
  });
});

describe('scaleBar, property', () => {
  const bar = fc.record({
    pxPerUnit: fc.double({ min: -4, max: 6, noNaN: true }).map((k) => 10 ** k),
    maxPx: fc.option(fc.integer({ min: 20, max: 400 }), { nil: undefined }),
    nested: fc.constantFrom('inches', 'mm', 'mm at 0.4'),
  });
  const chainOf = (nested: string): UnitScope[] => [
    { system: IMPERIAL_INCHES },
    ...(nested === 'inches' ? [] : [{ system: METRIC_MM, scale: 1 / 25.4, ...(nested === 'mm at 0.4' ? { drawnAt: 0.4 } : {}) }]),
  ];

  it('is the longest round length that fits, or the shortest when none does', () => {
    const tally = { fits: 0, shortest: 0 };
    fc.assert(fc.property(bar, ({ pxPerUnit, maxPx, nested }) => {
      const chain = chainOf(nested);
      const max = maxPx ?? 140;
      const got = scaleBar({ pxPerUnit, scopes: chain, ...(maxPx === undefined ? {} : { maxPx }) });
      const pxPer = got.px / got.length;
      const smallest = scaleBar({ pxPerUnit: 1e30, scopes: chain }).length;
      if (got.px <= max * (1 + 1e-12)) tally.fits++;
      else {
        tally.shortest++;
        expect(got.length).toBe(smallest);
      }
      // The next round length up would not fit: a bar at a slightly lower zoom never picks a shorter one.
      const looser = scaleBar({ pxPerUnit: pxPerUnit / 1.0001, scopes: chain, ...(maxPx === undefined ? {} : { maxPx }) });
      expect(looser.length).toBeGreaterThanOrEqual(got.length);
      expect(Math.abs(pxPer - got.px / got.length)).toBeLessThanOrEqual(pxPer * 1e-12);
    }), RUNS);
    expect(tally.fits).toBeGreaterThan(0);
    expect(tally.shortest).toBeGreaterThan(0);
  });

  it('labels the length in a unit it reads back to', () => {
    fc.assert(fc.property(bar, ({ pxPerUnit, maxPx, nested }) => {
      const chain = chainOf(nested);
      const got = scaleBar({ pxPerUnit, scopes: chain, ...(maxPx === undefined ? {} : { maxPx }) });
      const system = chain[chain.length - 1]!.system;
      expect(got.label.endsWith(got.unit)).toBe(true);
      const n = Number(got.label.slice(0, -got.unit.length));
      const f = unitScale(system, got.unit).factor;
      expect(Math.abs(n * f - got.length), got.label).toBeLessThanOrEqual(0.0005 * f + got.length * 1e-12);
      expect(n).toBeGreaterThan(0);
    }), RUNS);
  });

  it('never grows as the view zooms in', () => {
    fc.assert(fc.property(bar, fc.double({ min: 1, max: 1000, noNaN: true }), ({ pxPerUnit, maxPx, nested }, k) => {
      const chain = chainOf(nested);
      const opts = maxPx === undefined ? {} : { maxPx };
      const near = scaleBar({ pxPerUnit: pxPerUnit * k, scopes: chain, ...opts });
      const far = scaleBar({ pxPerUnit, scopes: chain, ...opts });
      expect(near.length).toBeLessThanOrEqual(far.length);
    }), RUNS);
  });
});
