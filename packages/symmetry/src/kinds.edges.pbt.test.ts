/**
 * Property tests of the kinds at their edges, the second pass: every kind's copies and point group stay finite and
 * rigid for any spec field, `NaN`, infinities, subnormals, and the double range's ends included, and any center;
 * a group's `data` read from any JSON gives a spec every kind draws from without throwing, its kind and cell looked
 * up as own names only.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { SYMMETRY_KINDS, symmetryTransforms, type SymmetryKind } from './kinds';
import { specOfData } from './group';
import { MAX_WALLPAPER_COPIES } from './wallpaper';
import { CELLS, isIsometry, point, runs, spec, tally, timeoutFor } from './pbt.fixture';

const RUNS = 150;
const KINDS = Object.keys(SYMMETRY_KINDS) as SymmetryKind[];

const wild = fc.oneof(
  fc.double(),
  fc.constantFrom(Number.NaN, Infinity, -Infinity, 0, -0, Number.MIN_VALUE, -Number.MIN_VALUE, Number.MAX_VALUE, -Number.MAX_VALUE, 1e-310, 1e300),
);

/** A spec with any of its numbers replaced by an edge value. */
const edgy = fc.tuple(spec({ maxCount: 40 }), fc.record({
  angle: fc.option(wild, { nil: undefined }), count: fc.option(wild, { nil: undefined }),
  spacing: fc.option(wild, { nil: undefined }), cellAngle: fc.option(wild, { nil: undefined }),
  rowAngle: fc.option(wild, { nil: undefined }), rowSpacing: fc.option(wild, { nil: undefined }),
  ex: fc.option(fc.tuple(wild, wild, wild, wild), { nil: undefined }),
}, { requiredKeys: [] })).map(([s, o]) => ({
  ...s,
  ...Object.fromEntries(Object.entries(o).filter(([k, v]) => k !== 'ex' && v !== undefined)),
  ...(o.ex ? { extent: { x: o.ex[0], y: o.ex[1], width: o.ex[2], height: o.ex[3] } } : {}),
}));

const center = fc.oneof(point(1000), fc.record({ x: wild, y: wild }));

describe('every kind, at its edges', () => {
  it('draws only finite, rigid copies, and edits under a finite point group, for any field and any center', () => {
    const t = tally();
    fc.assert(fc.property(edgy, center, (s, c) => {
      const ms = symmetryTransforms(s, c);
      const pg = SYMMETRY_KINDS[s.kind].pointGroup(s, c);
      expect(ms.length).toBeLessThanOrEqual(MAX_WALLPAPER_COPIES);
      for (const m of [...ms, ...pg]) {
        expect(m.every(Number.isFinite)).toBe(true);
        expect(isIsometry(m)).toBe(true);
      }
      t.count(s.kind);
      if (ms.length > 0) t.count('copies');
    }), runs(RUNS));
    for (const k of KINDS) t.atLeast(k, 5);
    t.atLeast('copies', 50);
  }, timeoutFor(RUNS, 60));
});

const json = fc.letrec((tie) => ({
  value: fc.oneof(
    { depthSize: 'small' },
    fc.constantFrom(null, true, false, 0, -1, 6, 1e308, '', 'mirror', 'wallpaper', 'repeat', 'toString', '__proto__', 'constructor', 'none', 'kaleidoscope', 'hasOwnProperty'),
    fc.array(tie('value'), { maxLength: 3 }),
    tie('object'),
  ),
  object: fc.dictionary(fc.constantFrom('x', 'y', 'width', 'height', 'kind', 'cell', '__proto__', 'toString'), tie('value'), { maxKeys: 4 }),
})).value;

/** A group's `data` as a file might hold it: any field of the spec holding any JSON value, `__proto__` an own key. */
const data = fc.record({
  kind: fc.oneof(fc.constantFrom(...KINDS), json), cell: fc.oneof(fc.constantFrom(...CELLS, 'repeat', 'wallpaper'), json),
  angle: fc.oneof(fc.double({ noNaN: true, noDefaultInfinity: true }), json), count: fc.oneof(fc.integer({ min: -2, max: 12 }), json),
  spacing: fc.oneof(fc.double({ noNaN: true, noDefaultInfinity: true }), json), glide: json, glideRows: json,
  cellAngle: json, rowAngle: json, rowSpacing: fc.oneof(fc.double({ min: 1, max: 300, noNaN: true }), json), extent: json,
}, { requiredKeys: [] }).map((s) => JSON.parse(JSON.stringify({ symmetry: s })) as unknown);

describe("a group's data", () => {
  it('reads from any JSON as a spec every kind draws from, its kind and cell its own names only', () => {
    const t = tally();
    fc.assert(fc.property(fc.oneof(data, json), point(500), (d, c) => {
      const s = specOfData(d);
      expect(Object.hasOwn(SYMMETRY_KINDS, s.kind)).toBe(true);
      expect((CELLS as readonly string[]).includes(s.cell)).toBe(true);
      const ms = symmetryTransforms(s, c);
      for (const m of ms) expect(m.every(Number.isFinite)).toBe(true);
      expect(Array.isArray(SYMMETRY_KINDS[s.kind].pointGroup(s, c))).toBe(true);
      t.count(s.kind);
    }), runs(RUNS * 2));
    t.atLeast('wallpaper', 10);
  }, timeoutFor(RUNS * 2, 20));

  it('keeps every field that holds a value of its own kind', () => {
    fc.assert(fc.property(spec(), (s) => {
      expect(specOfData(JSON.parse(JSON.stringify({ symmetry: s })))).toEqual(JSON.parse(JSON.stringify(s)));
    }), runs(RUNS));
  });
});

