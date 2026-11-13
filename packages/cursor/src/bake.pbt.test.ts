/**
 * Property tests of the two tiers that draw a glyph: a baked cursor's image and hotspot are finite, its hotspot inside
 * the image and where the rotated glyph puts it; the painter's matrix lands the hotspot on the pointer and every glyph
 * point where the baked image puts it; a world-sized glyph's ring measures its radius at any zoom; and `brushRing`
 * draws the radius it is given.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { bakeCursor, quantizeCursorAngle } from './bake';
import { brushRing } from './brushRing';
import { GLYPHS } from './glyphs';
import { chromeLineWidthScale, cursorPaintMatrix, cursorPaintOps, cursorWorldSize } from './paint';
import { cursorGlyph } from './registry';
import { resolveCursorTier } from './resolve';
import { CURSOR_ANGLE_STEPS, CURSOR_MAX_CSS_PX, type CursorGlyph } from './types';
import { angle, anyNumber, bakedSize, runs, tally, timeoutFor, variant } from './pbt.fixture';

const RUNS = 300;

/** A baked cursor's image size and hotspot. */
function parse(css: string): { width: number; height: number; hx: number; hy: number; fallback: string } {
  const m = /^url\("data:image\/svg\+xml,([^"]*)"\) (\S+) (\S+), (.*)$/.exec(css);
  if (!m) throw new Error(`not a baked cursor: ${css}`);
  const svg = decodeURIComponent(m[1]!);
  const width = Number(/ width="([^"]*)"/.exec(svg)![1]);
  const height = Number(/ height="([^"]*)"/.exec(svg)![1]);
  return { width, height, hx: Number(m[2]), hy: Number(m[3]), fallback: m[4]! };
}

const apply = (m: readonly number[], x: number, y: number) => [m[0]! * x + m[2]! * y + m[4]!, m[1]! * x + m[3]! * y + m[5]!] as const;

describe('bakeCursor', () => {
  it('draws a finite image at any size up to the cap, its whole-pixel hotspot inside it where the turned glyph puts it', () => {
    const t = tally();
    fc.assert(fc.property(variant, fc.oneof(bakedSize, anyNumber.filter((n) => !(n > CURSOR_MAX_CSS_PX))), angle, (v, size, a) => {
      const glyph = cursorGlyph(v.glyph, { mark: v.mark });
      const css = bakeCursor(glyph, { size, angle: a });
      const got = parse(css);
      const s = Number.isFinite(size) && size > 0 ? size : 24;
      t.count(s === size ? 'sized' : 'default');
      expect(got.width).toBe(s);
      expect(got.height).toBe(s);
      expect(Number.isInteger(got.hx) && Number.isInteger(got.hy)).toBe(true);
      expect(got.hx).toBeGreaterThanOrEqual(0);
      expect(got.hy).toBeGreaterThanOrEqual(0);
      expect(got.hx).toBeLessThanOrEqual(s);
      expect(got.hy).toBeLessThanOrEqual(s);
      const theta = (quantizeCursorAngle(a) / CURSOR_ANGLE_STEPS) * 2 * Math.PI;
      const c = glyph.box / 2;
      const [dx, dy] = [glyph.hotspot[0] - c, glyph.hotspot[1] - c];
      const k = s / glyph.box;
      const inside = (v: number) => Math.min(Math.max(0, v), Math.floor(s));
      expect(Math.abs(got.hx - inside((c + Math.cos(theta) * dx - Math.sin(theta) * dy) * k))).toBeLessThanOrEqual(0.5 + 1e-9);
      expect(Math.abs(got.hy - inside((c + Math.sin(theta) * dx + Math.cos(theta) * dy) * k))).toBeLessThanOrEqual(0.5 + 1e-9);
      expect(css).not.toMatch(/NaN|Infinity|undefined/);
    }), runs(RUNS));
    t.atLeast('sized', 100);
    t.atLeast('default', 20);
  }, timeoutFor(RUNS, 2));

  it('refuses a size past the cap with a RangeError', () => {
    fc.assert(fc.property(variant, fc.double({ min: CURSOR_MAX_CSS_PX, max: 1e300, noNaN: true }).filter((n) => n > CURSOR_MAX_CSS_PX), (v, size) => {
      expect(() => bakeCursor(cursorGlyph(v.glyph, { mark: v.mark }), { size })).toThrow(RangeError);
    }), runs(RUNS));
  });

  it('steps every angle into one of its steps, a whole turn apart landing on the same', () => {
    fc.assert(fc.property(anyNumber, fc.integer({ min: -1000, max: 1000 }), (a, k) => {
      const i = quantizeCursorAngle(a);
      expect(Number.isInteger(i) && i >= 0 && i < CURSOR_ANGLE_STEPS).toBe(true);
      if (Number.isFinite(a) && Math.abs(a) < 1e6) {
        const step = (2 * Math.PI) / CURSOR_ANGLE_STEPS;
        const off = (((a / step) % 1) + 1) % 1;
        // Away from a step's boundary, where a turn's rounding could tip it.
        if (Math.abs(off - 0.5) > 1e-6) expect(quantizeCursorAngle(a + 2 * Math.PI * k)).toBe(i);
      }
    }), runs(RUNS));
  });
});

