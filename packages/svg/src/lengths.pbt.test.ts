/**
 * Lengths and the root viewport: a geometry attribute in any CSS unit, number spelling, or percentage of the root
 * `viewBox` reads as a model of CSS Values 4 and SVG 2 says, always finite; and a root `viewBox`, `width`, and
 * `height` written by `serializeSvg` read back as given, at any magnitude.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { parseSvg } from './parse';
import { serializeSvg } from './serialize';
import type { SvgPathNode } from './types';
import { runs, timeoutFor } from './pbt.fixture';

const N = 300;

const PX: Record<string, number> = { '': 1, px: 1, in: 96, cm: 96 / 2.54, mm: 96 / 25.4, q: 96 / 101.6, pt: 96 / 72, pc: 16 };

/** A number as CSS may spell it, with its value. */
const spelled: fc.Arbitrary<{ text: string; n: number }> = fc.oneof(
  fc.integer({ min: -100_000, max: 100_000 }).map((i) => ({ text: String(i), n: i })),
  fc.integer({ min: 0, max: 99 }).map((i) => ({ text: `.${String(i).padStart(2, '0')}`, n: i / 100 })),
  fc.integer({ min: 0, max: 999 }).map((i) => ({ text: `+${i}.`, n: i })),
  fc.tuple(fc.integer({ min: -99, max: 99 }), fc.integer({ min: -30, max: 30 }), fc.boolean(), fc.boolean())
    .map(([m, e, upper, plus]) => ({ text: `${m}${upper ? 'E' : 'e'}${plus && e >= 0 ? '+' : ''}${e}`, n: Number(`${m}e${e}`) })),
  fc.double({ min: -1e6, max: 1e6, noNaN: true }).map((d) => ({ text: String(d), n: d })),
);

const close = (got: number, want: number): void => {
  expect(Number.isFinite(got)).toBe(true);
  expect(Math.abs(got - want)).toBeLessThanOrEqual(1e-9 * Math.max(1, Math.abs(want)));
};

const widthOf = (xml: string): number => {
  const out = parseSvg(xml);
  const rect = out.nodes[0] as SvgPathNode | undefined;
  if (rect?.path.kind !== 'rect') throw new Error(`no rect in ${xml}: ${out.warnings.join('; ')}`);
  return rect.path.width;
};

describe('lengths, property', () => {
  it('reads an absolute unit at 96 per inch, an em of the font size, in any case and number spelling', () => {
    let ems = 0;
    fc.assert(fc.property(
      spelled.filter(({ n }) => n > 0 && n < 1e30), fc.constantFrom(...Object.keys(PX), 'em'), fc.boolean(),
      fc.integer({ min: 1, max: 100 }),
      ({ text, n }, unit, upper, fontSize) => {
        const u = upper ? unit.toUpperCase() : unit;
        if (unit === 'em') ems++;
        const want = unit === 'em' ? n * fontSize : n * PX[unit]!;
        const xml = `<svg xmlns="http://www.w3.org/2000/svg"><rect font-size="${fontSize}" width="${text}${u}" height="1"/></svg>`;
        close(widthOf(xml), want);
      },
    ), runs(N));
    expect(ems).toBeGreaterThan(runs(N).numRuns / 30);
  }, timeoutFor(N, 10));

  it('reads a percentage of the root viewBox: width on x, height on y, the normalized diagonal for a radius', () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 4000 }), fc.integer({ min: 1, max: 4000 }), fc.integer({ min: 1, max: 300 }),
      (vw, vh, pct) => {
        const xml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vw} ${vh}" width="${vw * 3}mm">`
          + `<rect width="${pct}%" height="${pct}%"/><circle r="${pct}%"/></svg>`;
        const out = parseSvg(xml);
        expect(out.warnings).toEqual([]);
        const [rect, circle] = out.nodes as SvgPathNode[];
        if (rect!.path.kind !== 'rect') throw new Error('not a rect');
        close(rect!.path.width, (pct / 100) * vw);
        close(rect!.path.height, (pct / 100) * vh);
        const b = circle!.path.kind === 'polygon' ? Math.max(...circle!.path.coords) : NaN;
        const r = (pct / 100) * Math.sqrt((vw * vw + vh * vh) / 2);
        // A circle is stored in float32 coordinates.
        expect(Math.abs(b - r)).toBeLessThanOrEqual(1e-6 * r + 1e-6);
      },
    ), runs(N));
  }, timeoutFor(N, 10));

  it('never reads a non-finite length, whatever the attribute says', () => {
    const unit = fc.constantFrom('', 'px', 'mm', 'in', 'em', 'ex', '%', 'vw', 'Q', 'deg');
    const raw = fc.oneof(
      fc.tuple(fc.double(), unit).map(([d, u]) => `${d}${u}`),
      fc.tuple(spelled, unit).map(([s, u]) => `${s.text}${u}`),
      fc.constantFrom('1e309', '-1e309px', '1e308in', '1e400%', 'Infinity', 'NaN', '', '  5  mm', '5 mm', '1e-400em'),
    );
    fc.assert(fc.property(raw, raw, fc.oneof(raw, fc.constant('16')), (w, x, fontSize) => {
      const xml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} 10" width="${w}" height="${x}">`
        + `<rect font-size="${fontSize}" x="${x}" width="${w}" height="1"/></svg>`;
      const out = parseSvg(xml);
      for (const n of out.nodes) if (n.kind === 'path' && n.path.kind === 'rect') {
        for (const v of [n.path.x, n.path.y, n.path.width, n.path.height]) expect(Number.isFinite(v), xml).toBe(true);
      }
      for (const v of [out.width, out.height, ...Object.values(out.viewBox ?? {})]) {
        if (v !== undefined) expect(Number.isFinite(v), xml).toBe(true);
      }
    }), runs(N));
  }, timeoutFor(N, 10));
});

describe('the root viewport through serializeSvg, property', () => {
  const magnitude = fc.oneof(
    fc.double({ min: -1e6, max: 1e6, noNaN: true, noDefaultInfinity: true }),
    fc.double({ noNaN: true, noDefaultInfinity: true }),
    fc.constantFrom(1e21, -1e21, 1e-7, 5e-324, 1e303, -Number.MAX_VALUE, Number.MAX_VALUE),
  );

  it('writes viewBox, width, and height that read back as given, to six decimals', () => {
    let huge = 0;
    fc.assert(fc.property(
      fc.record({ x: magnitude, y: magnitude, width: magnitude.map(Math.abs), height: magnitude.map(Math.abs) }),
      magnitude.map(Math.abs), magnitude.map(Math.abs),
      (viewBox, width, height) => {
        if (Math.max(...Object.values(viewBox), width, height) > 1e300) huge++;
        const xml = serializeSvg([], { viewBox, width, height });
        const out = parseSvg(xml);
        expect(out.error, xml).toBeUndefined();
        const near = (got: number | undefined, want: number): void => {
          expect(got, xml).toBeDefined();
          expect(Math.abs(got! - want), `${got} vs ${want} in ${xml}`).toBeLessThanOrEqual(Math.max(5e-7, Math.abs(want) * 1e-15));
        };
        for (const k of ['x', 'y', 'width', 'height'] as const) near(out.viewBox?.[k], viewBox[k]);
        near(out.width, width);
        near(out.height, height);
      },
    ), runs(N));
    expect(huge).toBeGreaterThan(runs(N).numRuns / 20);
  }, timeoutFor(N, 10));
});
