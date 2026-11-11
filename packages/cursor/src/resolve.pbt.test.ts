/**
 * Property tests of cursor resolution: `resolveCursorTier` against a model of its documented order (a bare string
 * passes through, a world radius paints, a size past the cap paints, anything else bakes), every baked cursor ending
 * in its fallback keyword, and the memoized `cursorFor` agreeing with a fresh bake.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { bakeCursor, quantizeCursorAngle } from './bake';
import { cursorFor, cursorGlyph, cursorVariants } from './registry';
import { resolveCursor, resolveCursorTier, type CursorGlyphSpec, type ResolvedCursor } from './resolve';
import { CURSOR_MAX_CSS_PX } from './types';
import { anyNumber, angle, bakedSize, runs, tally, timeoutFor, variant } from './pbt.fixture';

const RUNS = 300;

const opt = <T>(a: fc.Arbitrary<T>) => fc.option(a, { nil: undefined });
const glyphSpec: fc.Arbitrary<CursorGlyphSpec> = fc.record({
  v: variant,
  size: opt(fc.oneof(anyNumber, bakedSize, fc.double({ min: 128, max: 1e4, noNaN: true }))),
  worldRadius: opt(anyNumber),
  angle: opt(fc.oneof(angle, anyNumber)),
  fallback: opt(fc.constantFrom('default', 'crosshair', 'pointer', 'none')),
}).map(({ v, ...rest }) => Object.fromEntries(Object.entries({ ...v, ...rest }).filter(([, x]) => x !== undefined)) as unknown as CursorGlyphSpec);

const positive = (n: number | undefined) => (n !== undefined && Number.isFinite(n) && n > 0 ? n : undefined);

/** What the documented order says a spec resolves to. */
function model(spec: CursorGlyphSpec): ResolvedCursor {
  const angle = spec.angle !== undefined && Number.isFinite(spec.angle) ? spec.angle : 0;
  const mark = spec.mark === undefined ? {} : { mark: spec.mark };
  const worldRadius = positive(spec.worldRadius);
  const size = positive(spec.size);
  if (worldRadius !== undefined) return { kind: 'painted', glyph: spec.glyph, ...mark, angle, worldRadius };
  if (size !== undefined && size > CURSOR_MAX_CSS_PX) return { kind: 'painted', glyph: spec.glyph, ...mark, angle, size };
  return { kind: 'css', css: bakeCursor(cursorGlyph(spec.glyph, spec.mark), { size: size ?? 24, angle, fallback: spec.fallback ?? 'default' }) };
}

describe('resolveCursorTier', () => {
  it('resolves in the documented order, and every baked cursor ends in its fallback keyword', () => {
    const t = tally();
    fc.assert(fc.property(glyphSpec, (spec) => {
      const got = resolveCursorTier(spec);
      expect(got).toEqual(model(spec));
      expect(resolveCursor(spec)).toBe(got.kind === 'css' ? got.css : 'none');
      if (got.kind === 'css') {
        expect(got.css.endsWith(`, ${spec.fallback ?? 'default'}`)).toBe(true);
        expect(got.css).not.toMatch(/NaN|Infinity|undefined/);
      }
      t.count(got.kind === 'css' ? 'css' : got.worldRadius !== undefined ? 'world' : 'big');
    }), runs(RUNS));
    for (const k of ['css', 'world', 'big']) t.atLeast(k, 30);
  }, timeoutFor(RUNS, 2));

  it('passes a bare string through, and answers nothing for nothing', () => {
    fc.assert(fc.property(fc.string(), (css) => {
      expect(resolveCursorTier(css)).toEqual({ kind: 'css', css });
      expect(resolveCursor(css)).toBe(css);
    }), runs(RUNS));
    expect(resolveCursor(undefined)).toBeUndefined();
  });
});

describe('cursorFor', () => {
  it('answers what a fresh bake of the same glyph draws, for every angle in the same step', () => {
    const t = tally();
    fc.assert(fc.property(variant, bakedSize, angle, angle, (v, size, a, b) => {
      const opts = { ...(v.mark ? { mark: v.mark } : {}), size };
      const css = cursorFor(v.glyph, { ...opts, angle: a });
      expect(css).toBe(bakeCursor(cursorGlyph(v.glyph, v.mark), { size, angle: a }));
      if (quantizeCursorAngle(a) === quantizeCursorAngle(b)) {
        t.count('same step');
        expect(cursorFor(v.glyph, { ...opts, angle: b })).toBe(css);
      }
    }), runs(RUNS));
    t.atLeast('same step', 30);
  }, timeoutFor(RUNS, 2));

  it('bakes every variant it lists, and keys each by its glyph and mark', () => {
    for (const v of cursorVariants()) {
      expect(v.key).toBe(v.mark ? `${v.glyph}+${v.mark}` : v.glyph);
      expect(() => cursorFor(v.glyph, v.mark ? { mark: v.mark } : {})).not.toThrow();
    }
  });

  it("throws for a name the set lacks, an own-key lookup, never Object.prototype's", () => {
    fc.assert(fc.property(fc.oneof(fc.string(), fc.constantFrom('__proto__', 'constructor', 'toString', 'hasOwnProperty')), (name) => {
      fc.pre(!(cursorVariants().some((v) => v.glyph === name)));
      expect(() => cursorGlyph(name as never)).toThrow(/unknown cursor glyph/);
      expect(() => cursorGlyph('crosshair', name as never)).toThrow(/unknown cursor mark/);
    }), runs(RUNS));
  });
});
