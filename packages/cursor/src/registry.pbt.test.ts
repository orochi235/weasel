/**
 * Property tests of the memoized bake, the second pass: through any sequence of calls, `cursorFor` answers or throws
 * exactly as a fresh bake of the same glyph and mark does, whatever was cached before it, at sizes past either end
 * and with marks the set lacks, prototype names included; and a baked hotspot follows the size it is baked at.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { bakeCursor } from './bake';
import { GLYPHS, MARKS, type CursorGlyphName, type CursorMarkName } from './glyphs';
import { cursorFor, cursorGlyph } from './registry';
import { CURSOR_MAX_CSS_PX, type CursorGlyph } from './types';
import { runs, tally } from './pbt.fixture';

const RUNS = 150;

const NAMES = Object.keys(GLYPHS) as CursorGlyphName[];
const MARK_NAMES = Object.keys(MARKS) as CursorMarkName[];

const call = fc.record({
  name: fc.constantFrom(...NAMES),
  mark: fc.option(fc.constantFrom(...MARK_NAMES, '', '__proto__', 'toString', 'constructor'), { nil: undefined }),
  size: fc.option(fc.oneof(
    fc.constantFrom(24, 32, 0, -1, 0.5, CURSOR_MAX_CSS_PX, CURSOR_MAX_CSS_PX + 1, Infinity, -Infinity, Number.NaN, Number.MIN_VALUE),
    fc.double({ min: 1, max: 200, noNaN: true }),
  ), { nil: undefined }),
  angle: fc.option(fc.constantFrom(0, 1, -3, Math.PI, Number.NaN, Infinity), { nil: undefined }),
  fallback: fc.option(fc.constantFrom('default', 'crosshair', '|', ''), { nil: undefined }),
});

type Outcome = { ok: string } | { threw: true };
const outcome = (f: () => string): Outcome => {
  try {
    return { ok: f() };
  } catch (e) {
    expect(e).toBeInstanceOf(Error);
    return { threw: true };
  }
};

describe('cursorFor, through any sequence of calls', () => {
  it('answers or throws as a fresh bake does, whatever it cached before', () => {
    const t = tally();
    fc.assert(fc.property(fc.array(call, { minLength: 1, maxLength: 40 }), (calls) => {
      for (const c of calls) {
        const opts = {
          ...(c.mark !== undefined ? { mark: c.mark as CursorMarkName } : {}),
          ...(c.size !== undefined ? { size: c.size } : {}),
          ...(c.angle !== undefined ? { angle: c.angle } : {}),
          ...(c.fallback !== undefined ? { fallback: c.fallback } : {}),
        };
        const fresh = outcome(() => bakeCursor(cursorGlyph(c.name, opts.mark), opts));
        expect(outcome(() => cursorFor(c.name, opts))).toEqual(fresh);
        t.count('threw' in fresh ? 'threw' : 'baked');
      }
    }), runs(RUNS));
    t.atLeast('threw', 50);
    t.atLeast('baked', 200);
  });
});

/** The hotspot a cursor value names. */
const hotspotOf = (css: string): [number, number] => {
  const m = /\) (-?\d+) (-?\d+),/.exec(css)!;
  return [Number(m[1]), Number(m[2])];
};

describe('a baked hotspot', () => {
  it('lands within a pixel of where the glyph puts it at every size, and scales with the size', () => {
    const glyphs = NAMES.map((n) => [n, GLYPHS[n] as CursorGlyph] as const);
    fc.assert(fc.property(fc.constantFrom(...glyphs), fc.integer({ min: 1, max: CURSOR_MAX_CSS_PX / 2 }), fc.integer({ min: 0, max: 15 }), ([name, g], size, step) => {
      const angle = (step / 16) * Math.PI * 2;
      const [hx, hy] = hotspotOf(cursorFor(name, { size, angle }));
      const [dx, dy] = hotspotOf(cursorFor(name, { size: size * 2, angle }));
      const c = g.box / 2;
      const x = c + Math.cos(angle) * (g.hotspot[0] - c) - Math.sin(angle) * (g.hotspot[1] - c);
      const y = c + Math.sin(angle) * (g.hotspot[0] - c) + Math.cos(angle) * (g.hotspot[1] - c);
      const want = (v: number, s: number) => Math.min(Math.max(0, (v / g.box) * s), s);
      expect(Math.abs(hx - want(x, size))).toBeLessThanOrEqual(0.5 + 1e-9);
      expect(Math.abs(hy - want(y, size))).toBeLessThanOrEqual(0.5 + 1e-9);
      expect(Math.abs(dx - 2 * hx)).toBeLessThanOrEqual(1);
      expect(Math.abs(dy - 2 * hy)).toBeLessThanOrEqual(1);
    }), runs(RUNS));
  });
});
