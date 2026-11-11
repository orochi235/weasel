/**
 * Property tests of the authored path dialect, the second pass: the fit guards against a model of the points a path
 * visits, and alike however its numbers are spelled; `placeCursorPath` composing, reading its own output back, and
 * writing only finite numbers at any magnitude; and a marked glyph's paths and hotspot moved by its slot.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { tokenizePathData } from '@weasel-js/geom';
import { markedGlyph, placeCursorPath } from './mark';
import { GLYPHS, MARKS } from './glyphs';
import { CURSOR_HALO_WIDTH, haloFitsInBox, rotationFitsInBox, type CursorGlyph } from './types';
import { runs, tally } from './pbt.fixture';

const RUNS = 300;

/** A number as SVG may spell it: plain, with a trailing or leading dot, signed, or with an exponent. */
function spell(v: number, how: number): string {
  const s = String(v);
  switch (how % 6) {
    case 0: return s;
    case 1: return Number.isInteger(v) ? `${s}.` : s;
    case 2: return Math.abs(v) < 1 && v !== 0 ? `${v < 0 ? '-' : ''}${String(Math.abs(v)).slice(1)}` : s;
    case 3: return v >= 0 ? `+${s}` : s;
    case 4: return `${v * 10}e-1`;
    default: return v.toExponential();
  }
}

const coordIn = (box: number) => fc.integer({ min: -4 * box, max: 8 * box }).map((v) => v / 4);
const points = (box: number) => fc.array(fc.tuple(coordIn(box), coordIn(box)), { minLength: 1, maxLength: 6 });