describe('the painted tier', () => {
  it('puts the hotspot on the pointer, and every glyph point where the baked image draws it', () => {
    fc.assert(fc.property(variant, bakedSize, fc.integer({ min: 0, max: CURSOR_ANGLE_STEPS - 1 }), fc.double({ min: -2000, max: 2000, noNaN: true }), fc.double({ min: -2000, max: 2000, noNaN: true }), fc.tuple(fc.double({ min: 0, max: 24, noNaN: true }), fc.double({ min: 0, max: 24, noNaN: true })), (v, size, step, x, y, [px, py]) => {
      const glyph = cursorGlyph(v.glyph, { mark: v.mark });
      const angle = (step / CURSOR_ANGLE_STEPS) * 2 * Math.PI;
      const m = cursorPaintMatrix(glyph, { size, angle, at: { x, y } });
      expect(m.every(Number.isFinite)).toBe(true);
      const [hx, hy] = apply(m, glyph.hotspot[0], glyph.hotspot[1]);
      expect(Math.hypot(hx - x, hy - y)).toBeLessThan(1e-9 * Math.max(1, Math.abs(x), Math.abs(y)));
      // The baked image: its corner at the pointer less the rounded hotspot, the glyph turned about the box center.
      const baked = parse(bakeCursor(glyph, { size, angle }));
      const k = size / glyph.box;
      const c = glyph.box / 2;
      const bx = x - baked.hx + (c + Math.cos(angle) * (px - c) - Math.sin(angle) * (py - c)) * k;
      const by = y - baked.hy + (c + Math.sin(angle) * (px - c) + Math.cos(angle) * (py - c)) * k;
      const [mx, my] = apply(m, px, py);
      // Apart by just what the baked hotspot moved to land on a pixel inside the image: half a pixel each way at most, unless held in.
      const tx = (c + Math.cos(angle) * (glyph.hotspot[0] - c) - Math.sin(angle) * (glyph.hotspot[1] - c)) * k;
      const ty = (c + Math.sin(angle) * (glyph.hotspot[0] - c) + Math.cos(angle) * (glyph.hotspot[1] - c)) * k;
      expect(Math.abs(Math.hypot(mx - bx, my - by) - Math.hypot(tx - baked.hx, ty - baked.hy))).toBeLessThan(1e-6);
      if (tx >= 0 && ty >= 0 && tx <= Math.floor(size) && ty <= Math.floor(size)) expect(Math.hypot(mx - bx, my - by)).toBeLessThanOrEqual(Math.SQRT1_2 + 1e-6);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 2));

  it("sizes a world glyph so its ring measures the radius on screen at any zoom, finite while the ring is", () => {
    const t = tally();
    const decade = fc.oneof(fc.integer({ min: -60, max: 300 }).map((e) => 10 ** (e / 2)), fc.double({ min: 1e306, max: 7e307, noNaN: true }));
    fc.assert(fc.property(fc.constantFrom(...(Object.keys(GLYPHS) as (keyof typeof GLYPHS)[])), decade, decade, (name, worldRadius, scale) => {
      const glyph: CursorGlyph = GLYPHS[name];
      const size = cursorWorldSize(glyph, worldRadius, scale);
      const r = glyph.radius ?? glyph.box / 2;
      const want = worldRadius * scale;
      const ring = size * (r / glyph.box);
      if (Number.isFinite(want * (glyph.box / r))) {
        t.count('finite');
        expect(Number.isFinite(size)).toBe(true);
        expect(Math.abs(ring - want)).toBeLessThanOrEqual(1e-12 * want);
      }
      expect(Number.isNaN(size)).toBe(false);
      const lw = chromeLineWidthScale(glyph, size);
      if (Number.isFinite(size) && size > 0) expect(lw * size).toBeCloseTo(glyph.box, 9);
    }), runs(RUNS));
    t.atLeast('finite', 100);
  }, timeoutFor(RUNS, 2));

  it('paints each layer halos first, then ink, every width scaled by the line-width scale', () => {
    fc.assert(fc.property(variant, fc.double({ min: 1e-3, max: 1e3, noNaN: true }), (v, k) => {
      const glyph = cursorGlyph(v.glyph, { mark: v.mark });
      const one = cursorPaintOps(glyph);
      const scaled = cursorPaintOps(glyph, { lineWidthScale: k });
      expect(scaled.map((o) => o.d)).toEqual(one.map((o) => o.d));
      scaled.forEach((o, i) => {
        if (o.stroke) expect(o.stroke.width).toBeCloseTo(one[i]!.stroke!.width * k, 9);
      });
      const inks = glyph.paths.length + (glyph.over?.length ?? 0);
      expect(one.length).toBeGreaterThanOrEqual(inks);
    }), runs(RUNS));
  });
});

describe('brushRing', () => {
  it('draws a ring of the radius given, to within a pixel of the size it rounds to, at any radius and zoom', () => {
    const t = tally();
    const ring = GLYPHS.brush.radius;
    const box = GLYPHS.brush.box;
    fc.assert(fc.property(fc.oneof(fc.double({ min: 0, max: 5, noNaN: true }), fc.double({ min: 0, max: 400, noNaN: true }), fc.double({ min: 50, max: 400, noNaN: true })), fc.double({ min: 0.01, max: 100, noNaN: true }), (radius, zoom) => {
      const px = resolveCursorTier(brushRing(radius, 'px'));
      const size = px.kind === 'css' ? parse(px.css).width : px.size!;
      t.count(px.kind === 'css' ? 'baked' : 'painted');
      expect(Math.abs((size * ring) / box - radius)).toBeLessThanOrEqual(ring / box + 1e-9);
      if (radius === 0) return;
      t.count('world');
      const world = resolveCursorTier(brushRing(radius, 'world'));
      expect(world).toMatchObject({ kind: 'painted', glyph: 'brush', worldRadius: radius });
      const drawn = cursorWorldSize(GLYPHS.brush, radius, zoom) * (ring / box);
      expect(drawn).toBeCloseTo(radius * zoom, 6);
    }), runs(RUNS));
    t.atLeast('baked', 100);
    t.atLeast('painted', 20);
  }, timeoutFor(RUNS, 2));
});