/** A polyline path's `d` spelled by `hows`, and the points it visits. */
function polyline(pts: readonly (readonly [number, number])[], hows: readonly number[]): string {
  let k = 0;
  const n = (v: number) => spell(v, hows[k++ % hows.length]!);
  return pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${n(x)} ${n(y)}`).join(' ') + ' Z';
}

const glyphOf = (box: number, ds: readonly string[]): CursorGlyph => ({ box, hotspot: [0, 0], paths: ds.map((d) => ({ role: 'ink' as const, d })) });

describe('the fit guards', () => {
  it('judge a polyline glyph by its points, however its numbers are spelled', () => {
    const t = tally();
    const input = fc.integer({ min: 8, max: 48 }).chain((box) => fc.record({
      box: fc.constant(box),
      paths: fc.array(points(Math.round(box / 3)).map((p) => p.map(([x, y]) => [x + box * 0.3, y + box * 0.3] as const)), { minLength: 1, maxLength: 3 }),
      hows: fc.array(fc.nat(), { minLength: 1, maxLength: 8 }),
    }));
    fc.assert(fc.property(input, ({ box, paths, hows }) => {
      const m = CURSOR_HALO_WIDTH / 2;
      const all = paths.flat();
      const halo = all.every(([x, y]) => x >= m && x <= box - m && y >= m && y <= box - m);
      const turn = all.every(([x, y]) => Math.hypot(x - box / 2, y - box / 2) <= box / 2 - m);
      const plain = glyphOf(box, paths.map((p) => polyline(p, [0])));
      const spelled = glyphOf(box, paths.map((p) => polyline(p, hows)));
      expect(haloFitsInBox(plain)).toBe(halo);
      expect(haloFitsInBox(spelled)).toBe(halo);
      expect(rotationFitsInBox(spelled)).toBe(turn);
      t.count(halo ? 'fits' : 'clipped');
    }), runs(RUNS));
    t.atLeast('fits', 30);
    t.atLeast('clipped', 30);
  });

  it('judge every built-in glyph and mark alike once its numbers are spelled another way', () => {
    const glyphs = Object.values(GLYPHS) as CursorGlyph[];
    fc.assert(fc.property(fc.constantFrom(...glyphs), fc.array(fc.nat(), { minLength: 1, maxLength: 8 }), (g, hows) => {
      let k = 0;
      // An arc's flags are one digit each in SVG's grammar, so they keep their spelling.
      const flag = (cmd: string, i: number) => cmd.toUpperCase() === 'A' && (i % 7 === 3 || i % 7 === 4);
      const respell = (d: string) => tokenizePathData(d)
        .map(({ cmd, args }) => `${cmd}${args.map((v, i) => ` ${flag(cmd, i) ? v : spell(v, hows[k++ % hows.length]!)}`).join('')}`).join(' ');
      const moved: CursorGlyph = { ...g, paths: g.paths.map((p) => ({ ...p, d: respell(p.d) })) };
      expect(haloFitsInBox(moved)).toBe(haloFitsInBox({ ...g, over: [] }));
      expect(rotationFitsInBox(moved)).toBe(rotationFitsInBox({ ...g, over: [] }));
    }), runs(RUNS));
  });
});

const numbersOf = (d: string): number[] => tokenizePathData(d).flatMap(({ args }) => args);
const ARC_D = 'M 2 3 A 4 4 0 1 0 10 3 L 5 5 Z';

describe('placeCursorPath', () => {
  const scale = fc.oneof(fc.double({ min: -8, max: 8, noNaN: true }), fc.double({ min: -1e300, max: 1e300, noNaN: true }));
  const shift = fc.oneof(fc.double({ min: -100, max: 100, noNaN: true }), fc.double({ min: -1e308, max: 1e308, noNaN: true }));
  const anyNumber = fc.oneof(scale, shift, fc.constantFrom(Number.NaN, Infinity, -Infinity, Number.MIN_VALUE, Number.MAX_VALUE));

  it('writes only finite numbers that read back as themselves, or refuses with a RangeError, at any magnitude', () => {
    const t = tally();
    fc.assert(fc.property(fc.constantFrom('M 1 2 L 3 4 Z', ARC_D, 'M .5 1e1 L -2.5 +3'), anyNumber, anyNumber, anyNumber, (d, k, dx, dy) => {
      let out: string;
      try {
        out = placeCursorPath(d, k, dx, dy);
      } catch (e) {
        expect(e).toBeInstanceOf(RangeError);
        t.count('refused');
        return;
      }
      expect(numbersOf(out).every(Number.isFinite)).toBe(true);
      expect(placeCursorPath(out, 1, 0, 0)).toBe(out);
      t.count('placed');
    }), runs(RUNS));
    t.atLeast('refused', 20);
    t.atLeast('placed', 100);
  });

  it('composes: placed twice is placed once by the product, to its rounding', () => {
    const small = fc.double({ min: -8, max: 8, noNaN: true });
    const move = fc.double({ min: -100, max: 100, noNaN: true });
    fc.assert(fc.property(fc.constantFrom('M 1 2 L 3 4 Z', ARC_D), small, move, move, small, move, move, (d, k1, a1, b1, k2, a2, b2) => {
      const twice = numbersOf(placeCursorPath(placeCursorPath(d, k1, a1, b1), k2, a2, b2));
      const once = numbersOf(placeCursorPath(d, k1 * k2, a1 * k2 + a2, b1 * k2 + b2));
      expect(twice).toHaveLength(once.length);
      const tol = 0.005 * (Math.abs(k2) + 1) + 0.0051;
      twice.forEach((v, i) => expect(Math.abs(v - once[i]!)).toBeLessThanOrEqual(tol));
    }), runs(RUNS));
  });
});

describe('markedGlyph', () => {
  const slotted = (Object.entries(GLYPHS) as [string, CursorGlyph][]).filter(([, g]) => g.mark);
  const marks = Object.values(MARKS);

  it('moves the glyph and its hotspot by the slot\'s shift, and scales the mark into the slot', () => {
    fc.assert(fc.property(fc.constantFrom(...slotted), fc.constantFrom(...marks), ([, g], mark) => {
      const out = markedGlyph(g, mark);
      const slot = g.mark!;
      const [sx, sy] = slot.shift ?? [0, 0];
      expect(out.hotspot).toEqual([g.hotspot[0] + sx, g.hotspot[1] + sy]);
      expect(out.mark).toBeUndefined();
      g.paths.forEach((p, i) => {
        const before = numbersOf(p.d);
        const after = numbersOf(out.paths[i]!.d);
        expect(after).toHaveLength(before.length);
      });
      const k = slot.size / mark.box;
      mark.paths.forEach((p, i) => {
        const placed = placeCursorPath(p.d, k, slot.x - (mark.box / 2) * k, slot.y - (mark.box / 2) * k);
        expect(out.over![i]!.d).toBe(placed);
      });
    }), runs(60));
  });
});
